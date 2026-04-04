import type { TabGroupTemplate } from '@core/types/tab-group.types';
import type { RowMapper } from '@core/types/base.types';

/**
 * TabGroupTemplate uses `key` as its primary identifier and `savedAt`
 * instead of `createdAt`. The Syncable constraint still applies via the
 * composite type — the SyncAdapter is configured with conflictColumn: 'key'.
 */
export const tabGroupTemplateMapper: RowMapper<TabGroupTemplate & { id: string; createdAt: string }> = {
  toRow(t: TabGroupTemplate & { id: string; createdAt: string }, userId: string): Record<string, unknown> {
    return {
      key: t.key,
      user_id: userId,
      title: t.title,
      color: t.color,
      tabs: t.tabs,
      saved_at: t.savedAt,
      updated_at: t.updatedAt,
      pinned: t.pinned ?? false,
    };
  },

  fromRow(r: Record<string, unknown>): TabGroupTemplate & { id: string; createdAt: string } {
    return {
      id: r.key as string, // Use key as id for Syncable conformance
      key: r.key as string,
      title: r.title as string,
      color: r.color as TabGroupTemplate['color'],
      tabs: (r.tabs ?? []) as TabGroupTemplate['tabs'],
      savedAt: r.saved_at as string,
      updatedAt: r.updated_at as string,
      pinned: (r.pinned ?? false) as boolean | undefined,
      createdAt: r.saved_at as string, // Map savedAt to createdAt for Syncable
    };
  },
};

/**
 * Simpler mapper that works with the raw TabGroupTemplate type
 * (without requiring Syncable conformance). Used by the existing
 * sync orchestrator until full migration.
 */
export const tabGroupTemplateRawMapper = {
  toRow(t: TabGroupTemplate, userId: string): Record<string, unknown> {
    return {
      key: t.key,
      user_id: userId,
      title: t.title,
      color: t.color,
      tabs: t.tabs,
      saved_at: t.savedAt,
      updated_at: t.updatedAt,
      pinned: t.pinned ?? false,
    };
  },

  fromRow(r: Record<string, unknown>): TabGroupTemplate {
    return {
      key: r.key as string,
      title: r.title as string,
      color: r.color as TabGroupTemplate['color'],
      tabs: (r.tabs ?? []) as TabGroupTemplate['tabs'],
      savedAt: r.saved_at as string,
      updatedAt: r.updated_at as string,
      pinned: (r.pinned ?? false) as boolean | undefined,
    };
  },
};
