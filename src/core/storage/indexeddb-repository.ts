/**
 * indexeddb-repository.ts — IRepository implementation backed by IndexedDB.
 *
 * Wraps the same IDB logic as the existing IndexedDBAdapter but conforms
 * to the IRepository/IIndexedRepository/IBulkRepository interfaces.
 * Used by: Sessions.
 */

import type { BaseEntity } from '@core/types/base.types';
import type { IIndexedRepository, IBulkRepository } from './repository';

export interface IndexedDBRepositoryConfig {
  dbName: string;
  dbVersion: number;
  storeName: string;
  onUpgrade: (db: IDBDatabase, oldVersion: number, tx: IDBTransaction) => void;
  /**
   * When true, the object store uses out-of-line keys (no keyPath).
   * The entity's `id` property is passed as a separate key argument
   * to `store.put(value, key)`. This is required for the `browser-hub`
   * sessions store which was created without a keyPath.
   *
   * When false (default), the store uses inline keys via keyPath
   * and `store.put(entity)` is sufficient.
   */
  outOfLineKeys?: boolean;
}

export class IndexedDBRepository<T extends BaseEntity>
  implements IIndexedRepository<T>, IBulkRepository<T>
{
  private _db: IDBDatabase | null = null;
  private readonly config: IndexedDBRepositoryConfig;

  constructor(config: IndexedDBRepositoryConfig) {
    this.config = config;
  }

  private open(): Promise<IDBDatabase> {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.config.dbName, this.config.dbVersion);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        const tx = req.transaction!;
        this.config.onUpgrade(db, event.oldVersion, tx);
      };
      req.onsuccess = () => {
        this._db = req.result;
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getById(id: string): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, 'readonly');
      const store = tx.objectStore(this.config.storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, 'readonly');
      const store = tx.objectStore(this.config.storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  async save(entity: T): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, 'readwrite');
      const store = tx.objectStore(this.config.storeName);
      const req = this.config.outOfLineKeys
        ? store.put(entity, entity.id)
        : store.put(entity);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    await this.save(updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, 'readwrite');
      const store = tx.objectStore(this.config.storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async count(): Promise<number> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, 'readonly');
      const store = tx.objectStore(this.config.storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getByIndex(indexName: string, value: IDBValidKey | boolean, limit?: number): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, 'readonly');
      const store = tx.objectStore(this.config.storeName);

      // IDB doesn't natively support boolean indexes — fall back to JS filtering
      if (typeof value === 'boolean') {
        const req = store.getAll();
        req.onsuccess = () => {
          const all = (req.result as T[]) ?? [];
          const filtered = all.filter(
            (item) => (item as Record<string, unknown>)[indexName] === value,
          );
          resolve(limit ? filtered.slice(0, limit) : filtered);
        };
        req.onerror = () => reject(req.error);
        return;
      }

      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => {
        const results = (req.result as T[]) ?? [];
        resolve(limit ? results.slice(0, limit) : results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async importMany(entities: T[]): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, 'readwrite');
      const store = tx.objectStore(this.config.storeName);
      for (const entity of entities) {
        if (this.config.outOfLineKeys) {
          store.put(entity, entity.id);
        } else {
          store.put(entity);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async replaceAll(entities: T[]): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, 'readwrite');
      const store = tx.objectStore(this.config.storeName);
      store.clear();
      for (const entity of entities) {
        if (this.config.outOfLineKeys) {
          store.put(entity, entity.id);
        } else {
          store.put(entity);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
