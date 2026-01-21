import "dotenv/config";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

export type LanguageConfig = {
  code: string;
  name: string;
  voiceName: string;
};

export type AppConfig = {
  botToken: string;
  openaiApiKey: string;
  openaiModel: string;
  itemsPerTrack: number;
  level: string;
  pauseThink: string;
  pauseBetween: string;
  maxRecent: number;
  recentAvoidListSize: number;
  sourceLanguage: LanguageConfig;
  targetLanguage: LanguageConfig;
  allowedUsers: number[];
};

export const config: AppConfig = {
  botToken: requireEnv("BOT_TOKEN"),
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",

  itemsPerTrack: Number(process.env.ITEMS_PER_TRACK || 20),
  level: process.env.LANGUAGE_LEVEL?.trim() || "A2–B1",
  pauseThink: process.env.PAUSE_THINK?.trim() || "2s",
  pauseBetween: process.env.PAUSE_BETWEEN?.trim() || "1.5s",

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
};