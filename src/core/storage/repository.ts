/**
 * repository.ts — Unified CRUD interfaces for entity persistence.
 *
 * All storage modules implement IRepository<T> so that services,
 * sync adapters, and tests interact with a single contract.
 */

import type { BaseEntity } from '@core/types/base.types';

// ─── Core repository ─────────────────────────────────────────────────────────

/**
 * Generic CRUD interface for entity persistence.
 * T must have at least `id: string` and `createdAt: string` (via BaseEntity).
 */
export interface IRepository<T extends BaseEntity> {
  /** Retrieve a single entity by ID. Returns null if not found. */
  getById(id: string): Promise<T | null>;

  /** Retrieve all entities. */
  getAll(): Promise<T[]>;

  /** Insert or update an entity (upsert by id). */
  save(entity: T): Promise<void>;

  /** Update specific fields on an existing entity. Returns the updated entity or null if not found. */
  update(id: string, updates: Partial<T>): Promise<T | null>;

  /** Delete an entity by ID. Returns true if an entity was actually deleted. */
  delete(id: string): Promise<boolean>;

  /** Count all entities. */
  count(): Promise<number>;
}

// ─── Extended capabilities ───────────────────────────────────────────────────

/**
 * Repository that supports querying by a secondary index.
 * Used by IndexedDB-backed and NewTabDB-backed repositories.
 */
export interface IIndexedRepository<T extends BaseEntity> extends IRepository<T> {
  getByIndex(indexName: string, value: IDBValidKey | boolean, limit?: number): Promise<T[]>;
}

/**
 * Repository that supports bulk import and full replacement.
 */
export interface IBulkRepository<T extends BaseEntity> extends IRepository<T> {
  /** Merge entities by ID (existing records are overwritten). */
  importMany(entities: T[]): Promise<void>;
  /** Replace the entire dataset. */
  replaceAll(entities: T[]): Promise<void>;
}
