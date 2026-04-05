/**
 * sync/sync-adapter.ts — Generic entity sync adapter for Supabase.
 *
 * Handles push (upsert), pull (select), and reconcile (delete stale)
 * for any entity that implements the Syncable interface.
 *
 * One instance per entity type, configured with a table name,
 * RowMapper, and optional quota/transform settings.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncAdapterConfig } from './types';
import { enforceQuota } from './quota';

/**
 * Bidirectional mapper between a local entity and a Supabase row.
 * Identical to RowMapper in base.types.ts but without the Syncable constraint,
 * allowing entities like TabGroupTemplate (which uses `key` instead of `id`)
 * to be synced via the adapter.
 */
export interface SyncRowMapper<T> {
  toRow(entity: T, userId: string): Record<string, unknown>;
  fromRow(row: Record<string, unknown>): T;
}

/**
 * Generic entity sync adapter. Works with any entity type — entities
 * conforming to Syncable (id + createdAt) or non-standard shapes
 * like TabGroupTemplate (key + savedAt).
 */
export class SyncAdapter<T> {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly mapper: SyncRowMapper<T>,
    private readonly config: SyncAdapterConfig<T>,
  ) {}

  /**
   * Push local entities to Supabase, respecting the given quota limit.
   * Returns the number of entities actually synced.
   */
  async push(entities: T[], userId: string, limit: number | null): Promise<number> {
    const sortField = this.config.quotaSortField ?? 'updatedAt';
    const toSync = enforceQuota(entities, { limit, sortField });
    if (toSync.length === 0) return 0;

    const transformed = this.config.preSyncTransform
      ? toSync.map(this.config.preSyncTransform)
      : toSync;

    const rows = transformed.map((e) => this.mapper.toRow(e, userId));
    const conflictCol = this.config.conflictColumn ?? 'id';

    const { error } = await this.supabase
      .from(this.config.tableName)
      .upsert(rows, { onConflict: conflictCol });

    if (error) {
      throw new Error(`${this.config.tableName} sync failed: ${error.message}`);
    }

    return toSync.length;
  }

  /**
   * Pull all remote entities for a user from Supabase.
   * Returns the deserialized local entities.
   */
  async pull(userId: string): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(this.config.tableName)
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`${this.config.tableName} pull failed: ${error.message}`);
    }

    return (data ?? []).map((row) => this.mapper.fromRow(row as Record<string, unknown>));
  }

  /**
   * Delete remote entities that are no longer present in the local set.
   * Uses select-then-delete to avoid the unreliable .not('col','in','(...)') filter.
   * When localKeys is empty, all remote rows for this user are deleted.
   */
  async reconcile(userId: string, localKeys: string[]): Promise<void> {
    const keyCol = this.config.conflictColumn ?? 'id';

    const { data: remoteRows } = await this.supabase
      .from(this.config.tableName)
      .select(keyCol)
      .eq('user_id', userId);

    const localKeySet = new Set(localKeys);
    const orphans = (remoteRows ?? [])
      .map((r) => (r as unknown as Record<string, unknown>)[keyCol] as string)
      .filter((k) => !localKeySet.has(k));

    if (orphans.length > 0) {
      await this.supabase
        .from(this.config.tableName)
        .delete()
        .eq('user_id', userId)
        .in(keyCol, orphans);
    }
  }

  /** Push a single entity (used for fire-and-forget after mutations). */
  async pushOne(entity: T, userId: string): Promise<void> {
    const transformed = this.config.preSyncTransform
      ? this.config.preSyncTransform(entity)
      : entity;

    const row = this.mapper.toRow(transformed, userId);
    const conflictCol = this.config.conflictColumn ?? 'id';

    const { error } = await this.supabase
      .from(this.config.tableName)
      .upsert(row, { onConflict: conflictCol });

    if (error) {
      throw new Error(`${this.config.tableName} pushOne failed: ${error.message}`);
    }
  }

  /** Delete a single remote entity by key. */
  async deleteOne(userId: string, key: string): Promise<void> {
    const keyCol = this.config.conflictColumn ?? 'id';
    const { error } = await this.supabase
      .from(this.config.tableName)
      .delete()
      .eq(keyCol, key)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`${this.config.tableName} deleteOne failed: ${error.message}`);
    }
  }
}
