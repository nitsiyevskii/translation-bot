export class RecentStore {
  private maxRecent: number;
  private wordsByChat = new Map<number, string[]>();

  constructor(opts?: { maxRecent?: number }) {
    this.maxRecent = opts?.maxRecent ?? 200;
  }

  getRecent(chatId: number, count = 120): string[] {
    const words = this.wordsByChat.get(chatId) ?? [];
    return words.slice(-count);
  }

  addMany(chatId: number, words: string[]): void {
    const normalized = words
      .map(word => word?.trim().toLowerCase())
      .filter(Boolean);

    const existing = this.wordsByChat.get(chatId) ?? [];
    existing.push(...normalized);

    const pruned = existing.slice(-this.maxRecent);
    this.wordsByChat.set(chatId, pruned);
  }
}
