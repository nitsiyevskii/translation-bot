import { config } from "./config.js";
import { RecentStore } from "./state/recentStore.js";
import { OpenAiScriptGenerator } from "./llm/openaiScript.js";
import { GoogleTts } from "./tts/googleTts.js";
import { createHandlers } from "./bot/handlers.js";
import { createTelegramBot } from "./bot/telegramBot.js";

const store = new RecentStore({ maxRecent: config.maxRecent });

const scriptGenerator = new OpenAiScriptGenerator({
  apiKey: config.openaiApiKey,
  model: config.openaiModel,
});

const tts = new GoogleTts();

const handlers = createHandlers({
  config,
  store,
  scriptGen: scriptGenerator,
  tts,
});

const bot = createTelegramBot({
  botToken: config.botToken,
  handlers,
  allowedUsers: config.allowedUsers,
});

bot.launch();
console.log(`Bot running: ${config.sourceLanguage.name} → ${config.targetLanguage.name}`);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
