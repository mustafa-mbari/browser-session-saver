/**
 * syncable.ts — Public re-exports of sync-facing types.
 *
 * Re-exports the canonical `SyncableEntity` (defined in core base.types) and
 * defines the `SyncEntityKey` union that the engine + handlers key off.
 */

export type { SyncableEntity } from '@core/types/base.types';

/**
 * Stable identifier for each entity that participates in cloud sync.
 * Used as:
 *  - key in `SelectiveSyncSettings.entities[key]`
 *  - key in `SyncCursor` state
 *  - element of the hardcoded push/pull ORDER
 */
export type SyncEntityKey =
  | 'sessions'
  | 'prompts'
  | 'prompt_folders'
  | 'subscriptions'
  | 'tab_group_templates'
  | 'bookmark_folders'
  | 'bookmark_entries'
  | 'todo_lists'
  | 'todo_items'
  | 'quick_links';

export const ALL_SYNC_ENTITY_KEYS: readonly SyncEntityKey[] = [
  'sessions',
  'prompts',
  'prompt_folders',
  'subscriptions',
  'tab_group_templates',
  'bookmark_folders',
  'bookmark_entries',
  'todo_lists',
  'todo_items',
  'quick_links',
] as const;
