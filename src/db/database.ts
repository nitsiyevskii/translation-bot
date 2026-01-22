import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Pair } from "../llm/scriptFormat.js";
import type { AudioTrack } from "./types.js";

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audio_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL UNIQUE,
        pairs_json TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS user_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        track_id INTEGER NOT NULL,
        listened_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (track_id) REFERENCES audio_tracks(id) ON DELETE CASCADE,
        UNIQUE(chat_id, track_id)
      );

      CREATE TABLE IF NOT EXISTS track_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        track_id INTEGER NOT NULL,
        score INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (track_id) REFERENCES audio_tracks(id) ON DELETE CASCADE,
        UNIQUE(chat_id, track_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_history_chat ON user_history(chat_id);
      CREATE INDEX IF NOT EXISTS idx_track_feedback_track ON track_feedback(track_id);
    `);
  }

  // Audio Tracks
  addTrack(filePath: string, pairs: Pair[]): number {
    const stmt = this.db.prepare(
      "INSERT INTO audio_tracks (file_path, pairs_json) VALUES (?, ?)"
    );
    const result = stmt.run(filePath, JSON.stringify(pairs));
    return result.lastInsertRowid as number;
  }

  getTrack(id: number): AudioTrack | null {
    const row = this.db.prepare(
      "SELECT id, file_path, pairs_json, created_at FROM audio_tracks WHERE id = ?"
    ).get(id) as { id: number; file_path: string; pairs_json: string; created_at: number } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      filePath: row.file_path,
      pairs: JSON.parse(row.pairs_json),
      createdAt: row.created_at,
    };
  }

  getAllTracks(): AudioTrack[] {
    const rows = this.db.prepare(
      "SELECT id, file_path, pairs_json, created_at FROM audio_tracks ORDER BY id"
    ).all() as { id: number; file_path: string; pairs_json: string; created_at: number }[];

    return rows.map(row => ({
      id: row.id,
      filePath: row.file_path,
      pairs: JSON.parse(row.pairs_json),
      createdAt: row.created_at,
    }));
  }

  getTrackCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM audio_tracks").get() as { count: number };
    return row.count;
  }

  deleteTrack(id: number): void {
    this.db.prepare("DELETE FROM audio_tracks WHERE id = ?").run(id);
  }

  // User History
  markListened(chatId: number, trackId: number): void {
    const stmt = this.db.prepare(
      "INSERT OR REPLACE INTO user_history (chat_id, track_id, listened_at) VALUES (?, ?, strftime('%s', 'now'))"
    );
    stmt.run(chatId, trackId);
  }

  getListenedTrackIds(chatId: number): number[] {
    const rows = this.db.prepare(
      "SELECT track_id FROM user_history WHERE chat_id = ?"
    ).all(chatId) as { track_id: number }[];
    return rows.map(r => r.track_id);
  }

  getNextUnlistenedTrack(chatId: number): AudioTrack | null {
    const row = this.db.prepare(`
      SELECT t.id, t.file_path, t.pairs_json, t.created_at
      FROM audio_tracks t
      LEFT JOIN user_history h ON t.id = h.track_id AND h.chat_id = ?
      WHERE h.id IS NULL
      ORDER BY t.id
      LIMIT 1
    `).get(chatId) as { id: number; file_path: string; pairs_json: string; created_at: number } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      filePath: row.file_path,
      pairs: JSON.parse(row.pairs_json),
      createdAt: row.created_at,
    };
  }

  getOldestListenedTrack(chatId: number): AudioTrack | null {
    const row = this.db.prepare(`
      SELECT t.id, t.file_path, t.pairs_json, t.created_at
      FROM audio_tracks t
      INNER JOIN user_history h ON t.id = h.track_id AND h.chat_id = ?
      ORDER BY h.listened_at ASC
      LIMIT 1
    `).get(chatId) as { id: number; file_path: string; pairs_json: string; created_at: number } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      filePath: row.file_path,
      pairs: JSON.parse(row.pairs_json),
      createdAt: row.created_at,
    };
  }

  clearUserHistory(chatId: number): void {
    this.db.prepare("DELETE FROM user_history WHERE chat_id = ?").run(chatId);
  }

  // Feedback
  setFeedback(chatId: number, trackId: number, score: number): void {
    const stmt = this.db.prepare(
      "INSERT OR REPLACE INTO track_feedback (chat_id, track_id, score) VALUES (?, ?, ?)"
    );
    stmt.run(chatId, trackId, score);
  }

  getTrackScore(trackId: number): number {
    const row = this.db.prepare(
      "SELECT COALESCE(SUM(score), 0) as total FROM track_feedback WHERE track_id = ?"
    ).get(trackId) as { total: number };
    return row.total;
  }

  getTracksWithLowScore(threshold: number): AudioTrack[] {
    const rows = this.db.prepare(`
      SELECT t.id, t.file_path, t.pairs_json, t.created_at, COALESCE(SUM(f.score), 0) as total_score
      FROM audio_tracks t
      LEFT JOIN track_feedback f ON t.id = f.track_id
      GROUP BY t.id
      HAVING total_score < ?
    `).all(threshold) as { id: number; file_path: string; pairs_json: string; created_at: number }[];

    return rows.map(row => ({
      id: row.id,
      filePath: row.file_path,
      pairs: JSON.parse(row.pairs_json),
      createdAt: row.created_at,
    }));
  }

  close(): void {
    this.db.close();
  }
}
