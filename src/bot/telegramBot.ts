import { Telegraf } from "telegraf";
import type { Handlers } from "./handlers.js";

export function createTelegramBot(opts: {
  botToken: string;
  handlers: Handlers;
  allowedUsers: number[];
}) {
  const bot = new Telegraf(opts.botToken);

  // Auth middleware - restrict to allowed users
  if (opts.allowedUsers.length > 0) {
    bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId || !opts.allowedUsers.includes(userId)) {
        console.log(`Unauthorized access attempt from user: ${userId}`);
        return;
      }
      return next();
    });
  }

  bot.start(opts.handlers.onStart);
  bot.on("text", opts.handlers.onText);
  bot.on("callback_query", opts.handlers.onCallback);

  return bot;
}
