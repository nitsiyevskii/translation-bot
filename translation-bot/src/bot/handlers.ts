import fs from "node:fs";
import type { Context, NarrowedContext } from "telegraf";
import type { Message, Update } from "telegraf/types";
import type { AppConfig } from "../config.js";
import type { RecentStore } from "../state/recentStore.js";
import type { OpenAiScriptGenerator } from "../llm/openaiScript.js";
import type { GoogleTts } from "../tts/googleTts.js";
import { buildSsml } from "../tts/ssml.js";
import { mp3BufferToOggOpusFile } from "../tts/audioConvert.js";

type TextContext = NarrowedContext<Context<Update>, Update.MessageUpdate<Message.TextMessage>>;

export type Handlers = {
  onStart(ctx: TextContext): Promise<void>;
  onText(ctx: TextContext): Promise<void>;
};

export function createHandlers(opts: {
  config: AppConfig;
  store: RecentStore;
  scriptGen: OpenAiScriptGenerator;
  tts: GoogleTts;
}): Handlers {
  const { config, store, scriptGen, tts } = opts;

  const { sourceLanguage, targetLanguage } = config;

  return {
    async onStart(ctx) {
      const message = `Send "go" to get a new ${sourceLanguage.name} → ${targetLanguage.name} audio track.`;
      await ctx.reply(message);
    },

    async onText(ctx) {
      const text = ctx.message.text.trim().toLowerCase();
      if (text !== "go") return;

      const chatId = ctx.chat.id;
      await ctx.reply("Generating audio track...");

      try {
        const recentAvoidList = store.getRecent(chatId, config.recentAvoidListSize);

        const { pairs } = await scriptGen.generate({
          itemsPerTrack: config.itemsPerTrack,
          level: config.level,
          recentAvoidList,
          sourceLangName: sourceLanguage.name,
          targetLangName: targetLanguage.name,
        });

        store.addMany(chatId, pairs.map(p => p.source));

        const ssml = buildSsml(pairs, {
          pauseThink: config.pauseThink,
          pauseBetween: config.pauseBetween,
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
  };
}
