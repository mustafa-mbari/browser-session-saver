/**
 * wrap-mapper.ts — Adapter from the legacy `RowMapper<T>` (used by the old
 * SyncAdapter) to the new handler-style `toRemote`/`fromRemote` pair with
 * the added soft-delete columns (`deleted_at`, `dirty` stripped, `updated_at`
 * preserved on write).
 *
 * Why wrap rather than rewrite: the legacy mappers are well-tested and
 * comprehensive. This adapter layers the soft-delete round-trip on top so
 * handlers stay tiny.
 */

import type { BaseEntity, RowMapper, Syncable } from '@core/types/base.types';
import type { SyncableEntity } from '../types/syncable';

type WrappedMapper<T extends Syncable & SyncableEntity & BaseEntity> = {
  toRemote(entity: T, userId: string): Record<string, unknown>;
  fromRemote(row: Record<string, unknown>): T;
};

export function wrapMapper<T extends Syncable & SyncableEntity & BaseEntity>(
  base: RowMapper<T>,
): WrappedMapper<T> {
  return {
    toRemote(entity, userId) {
      const row = base.toRow(entity, userId);
      // Carry soft-delete metadata to the server. `updated_at` is always
      // stamped by the BEFORE UPDATE trigger, so sending our value is only
      // advisory — we keep the field because upsert() requires ALL columns
      // that participate in conflict resolution to be present.
      row['deleted_at'] = entity.deletedAt ?? null;
      if (entity.updatedAt) row['updated_at'] = entity.updatedAt;
      return row;
    },

    fromRemote(row) {
      const base_ = base.fromRow(row);
      return {
        ...base_,
        updatedAt: (row.updated_at as string) ?? base_.updatedAt,
        deletedAt: (row.deleted_at as string | null | undefined) ?? null,
        dirty: false,
        lastSyncedAt: null,
      };
    },
  };
}
