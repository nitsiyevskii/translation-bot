import type { Pair } from "../llm/scriptFormat.js";

export type AudioTrack = {
  id: number;
  filePath: string;
  pairs: Pair[];
  createdAt: number;
};

export type UserHistory = {
  id: number;
  chatId: number;
  trackId: number;
  listenedAt: number;
};

export type TrackFeedback = {
  id: number;
  chatId: number;
  trackId: number;
  score: number; // +1 for like, -1 for dislike
  createdAt: number;
};
