import { TextToSpeechClient } from "@google-cloud/text-to-speech";

export class GoogleTts {
  private client: TextToSpeechClient;

  constructor() {
    this.client = new TextToSpeechClient();
  }

  async synthesizeMp3FromSsml(ssml: string): Promise<Buffer> {
    const [response] = await this.client.synthesizeSpeech({
      input: { ssml },
      voice: { languageCode: "en-US" },
      audioConfig: { audioEncoding: "MP3" },
    });

    if (!response.audioContent) {
      throw new Error("Google TTS returned empty audio content");
    }

    return Buffer.from(response.audioContent as Uint8Array);
  }
}
