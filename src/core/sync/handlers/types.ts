/**
 * handlers/types.ts — Contract for per-entity sync handlers.
 *
 * One handler per SyncEntityKey. Each handler knows:
 *   - which Supabase table this entity lives in
 *   - which SyncableRepository to read/write locally
 *   - how to map a local entity to a Supabase row, and vice versa
 *   - optional pre-transform (URL filter, trim, etc.) before mapping
 *   - optional validation (returns null = ok, string = reason to skip)
 *
 * The SyncEngine iterates handlers in a hardcoded ORDER (parent → child)
 * and runs the same delta push/pull algorithm for every one — handlers
 * provide only the entity-specific pieces.
 */

import type { BaseEntity } from '@core/types/base.types';
import type { SyncEntityKey, SyncableEntity } from '../types/syncable';

/**
 * Minimal subset of the SyncableRepository contract that the engine needs.
 * Defined locally so handlers don't accidentally tie themselves to one
 * specific repository implementation.
 */
export interface HandlerRepository<T extends SyncableEntity> {
  getAllWithOptions(opts?: { includeDeleted?: boolean }): Promise<T[]>;
  getDirty(): Promise<T[]>;
  markSynced(id: string, serverUpdatedAt: string): Promise<void>;
  applyRemote(remote: T): Promise<void>;
  purgeDeleted(beforeTs: string): Promise<number>;
}

export interface EntitySyncHandler<T extends SyncableEntity & BaseEntity> {
  readonly key: SyncEntityKey;
  readonly tableName: string;
  readonly repo: HandlerRepository<T>;

  /** Map a local entity → a Supabase row object (snake_case column names). */
  toRemote(entity: T, userId: string): Record<string, unknown>;

  /** Map a Supabase row object → a local entity (camelCase). */
  fromRemote(row: Record<string, unknown>): T;

  /**
   * Optional cleanup applied to a local entity before toRemote().
   * Examples: strip internal URLs, clamp array sizes, strip html.
   */
  preTransform?(entity: T): T;

  /**
   * Optional pre-push validator.
   * Return `null` to accept. Return a string to skip the record AND log
   * the reason. Useful for rejecting obviously-corrupt rows instead of
   * push-retrying them forever.
   */
  validate?(entity: T): string | null;
}
