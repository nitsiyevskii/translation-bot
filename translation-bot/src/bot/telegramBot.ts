import { Telegraf } from "telegraf";
import type { Handlers } from "./handlers.js";

export function createTelegramBot(opts: {
  botToken: string;
  handlers: Handlers;
}) {
  const bot = new Telegraf(opts.botToken);

  bot.start(opts.handlers.onStart);
  bot.on("text", opts.handlers.onText);

  return bot;
}
