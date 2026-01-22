import "dotenv/config";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

function parseSeconds(value: string): number {
  const match = value.match(/^([\d.]+)s?$/);
  return match ? parseFloat(match[1]) : 2;
}

export type LanguageConfig = {
  code: string;
  name: string;
  voiceName: string;
};

export type SettingsLimits = {
  pauseThinkMin: number;
  pauseThinkMax: number;
  pauseBetweenMin: number;
  pauseBetweenMax: number;
  itemsMin: number;
  itemsMax: number;
};

export type LibraryConfig = {
  dbPath: string;
  audioDir: string;
  targetSize: number;
  lowScoreThreshold: number;
  maintenanceIntervalMs: number;
};

export type AppConfig = {
  botToken: string;
  openaiApiKey: string;
  openaiModel: string;
  itemsPerTrack: number;
  level: string;
  pauseThink: number;
  pauseBetween: number;
  maxRecent: number;
  recentAvoidListSize: number;
  sourceLanguage: LanguageConfig;
  targetLanguage: LanguageConfig;
  allowedUsers: number[];
  limits: SettingsLimits;
  library: LibraryConfig;
};

export const config: AppConfig = {
  botToken: requireEnv("BOT_TOKEN"),
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",

  itemsPerTrack: Number(process.env.ITEMS_PER_TRACK || 20),
  level: process.env.LANGUAGE_LEVEL?.trim() || "A2–B1",
  pauseThink: parseSeconds(process.env.PAUSE_THINK?.trim() || "2s"),
  pauseBetween: parseSeconds(process.env.PAUSE_BETWEEN?.trim() || "3s"),

  maxRecent: Number(process.env.MAX_RECENT_WORDS || 200),
  recentAvoidListSize: Number(process.env.RECENT_AVOID_LIST_SIZE || 120),

  sourceLanguage: {
    code: process.env.SOURCE_LANG_CODE?.trim() || "es-ES",
    name: process.env.SOURCE_LANG_NAME?.trim() || "Spanish (Spain)",
    voiceName: process.env.SOURCE_VOICE?.trim() || "es-ES-Neural2-B",
  },
  targetLanguage: {
    code: process.env.TARGET_LANG_CODE?.trim() || "ru-RU",
    name: process.env.TARGET_LANG_NAME?.trim() || "Russian",
    voiceName: process.env.TARGET_VOICE?.trim() || "ru-RU-Wavenet-D",
  },
  allowedUsers: process.env.ALLOWED_USERS
    ? process.env.ALLOWED_USERS.split(",").map(id => Number(id.trim())).filter(id => !isNaN(id))
    : [],
  limits: {
    pauseThinkMin: 1,
    pauseThinkMax: 10,
    pauseBetweenMin: 1,
    pauseBetweenMax: 10,
    itemsMin: 5,
    itemsMax: 30,
  },
  library: {
    dbPath: process.env.DB_PATH?.trim() || "./data/db.sqlite",
    audioDir: process.env.AUDIO_DIR?.trim() || "./data/audio",
    targetSize: Number(process.env.LIBRARY_SIZE || 20),
    lowScoreThreshold: Number(process.env.LOW_SCORE_THRESHOLD || -5),
    maintenanceIntervalMs: Number(process.env.MAINTENANCE_INTERVAL_HOURS || 24) * 60 * 60 * 1000,
  },
};