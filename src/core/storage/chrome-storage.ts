import type { IStorage } from './storage.interface';

export class ChromeStorageAdapter implements IStorage {
  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  async getAll(): Promise<Record<string, unknown>> {
    return chrome.storage.local.get(null);
  }

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  }

  async getUsedBytes(): Promise<number> {
    return chrome.storage.local.getBytesInUse(null);
  }
}
