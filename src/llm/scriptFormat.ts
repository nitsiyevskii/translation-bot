export type Pair = { source: string; target: string };

export function parsePairs(scriptText: string): Pair[] {
  const sourceRe = /<SOURCE>([\s\S]*?)<\/SOURCE>/g;
  const targetRe = /<TARGET>([\s\S]*?)<\/TARGET>/g;

  const sources = [...scriptText.matchAll(sourceRe)].map(m => m[1].trim());
  const targets = [...scriptText.matchAll(targetRe)].map(m => m[1].trim());

  const count = Math.min(sources.length, targets.length);
  return Array.from({ length: count }, (_, i) => ({
    source: sources[i],
    target: targets[i],
  }));
}
