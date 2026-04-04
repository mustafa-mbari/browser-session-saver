/**
 * chrome-local-array-repository.ts — IRepository implementation backed
 * by chrome.storage.local via ChromeLocalKeyAdapter.
 *
 * Stores an entire array of entities under a single key.
 * Used by: Subscriptions, Prompts (×4 adapters), Tab Groups.
 */

import type { BaseEntity } from '@core/types/base.types';
import type { IRepository, IBulkRepository } from './repository';
import { ChromeLocalKeyAdapter } from './chrome-local-key-adapter';

export class ChromeLocalArrayRepository<T extends BaseEntity>
  implements IRepository<T>, IBulkRepository<T>
{
  private readonly adapter: ChromeLocalKeyAdapter<T>;

  constructor(storageKey: string) {
    this.adapter = new ChromeLocalKeyAdapter<T>(storageKey);
  }

  async getById(id: string): Promise<T | null> {
    const all = await this.adapter.getAll();
    return all.find((item) => item.id === id) ?? null;
  }

  async getAll(): Promise<T[]> {
    return this.adapter.getAll();
  }

  async save(entity: T): Promise<void> {
    const all = await this.adapter.getAll();
    const idx = all.findIndex((item) => item.id === entity.id);
    if (idx >= 0) {
      all[idx] = entity;
    } else {
      all.push(entity);
    }
    await this.adapter.setAll(all);
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    const all = await this.adapter.getAll();
    const idx = all.findIndex((item) => item.id === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], ...updates };
    await this.adapter.setAll(all);
    return all[idx];
  }

  async delete(id: string): Promise<boolean> {
    const all = await this.adapter.getAll();
    const filtered = all.filter((item) => item.id !== id);
    if (filtered.length === all.length) return false;
    await this.adapter.setAll(filtered);
    return true;
  }

  async count(): Promise<number> {
    const all = await this.adapter.getAll();
    return all.length;
  }

  async importMany(entities: T[]): Promise<void> {
    const all = await this.adapter.getAll();
    const map = new Map(all.map((item) => [item.id, item]));
    for (const entity of entities) {
      map.set(entity.id, entity);
    }
    await this.adapter.setAll(Array.from(map.values()));
  }

  async replaceAll(entities: T[]): Promise<void> {
    await this.adapter.setAll(entities);
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

  constructor(
    storageKey: string,
    private readonly keyField: keyof T & string,
  ) {
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
    const all = await this.adapter.getAll();
    const key = this.getKey(entity as T);
    const idx = all.findIndex((item) => this.getKey(item) === key);
    if (idx >= 0) {
      all[idx] = entity as T;
    } else {
      all.push(entity as T);
    }
    await this.adapter.setAll(all);
  }

  async update(id: string, updates: Partial<T & BaseEntity>): Promise<(T & BaseEntity) | null> {
    const all = await this.adapter.getAll();
    const idx = all.findIndex((item) => this.getKey(item) === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], ...updates };
    await this.adapter.setAll(all);
    return all[idx] as T & BaseEntity;
  }

  async delete(id: string): Promise<boolean> {
    const all = await this.adapter.getAll();
    const filtered = all.filter((item) => this.getKey(item) !== id);
    if (filtered.length === all.length) return false;
    await this.adapter.setAll(filtered);
    return true;
  }

  async count(): Promise<number> {
    const all = await this.adapter.getAll();
    return all.length;
  }

  async importMany(entities: (T & BaseEntity)[]): Promise<void> {
    const all = await this.adapter.getAll();
    const map = new Map(all.map((item) => [this.getKey(item), item]));
    for (const entity of entities) {
      map.set(this.getKey(entity as T), entity as T);
    }
    await this.adapter.setAll(Array.from(map.values()));
  }

  async replaceAll(entities: (T & BaseEntity)[]): Promise<void> {
    await this.adapter.setAll(entities as T[]);
  }
}
