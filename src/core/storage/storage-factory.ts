import type { IStorage } from './storage.interface';
import { ChromeStorageAdapter } from './chrome-storage';
import { IndexedDBAdapter } from './indexeddb';

let _settingsStorage: IStorage | null = null;
let _sessionStorage: IStorage | null = null;

export function getSettingsStorage(): IStorage {
  if (!_settingsStorage) {
    _settingsStorage = new ChromeStorageAdapter();
  }
  return _settingsStorage;
}

export function getSessionStorage(): IStorage {
  if (!_sessionStorage) {
    _sessionStorage = new IndexedDBAdapter();
  }
  return _sessionStorage;
}
