/**
 * resolver.ts — Last-Write-Wins conflict resolver for SyncableEntity pairs.
 *
 * Strategy:
 *   1. If only one side exists, that side wins.
 *   2. Tombstones beat updates whose `updatedAt` is strictly older.
 *      (A `remote.updatedAt == local.updatedAt` tie with one tombstone → the
 *      tombstone wins because `>=` is intentional: the tombstone edit is the
 *      more recent user intent.)
 *   3. Otherwise compare `updatedAt` numerically.
 *   4. Exact-tie tiebreak: lexicographically higher `id` wins. Deterministic.
 *
 * Why LWW and not HLC or field-merge:
 * - Single-user, multi-device. No collaborative editing.
 * - Enforceable client-side via `.lte('updated_at', ...)` guard on push.
 * - Server `BEFORE UPDATE` trigger overwrites `updated_at = NOW()` so server
 *   time is authoritative and bounded NTP drift (~seconds) is irrelevant.
 */

import type { SyncableEntity } from '../types/syncable';

export type Resolution<T> = {
  winner: T | null;
  /** Which side won — used by the engine to decide push vs apply-remote. */
  source: 'local' | 'remote' | 'none';
};

export function resolve<T extends SyncableEntity>(
  local: T | null,
  remote: T | null,
): Resolution<T> {
  if (!local && !remote) return { winner: null, source: 'none' };
  if (!local) return { winner: remote, source: 'remote' };
  if (!remote) return { winner: local, source: 'local' };

  const lt = Date.parse(local.updatedAt);
  const rt = Date.parse(remote.updatedAt);

  // Tombstone precedence: a newer-or-equal delete beats a surviving edit.
  if (remote.deletedAt && !local.deletedAt && rt >= lt) {
    return { winner: remote, source: 'remote' };
  }
  if (local.deletedAt && !remote.deletedAt && lt >= rt) {
    return { winner: local, source: 'local' };
  }

  if (rt > lt) return { winner: remote, source: 'remote' };
  if (lt > rt) return { winner: local, source: 'local' };

  // Exact tie on updatedAt — deterministic by id.
  return local.id >= remote.id
    ? { winner: local, source: 'local' }
    : { winner: remote, source: 'remote' };
}
