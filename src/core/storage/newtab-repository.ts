/**
 * newtab-repository.ts — IRepository implementation backed by NewTabDB.
 *
 * Wraps the existing NewTabDB singleton for a specific object store,
 * conforming to IRepository/IIndexedRepository.
 * Used by: Bookmarks (boards, categories, entries), Todos (lists, items).
 */

import type { BaseEntity } from '@core/types/base.types';
import type { IIndexedRepository, IBulkRepository } from './repository';
import type { NewTabDB } from './newtab-storage';

export class NewTabDBRepository<T extends { id: string }>
  implements IIndexedRepository<T & BaseEntity>, IBulkRepository<T & BaseEntity>
{
  constructor(
    private readonly db: NewTabDB,
    private readonly storeName: string,
  ) {}

  async getById(id: string): Promise<(T & BaseEntity) | null> {
    return this.db.get<T & BaseEntity>(this.storeName, id);
  }

  async getAll(): Promise<(T & BaseEntity)[]> {
    return this.db.getAll<T & BaseEntity>(this.storeName);
  }

  async save(entity: T & BaseEntity): Promise<void> {
    await this.db.put(this.storeName, entity);
  }

  async update(id: string, updates: Partial<T & BaseEntity>): Promise<(T & BaseEntity) | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    await this.db.put(this.storeName, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await this.db.delete(this.storeName, id);
    return true;
  }

  async count(): Promise<number> {
    const all = await this.db.getAll(this.storeName);
    return all.length;
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
    return limit ? results.slice(0, limit) : results;
  }

  async importMany(entities: (T & BaseEntity)[]): Promise<void> {
    await Promise.all(entities.map((e) => this.db.put(this.storeName, e)));
  }

  async replaceAll(entities: (T & BaseEntity)[]): Promise<void> {
    // Clear existing data and re-insert
    const existing = await this.getAll();
    await Promise.all(existing.map((e) => this.db.delete(this.storeName, e.id)));
    await Promise.all(entities.map((e) => this.db.put(this.storeName, e)));
  }
}
