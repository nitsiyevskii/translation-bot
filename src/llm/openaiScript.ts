import OpenAI from "openai";
import { parsePairs, type Pair } from "./scriptFormat.js";

export type GenerateOptions = {
  itemsPerTrack: number;
  level: string;
  recentAvoidList: string[];
  sourceLangName: string;
  targetLangName: string;
};

export class OpenAiScriptGenerator {
  private client: OpenAI;
  private model: string;

  constructor(opts: { apiKey: string; model: string }) {
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.model = opts.model;
  }

  private buildPrompt(opts: GenerateOptions): string {
    const { itemsPerTrack, level, recentAvoidList, sourceLangName, targetLangName } = opts;

    const avoidSection = recentAvoidList.length > 0
      ? `- DO NOT repeat any ${sourceLangName} entries from this recent list:\n${recentAvoidList.map(w => `  - ${w}`).join("\n")}`
      : "";

    return `
You generate a TTS-ready script for ${sourceLangName} -> ${targetLangName} vocabulary flashcards.

Return PLAIN TEXT ONLY using exactly this structure repeated ${itemsPerTrack} times:

<SOURCE>single word in ${sourceLangName}</SOURCE>
<TARGET>translation in ${targetLangName}</TARGET>

Rules:
- Language level: ${level}
- Only single words, NO phrases or sentences
- Verbs must be in infinitive form
- Nouns in singular form
- Adjectives in base form (masculine singular where applicable)
- Mix nouns, verbs, and adjectives
- Avoid slang
- Do not include numbering, headings, explanations, or extra text
${avoidSection}
`.trim();
  }

  async generate(opts: GenerateOptions): Promise<{ raw: string; pairs: Pair[] }> {
    const prompt = this.buildPrompt(opts);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: "You are a language learning assistant. Follow the formatting rules exactly." },
        { role: "user", content: prompt },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const pairs = parsePairs(raw);

    if (pairs.length === 0) {
      throw new Error("LLM returned no parsable pairs");
    }

    return { raw, pairs };
  }
}
