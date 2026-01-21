import type { Pair } from "../llm/scriptFormat.js";

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export type SsmlOptions = {
  pauseThink: string;
  pauseBetween: string;
  sourceVoice: string;
  targetVoice: string;
};

export function buildSsml(pairs: Pair[], opts: SsmlOptions): string {
  const parts: string[] = ["<speak>"];

  for (const { source, target } of pairs) {
    parts.push(`<voice name="${opts.sourceVoice}">${escapeXml(source)}</voice>`);
    parts.push(`<break time="${opts.pauseThink}"/>`);
    parts.push(`<voice name="${opts.targetVoice}">${escapeXml(target)}</voice>`);
    parts.push(`<break time="${opts.pauseBetween}"/>`);
  }

  parts.push("</speak>");
  return parts.join("");
}
