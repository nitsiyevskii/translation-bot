import type { SettingsLimits } from "../config.js";

export type ChatSettings = {
  pauseThink: number;      // seconds
  pauseBetween: number;    // seconds
  itemsPerTrack: number;
};

export class SettingsStore {
  private defaults: ChatSettings;
  private limits: SettingsLimits;
  private settingsByChat = new Map<number, ChatSettings>();

  constructor(defaults: ChatSettings, limits: SettingsLimits) {
    this.defaults = defaults;
    this.limits = limits;
  }

  get(chatId: number): ChatSettings {
    return this.settingsByChat.get(chatId) ?? { ...this.defaults };
  }

  adjustPauseThink(chatId: number, delta: number): number {
    const current = this.get(chatId);
    const newValue = Math.max(this.limits.pauseThinkMin, Math.min(this.limits.pauseThinkMax, current.pauseThink + delta));
    this.settingsByChat.set(chatId, { ...current, pauseThink: newValue });
    return newValue;
  }

  adjustPauseBetween(chatId: number, delta: number): number {
    const current = this.get(chatId);
    const newValue = Math.max(this.limits.pauseBetweenMin, Math.min(this.limits.pauseBetweenMax, current.pauseBetween + delta));
    this.settingsByChat.set(chatId, { ...current, pauseBetween: newValue });
    return newValue;
  }

  adjustItems(chatId: number, delta: number): number {
    const current = this.get(chatId);
    const newValue = Math.max(this.limits.itemsMin, Math.min(this.limits.itemsMax, current.itemsPerTrack + delta));
    this.settingsByChat.set(chatId, { ...current, itemsPerTrack: newValue });
    return newValue;
  }
}
