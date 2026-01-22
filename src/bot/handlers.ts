import fs from "node:fs";
import type { Context, NarrowedContext } from "telegraf";
import { Markup } from "telegraf";
import type { Message, Update } from "telegraf/types";
import type { AppConfig } from "../config.js";
import type { SettingsStore } from "../state/settingsStore.js";
import type { DatabaseService } from "../db/database.js";
import type { AudioTrack } from "../db/types.js";

type TextContext = NarrowedContext<Context<Update>, Update.MessageUpdate<Message.TextMessage>>;

export type Handlers = {
  onStart(ctx: TextContext): Promise<void>;
  onText(ctx: TextContext): Promise<void>;
  onCallback(ctx: Context): Promise<void>;
};

function buildSettingsKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("\u23f1 Think \u22121s", "think_dec"),
      Markup.button.callback("\u23f1 Think +1s", "think_inc"),
    ],
    [
      Markup.button.callback("\u23f8 Between \u22121s", "between_dec"),
      Markup.button.callback("\u23f8 Between +1s", "between_inc"),
    ],
    [
      Markup.button.callback("\ud83d\udcdd Words \u22125", "items_dec"),
      Markup.button.callback("\ud83d\udcdd Words +5", "items_inc"),
    ],
  ]);
}

function buildFeedbackKeyboard(trackId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("\ud83d\udc4d", `like_${trackId}`),
      Markup.button.callback("\ud83d\udc4e", `dislike_${trackId}`),
    ],
  ]);
}

export function createHandlers(opts: {
  config: AppConfig;
  settings: SettingsStore;
  db: DatabaseService;
}): Handlers {
  const { config, settings, db } = opts;
  const { sourceLanguage, targetLanguage } = config;

  function formatSettings(chatId: number): string {
    const s = settings.get(chatId);
    return `Current settings:\n\u2022 Think pause: ${s.pauseThink}s\n\u2022 Between pause: ${s.pauseBetween}s\n\u2022 Words per track: ${s.itemsPerTrack}`;
  }

  function getNextTrackForUser(chatId: number): AudioTrack | null {
    let track = db.getNextUnlistenedTrack(chatId);

    if (!track) {
      db.clearUserHistory(chatId);
      track = db.getOldestListenedTrack(chatId);
      if (!track) {
        const allTracks = db.getAllTracks();
        if (allTracks.length > 0) {
          track = allTracks[0];
        }
      }
    }

    return track;
  }

  return {
    async onStart(ctx) {
      const chatId = ctx.chat.id;
      const trackCount = db.getTrackCount();
      const message = `${sourceLanguage.name} \u2192 ${targetLanguage.name} audio flashcards.\n\nSend "go" to get next track.\nLibrary: ${trackCount} tracks available.\n\n${formatSettings(chatId)}`;
      await ctx.reply(message, buildSettingsKeyboard());
    },

    async onText(ctx) {
      const text = ctx.message.text.trim().toLowerCase();
      if (text !== "go") return;

      const chatId = ctx.chat.id;
      const track = getNextTrackForUser(chatId);

      if (!track) {
        await ctx.reply("No audio tracks available yet. Please wait for the library to be generated.");
        return;
      }

      if (!fs.existsSync(track.filePath)) {
        db.deleteTrack(track.id);
        await ctx.reply("Track file missing. Please try again.");
        return;
      }

      try {
        await ctx.replyWithVoice(
          { source: track.filePath },
          buildFeedbackKeyboard(track.id)
        );
        db.markListened(chatId, track.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to send audio:", errorMessage);
        await ctx.reply("Sorry, something went wrong. Please try again.");
      }
    },

    async onCallback(ctx) {
      const callbackQuery = ctx.callbackQuery;
      if (!callbackQuery || !("data" in callbackQuery)) return;

      const chatId = callbackQuery.message?.chat.id;
      if (!chatId) return;

      const action = callbackQuery.data;

      if (action.startsWith("like_")) {
        const trackId = parseInt(action.replace("like_", ""), 10);
        db.setFeedback(chatId, trackId, 1);
        await ctx.answerCbQuery("\ud83d\udc4d Thanks for the feedback!");
        return;
      }

      if (action.startsWith("dislike_")) {
        const trackId = parseInt(action.replace("dislike_", ""), 10);
        db.setFeedback(chatId, trackId, -1);
        await ctx.answerCbQuery("\ud83d\udc4e Thanks for the feedback!");
        return;
      }

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

      const messageText = `${sourceLanguage.name} \u2192 ${targetLanguage.name} audio flashcards.\n\nSend "go" to get next track.\n\n${formatSettings(chatId)}`;
      await ctx.editMessageText(messageText, buildSettingsKeyboard());
    },
  };
}
