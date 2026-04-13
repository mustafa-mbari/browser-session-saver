/**
 * sync-helpers.ts — Shared utilities for SyncableRepository implementations.
 *
 * Each repository class (IndexedDB, ChromeLocalArray, NewTabDB) implements the
 * SyncableRepository contract directly, but they all share the same write-
 * stamping rule: on every mutation stamp `updatedAt = now` and `dirty = true`,
 * defaulting `deletedAt` and `lastSyncedAt` so they exist on every row.
 */

import type { BaseEntity, SyncableEntity } from '@core/types/base.types';

/**
 * Stamps sync metadata on an entity being saved via a normal repository call.
 * - `updatedAt` is overwritten with `now` (callers that want to preserve a
 *   specific timestamp must use `applyRemote()` instead).
 * - `dirty` is set to true so the next sync cycle picks the row up.
 * - `deletedAt` and `lastSyncedAt` default to null when missing.
 *
 * No-op for entities that don't carry an `updatedAt` slot (preserves
 * backwards-compat for non-synced stores).
 */
export function stampForWrite<T extends BaseEntity>(entity: T): T {
  const e = entity as unknown as SyncableEntity;
  if (typeof e.updatedAt !== 'string' && !('updatedAt' in e)) return entity;
  const now = new Date().toISOString();
  return {
    ...entity,
    updatedAt: now,
    dirty: true,
    deletedAt: e.deletedAt ?? null,
    lastSyncedAt: e.lastSyncedAt ?? null,
  } as T;
}
