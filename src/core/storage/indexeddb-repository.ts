/**
 * indexeddb-repository.ts — IRepository implementation backed by IndexedDB.
 *
 * Wraps the same IDB logic as the existing IndexedDBAdapter but conforms
 * to the IRepository/IIndexedRepository/IBulkRepository interfaces.
 * Used by: Sessions.
 */

import type { BaseEntity, SyncableEntity } from '@core/types/base.types';
import type { IIndexedRepository, IBulkRepository, ReadOptions } from './repository';
import { stampForWrite } from './sync-helpers';

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
  // Soft-delete invariants apply only when T is SyncableEntity; the cast below is
  // safe because the sync engine is the only caller of the SyncableRepository
  // methods and always parameterises the repo with a SyncableEntity subtype.
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
    const row = await this.getByIdRaw(id);
    if (!row) return null;
    if ((row as unknown as SyncableEntity).deletedAt) return null;
    return row;
  }

  async getAll(): Promise<T[]> {
    const all = await this.getAllRaw();
    return all.filter((e) => !(e as unknown as SyncableEntity).deletedAt);
  }

  /** Returns all rows including soft-deleted — sync engine use only. */
  private async getAllRaw(): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, 'readonly');
      const store = tx.objectStore(this.config.storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllWithOptions(opts?: ReadOptions): Promise<T[]> {
    if (opts?.includeDeleted) return this.getAllRaw();
    return this.getAll();
  }

  async save(entity: T): Promise<void> {
    const stamped = stampForWrite(entity);
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, 'readwrite');
      const store = tx.objectStore(this.config.storeName);
      const req = this.config.outOfLineKeys
        ? store.put(stamped, stamped.id)
        : store.put(stamped);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    const existing = await this.getByIdRaw(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates } as T;
    await this.save(merged);
    return merged;
  }

  /** getById that includes soft-deleted rows (sync engine internal). */
  private async getByIdRaw(id: string): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, 'readonly');
      const store = tx.objectStore(this.config.storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
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

  // ─── SyncableRepository ──────────────────────────────────────────────────

  async markDeleted(id: string): Promise<boolean> {
    const existing = await this.getByIdRaw(id);
    if (!existing) return false;
    const now = new Date().toISOString();
    const tombstoned = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
      dirty: true,
    } as T;
    await this.putRaw(tombstoned);
    return true;
  }

  async getDirty(): Promise<T[]> {
    const all = await this.getAllRaw();
    return all.filter((e) => (e as unknown as SyncableEntity).dirty === true);
  }

  async markSynced(id: string, serverUpdatedAt: string): Promise<void> {
    const existing = await this.getByIdRaw(id);
    if (!existing) return;
    const cleaned = {
      ...existing,
      dirty: false,
      lastSyncedAt: new Date().toISOString(),
      updatedAt: serverUpdatedAt,
    } as T;
    await this.putRaw(cleaned);
  }

  async applyRemote(remote: T): Promise<void> {
    const cleaned = {
      ...remote,
      dirty: false,
      lastSyncedAt: new Date().toISOString(),
    } as T;
    await this.putRaw(cleaned);
  }

  async purgeDeleted(beforeTs: string): Promise<number> {
    const all = await this.getAllRaw();
    const doomed = all.filter((e) => {
      const s = e as unknown as SyncableEntity;
      return s.deletedAt != null && s.deletedAt < beforeTs;
    });
    if (doomed.length === 0) return 0;
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.config.storeName, 'readwrite');
      const store = tx.objectStore(this.config.storeName);
      for (const e of doomed) store.delete(e.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return doomed.length;
  }

  /** Write WITHOUT stamping (used by sync engine for authoritative writes). */
  private async putRaw(entity: T): Promise<void> {
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
}

