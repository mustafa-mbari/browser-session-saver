/**
 * newtab-repository.ts — IRepository implementation backed by NewTabDB.
 *
 * Wraps the existing NewTabDB singleton for a specific object store,
 * conforming to IRepository/IIndexedRepository.
 * Used by: Bookmarks (boards, categories, entries), Todos (lists, items).
 */

import type { BaseEntity, SyncableEntity } from '@core/types/base.types';
import type { IIndexedRepository, IBulkRepository, ReadOptions } from './repository';
import type { NewTabDB } from './newtab-storage';

export class NewTabDBRepository<T extends { id: string }>
  implements IIndexedRepository<T & BaseEntity>, IBulkRepository<T & BaseEntity>
{
  constructor(
    private readonly db: NewTabDB,
    private readonly storeName: string,
  ) {}

  async getById(id: string): Promise<(T & BaseEntity) | null> {
    const row = await this.getByIdRaw(id);
    if (!row) return null;
    if ((row as unknown as SyncableEntity).deletedAt) return null;
    return row;
  }

  async getAll(): Promise<(T & BaseEntity)[]> {
    const all = await this.db.getAll<T & BaseEntity>(this.storeName);
    return all.filter((e) => !(e as unknown as SyncableEntity).deletedAt);
  }

  async getAllWithOptions(opts?: ReadOptions): Promise<(T & BaseEntity)[]> {
    if (opts?.includeDeleted) return this.db.getAll<T & BaseEntity>(this.storeName);
    return this.getAll();
  }

  private async getByIdRaw(id: string): Promise<(T & BaseEntity) | null> {
    return this.db.get<T & BaseEntity>(this.storeName, id);
  }

  async save(entity: T & BaseEntity): Promise<void> {
    const stamped = entity;
    await this.db.put(this.storeName, stamped);
  }

  async update(id: string, updates: Partial<T & BaseEntity>): Promise<(T & BaseEntity) | null> {
    const existing = await this.getByIdRaw(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates } as T & BaseEntity;
    await this.save(merged);
    return merged;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getByIdRaw(id);
    if (!existing) return false;
    await this.db.delete(this.storeName, id);
    return true;
  }

  async count(): Promise<number> {
    const all = await this.db.getAll<T & BaseEntity>(this.storeName);
    return all.filter((e) => !(e as unknown as SyncableEntity).deletedAt).length;
  }

  async getByIndex(indexName: string, value: IDBValidKey | boolean, limit?: number): Promise<(T & BaseEntity)[]> {
    if (typeof value === 'boolean') {
      const all = await this.getAll();
      const filtered = all.filter(
        (item) => (item as unknown as Record<string, unknown>)[indexName] === value,
      );
      return limit ? filtered.slice(0, limit) : filtered;
    }
    const results = await this.db.getAllByIndex<T & BaseEntity>(this.storeName, indexName, value as string);
    const live = results.filter((e) => !(e as unknown as SyncableEntity).deletedAt);
    return limit ? live.slice(0, limit) : live;
  }

  async importMany(entities: (T & BaseEntity)[]): Promise<void> {
    await Promise.all(entities.map((e) => this.db.put(this.storeName, e)));
  }

  async replaceAll(entities: (T & BaseEntity)[]): Promise<void> {
    const existing = await this.db.getAll<T & BaseEntity>(this.storeName);
    await Promise.all(existing.map((e) => this.db.delete(this.storeName, e.id)));
    await Promise.all(entities.map((e) => this.db.put(this.storeName, e)));
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
    } as T & BaseEntity;
    await this.db.put(this.storeName, tombstoned);
    return true;
  }

  async getDirty(): Promise<(T & BaseEntity)[]> {
    const all = await this.db.getAll<T & BaseEntity>(this.storeName);
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
    } as T & BaseEntity;
    await this.db.put(this.storeName, cleaned);
  }

  async applyRemote(remote: T & BaseEntity): Promise<void> {
    const cleaned = {
      ...remote,
      dirty: false,
      lastSyncedAt: new Date().toISOString(),
    } as T & BaseEntity;
    await this.db.put(this.storeName, cleaned);
  }

  async purgeDeleted(beforeTs: string): Promise<number> {
    const all = await this.db.getAll<T & BaseEntity>(this.storeName);
    const doomed = all.filter((e) => {
      const s = e as unknown as SyncableEntity;
      return s.deletedAt != null && s.deletedAt < beforeTs;
    });
    await Promise.all(doomed.map((e) => this.db.delete(this.storeName, e.id)));
    return doomed.length;
  }
}
