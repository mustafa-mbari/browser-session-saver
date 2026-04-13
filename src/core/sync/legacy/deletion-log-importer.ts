/**
 * deletion-log-importer.ts — One-shot migrator for the legacy deletion log.
 *
 * The old system recorded user-initiated deletes into an append-only list
 * under `sync_deletion_log` in chrome.storage.local. Those ids have not yet
 * propagated to the cloud — they were drained at the next sync by issuing
 * explicit DELETE calls.
 *
 * When we switch to the SyncEngine those explicit DELETEs go away; instead
 * the engine relies on tombstones carried on the row itself. For IDs in the
 * legacy log that still have a local row, we need to flip the row to
 * `deletedAt = now / dirty = true` so the first sync cycle on the new engine
 * pushes the tombstone. For IDs that no longer have a local row, there's
 * nothing to propagate — the previous DELETE sequence must have cleaned up
 * already, or the row never existed on the server.
 *
 * The importer sets a one-shot flag after completion so subsequent runs
 * short-circuit. Called once during service-worker startup.
 */

import type { SyncEntityKey } from '../types/syncable';

import { newtabDB } from '@core/storage/newtab-storage';
import { getSessionRepository } from '@core/storage/storage-factory';
import { ChromeLocalArrayRepository } from '@core/storage/chrome-local-array-repository';
import { appendLog } from '../state/sync-log';

const FLAG_KEY = 'sync_deletion_log_imported_v2';
const LEGACY_LOG_KEY = 'sync_deletion_log';

// Legacy ids use the table name; map → our SyncEntityKey union.
type LegacyEntity =
  | 'sessions'
  | 'prompts'
  | 'prompt_folders'
  | 'tracked_subscriptions'
  | 'bookmark_folders'
  | 'bookmark_entries'
  | 'todo_lists'
  | 'todo_items'
  | 'tab_group_templates'
  | 'quick_links';

const LEGACY_TO_KEY: Record<LegacyEntity, SyncEntityKey> = {
  sessions: 'sessions',
  prompts: 'prompts',
  prompt_folders: 'prompt_folders',
  tracked_subscriptions: 'subscriptions',
  bookmark_folders: 'bookmark_folders',
  bookmark_entries: 'bookmark_entries',
  todo_lists: 'todo_lists',
  todo_items: 'todo_items',
  tab_group_templates: 'tab_group_templates',
  quick_links: 'quick_links',
};

export async function importLegacyDeletionLog(): Promise<{
  alreadyImported: boolean;
  tombstoned: Partial<Record<SyncEntityKey, number>>;
}> {
  const flag = await chrome.storage.local.get(FLAG_KEY);
  if (flag?.[FLAG_KEY] === true) {
    return { alreadyImported: true, tombstoned: {} };
  }

  const legacy = await chrome.storage.local.get(LEGACY_LOG_KEY);
  const log = (legacy?.[LEGACY_LOG_KEY] as Partial<Record<LegacyEntity, string[]>>) ?? {};

  const tombstoned: Partial<Record<SyncEntityKey, number>> = {};

  for (const [rawEntity, ids] of Object.entries(log)) {
    if (!ids || ids.length === 0) continue;
    const entity = LEGACY_TO_KEY[rawEntity as LegacyEntity];
    if (!entity) continue;

    let count = 0;
    for (const id of ids) {
      const ok = await softDeleteById(entity, id);
      if (ok) count++;
    }
    if (count > 0) tombstoned[entity] = count;
  }

  // Clear the legacy key so we never double-import.
  await chrome.storage.local.remove(LEGACY_LOG_KEY);
  await chrome.storage.local.set({ [FLAG_KEY]: true });

  await appendLog({
    type: 'cycle-start',
    msg: 'legacy-deletion-log-imported',
    data: tombstoned,
  });

  return { alreadyImported: false, tombstoned };
}

async function softDeleteById(entity: SyncEntityKey, id: string): Promise<boolean> {
  switch (entity) {
    case 'sessions':
      return getSessionRepository().markDeleted?.(id) ?? false;
    case 'prompts':
      return new ChromeLocalArrayRepository('prompts').markDeleted(id);
    case 'prompt_folders':
      return new ChromeLocalArrayRepository('prompt_folders').markDeleted(id);
    case 'subscriptions':
      return new ChromeLocalArrayRepository('subscriptions').markDeleted(id);
    case 'tab_group_templates':
      return new ChromeLocalArrayRepository('tab_group_templates').markDeleted(id);
    case 'bookmark_folders':
    case 'bookmark_entries':
    case 'todo_lists':
    case 'todo_items':
    case 'quick_links':
      return markDeletedInNewTabDB(entity, id);
  }
}

async function markDeletedInNewTabDB(entity: SyncEntityKey, id: string): Promise<boolean> {
  const storeName = ({
    bookmark_folders: 'bookmarkCategories',
    bookmark_entries: 'bookmarkEntries',
    todo_lists: 'todoLists',
    todo_items: 'todoItems',
    quick_links: 'quickLinks',
  } as Partial<Record<SyncEntityKey, string>>)[entity];
  if (!storeName) return false;
  const existing = await newtabDB.get<Record<string, unknown> & { id: string }>(storeName, id);
  if (!existing) return false;
  const now = new Date().toISOString();
  const updated: Record<string, unknown> & { id: string } = {
    ...existing,
    deletedAt: now,
    updatedAt: now,
    dirty: true,
  };
  await newtabDB.put(storeName, updated);
  return true;
}
