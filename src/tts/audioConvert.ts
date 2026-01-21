import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

export function mp3BufferToOggOpusFile(mp3Buffer: Buffer): string {
  const id = crypto.randomBytes(8).toString("hex");
  const tempDir = os.tmpdir();
  const mp3Path = path.join(tempDir, `audio-${id}.mp3`);
  const oggPath = path.join(tempDir, `audio-${id}.ogg`);

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
