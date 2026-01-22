import { config } from "./config.js";
import { SettingsStore } from "./state/settingsStore.js";
import { DatabaseService } from "./db/database.js";
import { AudioLibrary } from "./library/audioLibrary.js";
import { OpenAiScriptGenerator } from "./llm/openaiScript.js";
import { GoogleTts } from "./tts/googleTts.js";
import { createHandlers } from "./bot/handlers.js";
import { createTelegramBot } from "./bot/telegramBot.js";

const db = new DatabaseService(config.library.dbPath);

const settings = new SettingsStore(
  {
    pauseThink: config.pauseThink,
    pauseBetween: config.pauseBetween,
    itemsPerTrack: config.itemsPerTrack,
  },
  config.limits
);

const scriptGenerator = new OpenAiScriptGenerator({
  apiKey: config.openaiApiKey,
  model: config.openaiModel,
});

const tts = new GoogleTts();

const audioLibrary = new AudioLibrary(db, scriptGenerator, tts, {
  audioDir: config.library.audioDir,
  targetSize: config.library.targetSize,
  itemsPerTrack: config.itemsPerTrack,
  level: config.level,
  pauseThink: config.pauseThink,
  pauseBetween: config.pauseBetween,
  sourceLanguage: config.sourceLanguage,
  targetLanguage: config.targetLanguage,
  lowScoreThreshold: config.library.lowScoreThreshold,
});

const handlers = createHandlers({
  config,
  settings,
  db,
});

const bot = createTelegramBot({
  botToken: config.botToken,
  handlers,
  allowedUsers: config.allowedUsers,
});

let maintenanceInterval: NodeJS.Timeout | null = null;

function shutdown(reason: string) {
  console.log(`Shutting down: ${reason}`);
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
    maintenanceInterval = null;
  }
  db.close();
  bot.stop(reason);
}

async function startup() {
  console.log("Initializing audio library...");
  await audioLibrary.ensureLibrarySize();

  console.log(`Starting bot: ${config.sourceLanguage.name} → ${config.targetLanguage.name}`);
  console.log(`Library: ${audioLibrary.getTrackCount()} tracks`);

  bot.launch();

  maintenanceInterval = setInterval(async () => {
    console.log("Running scheduled maintenance...");
    try {
      await audioLibrary.runMaintenance();
    } catch (err) {
      console.error("Maintenance failed:", err);
    }
  }, config.library.maintenanceIntervalMs);
}

startup().catch((err) => {
  console.error("Startup failed:", err);
  shutdown("startup error");
  process.exit(1);
});

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
