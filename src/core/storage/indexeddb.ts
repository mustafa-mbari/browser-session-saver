import type { IStorage } from './storage.interface';

const DB_NAME = 'browser-hub';
const DB_VERSION = 2;
const STORE_NAME = 'sessions';

export class IndexedDBAdapter implements IStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = event.oldVersion;

        if (oldVersion < 1) {
          const store = db.createObjectStore(STORE_NAME);
          store.createIndex('isAutoSave', 'isAutoSave', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        } else if (oldVersion < 2) {
          // v1 → v2 migration: add indexes to existing store
          const tx = (event.target as IDBOpenDBRequest).transaction!;
          const store = tx.objectStore(STORE_NAME);
          if (!store.indexNames.contains('isAutoSave')) {
            store.createIndex('isAutoSave', 'isAutoSave', { unique: false });
          }
          if (!store.indexNames.contains('createdAt')) {
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        // Clear cached promise if the connection closes unexpectedly (e.g. SW suspension)
        db.onclose = () => { this.dbPromise = null; };
        // Clear cached promise and close if another context upgrades the DB version
        db.onversionchange = () => { db.close(); this.dbPromise = null; };
        resolve(db);
      };
      request.onerror = () => {
        this.dbPromise = null; // Clear cache so the next call can retry
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(): Promise<Record<string, unknown>> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const keysReq = store.getAllKeys();
      const valsReq = store.getAll();

      tx.oncomplete = () => {
        const keys = keysReq.result as string[];
        const vals = valsReq.result;
        const result: Record<string, unknown> = {};
        for (let i = 0; i < keys.length; i++) {
          result[keys[i]] = vals[i];
        }
        resolve(result);
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  async getByIndex<T>(indexName: string, value: IDBValidKey | boolean, limit?: number): Promise<T[]> {
    // Booleans are not valid IDB keys (only number/string/Date/ArrayBuffer/Array are).
    // Fall back to loading all records and filtering in JS.
    if (typeof value === 'boolean') {
      const all = await this.getAll();
      const filtered = Object.values(all).filter(
        (item) => (item as Record<string, unknown>)[indexName] === value,
      ) as T[];
      return limit !== undefined ? filtered.slice(0, limit) : filtered;
    }

    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index(indexName);
      const request = index.getAll(value, limit);
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUsedBytes(): Promise<number> {
    try {
      const estimate = await navigator.storage.estimate();
      return estimate.usage ?? 0;
    } catch {
      return 0;
    }
  }

  async count(): Promise<number> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
