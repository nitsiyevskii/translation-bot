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
Generate ${itemsPerTrack} vocabulary words for ${sourceLangName} -> ${targetLangName} flashcards.

Format each entry exactly like this:
<SOURCE>word</SOURCE>
<TARGET>translation</TARGET>

STRICT RULES:
- ONLY ONE WORD per entry - never two or more words
- NO phrases like "to be", "por favor", "buenos días" - these are FORBIDDEN
- Verbs: infinitive only (e.g. "comer" not "to eat", "hablar" not "to speak")
- Nouns: singular form only
- Adjectives: base form only
- Level: ${level}
- No slang, no numbering, no explanations
${avoidSection}
`.trim();
  }

  async generate(opts: GenerateOptions): Promise<{ raw: string; pairs: Pair[] }> {
    const prompt = this.buildPrompt(opts);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: "You are a vocabulary generator. Output ONLY single words, never phrases. Follow rules exactly." },
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
