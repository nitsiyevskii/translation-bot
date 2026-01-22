import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import type { DatabaseService } from "../db/database.js";
import type { OpenAiScriptGenerator } from "../llm/openaiScript.js";
import type { GoogleTts } from "../tts/googleTts.js";
import { buildSsml } from "../tts/ssml.js";
import type { Pair } from "../llm/scriptFormat.js";

export type AudioLibraryConfig = {
  audioDir: string;
  targetSize: number;
  itemsPerTrack: number;
  level: string;
  pauseThink: number;
  pauseBetween: number;
  sourceLanguage: { name: string; voiceName: string };
  targetLanguage: { name: string; voiceName: string };
  lowScoreThreshold: number;
};

export class AudioLibrary {
  private db: DatabaseService;
  private scriptGen: OpenAiScriptGenerator;
  private tts: GoogleTts;
  private config: AudioLibraryConfig;

  constructor(
    db: DatabaseService,
    scriptGen: OpenAiScriptGenerator,
    tts: GoogleTts,
    config: AudioLibraryConfig
  ) {
    this.db = db;
    this.scriptGen = scriptGen;
    this.tts = tts;
    this.config = config;

    if (!fs.existsSync(config.audioDir)) {
      fs.mkdirSync(config.audioDir, { recursive: true });
    }
  }

  private async generateSingleTrack(): Promise<{ filePath: string; pairs: Pair[] }> {
    const existingTracks = this.db.getAllTracks();
    const recentWords = existingTracks.flatMap(t => t.pairs.map(p => p.source));

    const { pairs } = await this.scriptGen.generate({
      itemsPerTrack: this.config.itemsPerTrack,
      level: this.config.level,
      recentAvoidList: recentWords.slice(-200),
      sourceLangName: this.config.sourceLanguage.name,
      targetLangName: this.config.targetLanguage.name,
    });

    const ssml = buildSsml(pairs, {
      pauseThink: this.config.pauseThink,
      pauseBetween: this.config.pauseBetween,
      sourceVoice: this.config.sourceLanguage.voiceName,
      targetVoice: this.config.targetLanguage.voiceName,
    });

    const mp3Buffer = await this.tts.synthesizeMp3FromSsml(ssml);
    const filePath = this.saveMp3AsOgg(mp3Buffer);

    return { filePath, pairs };
  }

  private saveMp3AsOgg(mp3Buffer: Buffer): string {
    const id = crypto.randomBytes(8).toString("hex");
    const mp3Path = path.join(this.config.audioDir, `temp-${id}.mp3`);
    const oggPath = path.join(this.config.audioDir, `track-${id}.ogg`);

    fs.writeFileSync(mp3Path, mp3Buffer);

    try {
      execSync(`ffmpeg -y -i "${mp3Path}" -c:a libopus -b:a 48k -vbr on "${oggPath}"`, {
        stdio: "ignore",
      });
    } finally {
      if (fs.existsSync(mp3Path)) {
        fs.unlinkSync(mp3Path);
      }
    }

    return oggPath;
  }

  async ensureLibrarySize(): Promise<number> {
    const currentCount = this.db.getTrackCount();
    const needed = this.config.targetSize - currentCount;

    if (needed <= 0) {
      console.log(`Library has ${currentCount} tracks, no generation needed`);
      return 0;
    }

    console.log(`Generating ${needed} tracks to reach target of ${this.config.targetSize}...`);

    let generated = 0;
    for (let i = 0; i < needed; i++) {
      try {
        const { filePath, pairs } = await this.generateSingleTrack();
        this.db.addTrack(filePath, pairs);
        generated++;
        console.log(`Generated track ${generated}/${needed}`);
      } catch (err) {
        console.error(`Failed to generate track ${i + 1}:`, err);
      }
    }

    return generated;
  }

  async cleanupLowScoreTracks(): Promise<number> {
    const lowScoreTracks = this.db.getTracksWithLowScore(this.config.lowScoreThreshold);

    if (lowScoreTracks.length === 0) {
      console.log("No low-score tracks to clean up");
      return 0;
    }

    console.log(`Cleaning up ${lowScoreTracks.length} tracks with score < ${this.config.lowScoreThreshold}...`);

    for (const track of lowScoreTracks) {
      if (fs.existsSync(track.filePath)) {
        fs.unlinkSync(track.filePath);
      }
      this.db.deleteTrack(track.id);
      console.log(`Deleted track ${track.id}`);
    }

    return lowScoreTracks.length;
  }

  async runMaintenance(): Promise<{ deleted: number; generated: number }> {
    console.log("Running library maintenance...");

    const deleted = await this.cleanupLowScoreTracks();
    const generated = await this.ensureLibrarySize();

    console.log(`Maintenance complete: deleted ${deleted}, generated ${generated}`);
    return { deleted, generated };
  }

  getTrackCount(): number {
    return this.db.getTrackCount();
  }
}
