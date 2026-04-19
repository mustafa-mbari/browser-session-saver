/**
 * chrome-local-array-repository.ts — IRepository implementation backed
 * by chrome.storage.local via ChromeLocalKeyAdapter.
 *
 * Stores an entire array of entities under a single key.
 * Used by: Subscriptions, Prompts (×4 adapters), Tab Groups.
 */

import type { BaseEntity, SyncableEntity } from '@core/types/base.types';
import type { IRepository, IBulkRepository, ReadOptions } from './repository';
import { ChromeLocalKeyAdapter } from './chrome-local-key-adapter';
import { withStorageLock } from './storage-mutex';

export class ChromeLocalArrayRepository<T extends BaseEntity>
  implements IRepository<T>, IBulkRepository<T>
{
  private readonly adapter: ChromeLocalKeyAdapter<T>;
  private readonly storageKey: string;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
    this.adapter = new ChromeLocalKeyAdapter<T>(storageKey);
  }

  async getById(id: string): Promise<T | null> {
    const row = await this.getByIdRaw(id);
    if (!row) return null;
    if ((row as unknown as SyncableEntity).deletedAt) return null;
    return row;
  }

  async getAll(): Promise<T[]> {
    const all = await this.adapter.getAll();
    return all.filter((e) => !(e as unknown as SyncableEntity).deletedAt);
  }

  async getAllWithOptions(opts?: ReadOptions): Promise<T[]> {
    if (opts?.includeDeleted) return this.adapter.getAll();
    return this.getAll();
  }

  private async getByIdRaw(id: string): Promise<T | null> {
    const all = await this.adapter.getAll();
    return all.find((item) => item.id === id) ?? null;
  }

  async save(entity: T): Promise<void> {
    return withStorageLock(this.storageKey, async () => {
      const stamped = entity;
      const all = await this.adapter.getAll();
      const idx = all.findIndex((item) => item.id === stamped.id);
      if (idx >= 0) {
        all[idx] = stamped;
      } else {
        all.push(stamped);
      }
      await this.adapter.setAll(all);
    });
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    return withStorageLock(this.storageKey, async () => {
      const all = await this.adapter.getAll();
      const idx = all.findIndex((item) => item.id === id);
      if (idx < 0) return null;
      const merged = { ...all[idx], ...updates } as T;
      all[idx] = merged;
      await this.adapter.setAll(all);
      return merged;
    });
  }

  async delete(id: string): Promise<boolean> {
    return withStorageLock(this.storageKey, async () => {
      const all = await this.adapter.getAll();
      const filtered = all.filter((item) => item.id !== id);
      if (filtered.length === all.length) return false;
      await this.adapter.setAll(filtered);
      return true;
    });
  }

  async count(): Promise<number> {
    const all = await this.adapter.getAll();
    return all.filter((e) => !(e as unknown as SyncableEntity).deletedAt).length;
  }

  async importMany(entities: T[]): Promise<void> {
    return withStorageLock(this.storageKey, async () => {
      const all = await this.adapter.getAll();
      const map = new Map(all.map((item) => [item.id, item]));
      for (const entity of entities) {
        map.set(entity.id, entity);
      }
      await this.adapter.setAll(Array.from(map.values()));
    });
  }

  async replaceAll(entities: T[]): Promise<void> {
    return withStorageLock(this.storageKey, async () => {
      await this.adapter.setAll(entities);
    });
  }

  // ─── SyncableRepository ──────────────────────────────────────────────────

  async markDeleted(id: string): Promise<boolean> {
    return withStorageLock(this.storageKey, async () => {
      const all = await this.adapter.getAll();
      const idx = all.findIndex((item) => item.id === id);
      if (idx < 0) return false;
      const now = new Date().toISOString();
      all[idx] = {
        ...all[idx],
        deletedAt: now,
        updatedAt: now,
        dirty: true,
      } as T;
      await this.adapter.setAll(all);
      return true;
    });
  }

  async getDirty(): Promise<T[]> {
    const all = await this.adapter.getAll();
    return all.filter((e) => (e as unknown as SyncableEntity).dirty === true);
  }

  async markSynced(id: string, serverUpdatedAt: string): Promise<void> {
    return withStorageLock(this.storageKey, async () => {
      const all = await this.adapter.getAll();
      const idx = all.findIndex((item) => item.id === id);
      if (idx < 0) return;
      all[idx] = {
        ...all[idx],
        dirty: false,
        lastSyncedAt: new Date().toISOString(),
        updatedAt: serverUpdatedAt,
      } as T;
      await this.adapter.setAll(all);
    });
  }

  async applyRemote(remote: T): Promise<void> {
    return withStorageLock(this.storageKey, async () => {
      const all = await this.adapter.getAll();
      const cleaned = {
        ...remote,
        dirty: false,
        lastSyncedAt: new Date().toISOString(),
      } as T;
      const idx = all.findIndex((item) => item.id === cleaned.id);
      if (idx >= 0) all[idx] = cleaned;
      else all.push(cleaned);
      await this.adapter.setAll(all);
    });
  }

  async purgeDeleted(beforeTs: string): Promise<number> {
    return withStorageLock(this.storageKey, async () => {
      const all = await this.adapter.getAll();
      const kept = all.filter((e) => {
        const s = e as unknown as SyncableEntity;
        return !(s.deletedAt != null && s.deletedAt < beforeTs);
      });
      const purged = all.length - kept.length;
      if (purged > 0) await this.adapter.setAll(kept);
      return purged;
    });
  }
}

/**
 * Variant of ChromeLocalArrayRepository for entities that use a non-`id`
 * primary key (e.g. TabGroupTemplate uses `key`).
 */
export class ChromeLocalKeyedRepository<T extends Record<string, unknown>>
  implements IRepository<T & BaseEntity>, IBulkRepository<T & BaseEntity>
{
  private readonly adapter: ChromeLocalKeyAdapter<T>;
  private readonly storageKey: string;

  constructor(
    storageKey: string,
    private readonly keyField: keyof T & string,
  ) {
    this.storageKey = storageKey;
    this.adapter = new ChromeLocalKeyAdapter<T>(storageKey);
  }

  private getKey(entity: T): string {
    return entity[this.keyField] as unknown as string;
  }

  async getById(id: string): Promise<(T & BaseEntity) | null> {
    const all = await this.adapter.getAll();
    return (all.find((item) => this.getKey(item) === id) as (T & BaseEntity) | undefined) ?? null;
  }

  async getAll(): Promise<(T & BaseEntity)[]> {
    return this.adapter.getAll() as Promise<(T & BaseEntity)[]>;
  }

  async save(entity: T & BaseEntity): Promise<void> {
    return withStorageLock(this.storageKey, async () => {
      const all = await this.adapter.getAll();
      const key = this.getKey(entity as T);
      const idx = all.findIndex((item) => this.getKey(item) === key);
      if (idx >= 0) {
        all[idx] = entity as T;
      } else {
        all.push(entity as T);
      }
      await this.adapter.setAll(all);
    });
  }

  async update(id: string, updates: Partial<T & BaseEntity>): Promise<(T & BaseEntity) | null> {
    return withStorageLock(this.storageKey, async () => {
      const all = await this.adapter.getAll();
      const idx = all.findIndex((item) => this.getKey(item) === id);
      if (idx < 0) return null;
      all[idx] = { ...all[idx], ...updates };
      await this.adapter.setAll(all);
      return all[idx] as T & BaseEntity;
    });
  }

  async delete(id: string): Promise<boolean> {
    return withStorageLock(this.storageKey, async () => {
      const all = await this.adapter.getAll();
      const filtered = all.filter((item) => this.getKey(item) !== id);
      if (filtered.length === all.length) return false;
      await this.adapter.setAll(filtered);
      return true;
    });
  }

  async count(): Promise<number> {
    const all = await this.adapter.getAll();
    return all.length;
  }

  async importMany(entities: (T & BaseEntity)[]): Promise<void> {
    return withStorageLock(this.storageKey, async () => {
      const all = await this.adapter.getAll();
      const map = new Map(all.map((item) => [this.getKey(item), item]));
      for (const entity of entities) {
        map.set(this.getKey(entity as T), entity as T);
      }
      await this.adapter.setAll(Array.from(map.values()));
    });
  }

  async replaceAll(entities: (T & BaseEntity)[]): Promise<void> {
    return withStorageLock(this.storageKey, async () => {
      await this.adapter.setAll(entities as T[]);
    });
  }
}
