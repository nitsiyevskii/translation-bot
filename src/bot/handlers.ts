import fs from "node:fs";
import type { Context, NarrowedContext } from "telegraf";
import { Markup } from "telegraf";
import type { Message, Update } from "telegraf/types";
import type { AppConfig } from "../config.js";
import type { RecentStore } from "../state/recentStore.js";
import type { SettingsStore } from "../state/settingsStore.js";
import type { OpenAiScriptGenerator } from "../llm/openaiScript.js";
import type { GoogleTts } from "../tts/googleTts.js";
import { buildSsml } from "../tts/ssml.js";
import { mp3BufferToOggOpusFile } from "../tts/audioConvert.js";

type TextContext = NarrowedContext<Context<Update>, Update.MessageUpdate<Message.TextMessage>>;

export type Handlers = {
  onStart(ctx: TextContext): Promise<void>;
  onText(ctx: TextContext): Promise<void>;
  onCallback(ctx: Context): Promise<void>;
};

function buildSettingsKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("⏱ Think −1s", "think_dec"),
      Markup.button.callback("⏱ Think +1s", "think_inc"),
    ],
    [
      Markup.button.callback("⏸ Between −1s", "between_dec"),
      Markup.button.callback("⏸ Between +1s", "between_inc"),
    ],
    [
      Markup.button.callback("📝 Words −5", "items_dec"),
      Markup.button.callback("📝 Words +5", "items_inc"),
    ],
  ]);
}

export function createHandlers(opts: {
  config: AppConfig;
  store: RecentStore;
  settings: SettingsStore;
  scriptGen: OpenAiScriptGenerator;
  tts: GoogleTts;
}): Handlers {
  const { config, store, settings, scriptGen, tts } = opts;

  const { sourceLanguage, targetLanguage } = config;

  function formatSettings(chatId: number): string {
    const s = settings.get(chatId);
    return `Current settings:\n• Think pause: ${s.pauseThink}s\n• Between pause: ${s.pauseBetween}s\n• Words per track: ${s.itemsPerTrack}`;
  }

  return {
    async onStart(ctx) {
      const chatId = ctx.chat.id;
      const message = `${sourceLanguage.name} → ${targetLanguage.name} audio flashcards.\n\nSend "go" to generate a track.\n\n${formatSettings(chatId)}`;
      await ctx.reply(message, buildSettingsKeyboard());
    },

    async onText(ctx) {
      const text = ctx.message.text.trim().toLowerCase();
      if (text !== "go") return;

      const chatId = ctx.chat.id;
      const chatSettings = settings.get(chatId);

      await ctx.reply("Generating audio track...");

      try {
        const recentAvoidList = store.getRecent(chatId, config.recentAvoidListSize);

        const { pairs } = await scriptGen.generate({
          itemsPerTrack: chatSettings.itemsPerTrack,
          level: config.level,
          recentAvoidList,
          sourceLangName: sourceLanguage.name,
          targetLangName: targetLanguage.name,
        });

        store.addMany(chatId, pairs.map(p => p.source));

        const ssml = buildSsml(pairs, {
          pauseThink: chatSettings.pauseThink,
          pauseBetween: chatSettings.pauseBetween,
          sourceVoice: sourceLanguage.voiceName,
          targetVoice: targetLanguage.voiceName,
        });

        const mp3Buffer = await tts.synthesizeMp3FromSsml(ssml);
        const oggPath = mp3BufferToOggOpusFile(mp3Buffer);

        try {
          await ctx.replyWithVoice({ source: oggPath });
        } finally {
          if (fs.existsSync(oggPath)) {
            fs.unlinkSync(oggPath);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to generate audio:", errorMessage);
        await ctx.reply("Sorry, something went wrong. Please try again.");
      }
    },

    async onCallback(ctx) {
      const callbackQuery = ctx.callbackQuery;
      if (!callbackQuery || !("data" in callbackQuery)) return;

      const chatId = callbackQuery.message?.chat.id;
      if (!chatId) return;

      const action = callbackQuery.data;
      let newValue: number;
      let label: string;

      switch (action) {
        case "think_dec":
          newValue = settings.adjustPauseThink(chatId, -1);
          label = `Think pause: ${newValue}s`;
          break;
        case "think_inc":
          newValue = settings.adjustPauseThink(chatId, 1);
          label = `Think pause: ${newValue}s`;
          break;
        case "between_dec":
          newValue = settings.adjustPauseBetween(chatId, -1);
          label = `Between pause: ${newValue}s`;
          break;
        case "between_inc":
          newValue = settings.adjustPauseBetween(chatId, 1);
          label = `Between pause: ${newValue}s`;
          break;
        case "items_dec":
          newValue = settings.adjustItems(chatId, -5);
          label = `Words per track: ${newValue}`;
          break;
        case "items_inc":
          newValue = settings.adjustItems(chatId, 5);
          label = `Words per track: ${newValue}`;
          break;
        default:
          await ctx.answerCbQuery("Unknown action");
          return;
      }

      await ctx.answerCbQuery(label);

      const messageText = `${sourceLanguage.name} → ${targetLanguage.name} audio flashcards.\n\nSend "go" to generate a track.\n\n${formatSettings(chatId)}`;
      await ctx.editMessageText(messageText, buildSettingsKeyboard());
    },
  };
}
