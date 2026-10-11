/**
 * local-data.ts — reads this browser's data for sharing and writes merged
 * results back. Writes here are not user actions: no action-limit cost and
 * timestamps are kept as received.
 */
import { getSessionRepository, getSettingsStorage } from '@core/storage/storage-factory';
import { getPromptRepository, getPromptFolderRepository, PromptStorage } from '@core/storage/prompt-storage';
import { getSubscriptionRepository, SubscriptionStorage } from '@core/storage/subscription-storage';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import { newtabDB } from '@core/storage/newtab-storage';
import { getNewTabSettings, updateNewTabSettings } from '@core/services/newtab-settings.service';
import { STORAGE_KEYS } from '@core/types/storage.types';
import { DEFAULT_SETTINGS, type Settings } from '@core/types/settings.types';
import {
  DEFAULT_NEWTAB_SETTINGS,
  type Board,
  type BookmarkCategory,
  type BookmarkEntry,
  type NewTabSettings,
  type QuickLink,
  type TodoItem,
  type TodoList,
} from '@core/types/newtab.types';
import type { Session } from '@core/types/session.types';
import type { Prompt, PromptCategory, PromptFolder, PromptTag } from '@core/types/prompt.types';
import type { CustomCategory, Subscription } from '@core/types/subscription.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';
import type { BackupModule, ModuleSelection } from '@core/types/import-export.types';
import type { DataModule } from '@core/events/data-change-bus';
import type { Versioned } from './merge';
import {
  PER_BROWSER_NEWTAB_FIELDS,
  type ListKey,
  type RecordKey,
  type SettingsKey,
} from './types';

export type SharedKey = RecordKey | ListKey | SettingsKey;

/** The shared keys each user-facing module covers. */
export const MODULE_KEYS: Record<BackupModule, SharedKey[]> = {
  sessions: ['sessions'],
  prompts: ['prompts', 'promptFolders', 'promptCategories', 'promptTags'],
  subscriptions: ['subscriptions', 'subscriptionCategories'],
  tabGroupTemplates: ['tabGroupTemplates'],
  dashboard: ['boards', 'bookmarkCategories', 'bookmarkEntries', 'quickLinks', 'todoLists', 'todoItems'],
  settings: ['settings', 'newtabSettings'],
};

export function enabledKeys(modules: ModuleSelection): Set<SharedKey> {
  const keys = new Set<SharedKey>();
  for (const [module, enabled] of Object.entries(modules) as [BackupModule, boolean][]) {
    if (enabled) for (const key of MODULE_KEYS[module] ?? []) keys.add(key);
  }
  return keys;
}

/** Which pages need to reload when a shared key changes. */
export const DATA_MODULE_OF: Record<SharedKey, DataModule> = {
  sessions: 'sessions',
  prompts: 'prompts',
  promptFolders: 'prompts',
  promptCategories: 'prompts',
  promptTags: 'prompts',
  subscriptions: 'subscriptions',
  subscriptionCategories: 'subscriptions',
  tabGroupTemplates: 'tabGroups',
  boards: 'dashboard',
  bookmarkCategories: 'dashboard',
  bookmarkEntries: 'dashboard',
  quickLinks: 'dashboard',
  todoLists: 'dashboard',
  todoItems: 'dashboard',
  settings: 'settings',
  newtabSettings: 'settings',
};

const NEWTAB_STORE: Partial<Record<RecordKey, string>> = {
  boards: 'boards',
  bookmarkCategories: 'bookmarkCategories',
  bookmarkEntries: 'bookmarkEntries',
  quickLinks: 'quickLinks',
  todoLists: 'todoLists',
  todoItems: 'todoItems',
};

export function recordKeyOf(key: RecordKey): (record: Versioned) => string | undefined {
  return key === 'tabGroupTemplates'
    ? (record) => (record as TabGroupTemplate).key
    : (record) => (record as { id?: string }).id;
}

/** Drop fields that only mean something in this browser. */
export function shareable<T extends object>(record: T): T {
  const copy = { ...record } as Record<string, unknown>;
  delete copy.dirty;
  delete copy.lastSyncedAt;
  return copy as T;
}

// ── Records ────────────────────────────────────────────────────────────────────

/** Local records for a key, deletions (tombstones) included. */
export async function readRecords(key: RecordKey): Promise<Versioned[]> {
  let records: object[];
  switch (key) {
    case 'sessions':
      records = await getSessionRepository().getAllWithOptions({ includeDeleted: true });
      break;
    case 'prompts':
      records = await getPromptRepository().getAllWithOptions({ includeDeleted: true });
      break;
    case 'promptFolders':
      records = await getPromptFolderRepository().getAllWithOptions({ includeDeleted: true });
      break;
    case 'subscriptions':
      records = await getSubscriptionRepository().getAllWithOptions({ includeDeleted: true });
      break;
    case 'tabGroupTemplates':
      records = await TabGroupTemplateStorage.getAllRaw();
      break;
    default:
      records = await newtabDB.getAll<object>(NEWTAB_STORE[key]!);
  }
  return records.map(shareable) as Versioned[];
}

export async function writeRecords(key: RecordKey, records: Versioned[]): Promise<void> {
  if (records.length === 0) return;
  switch (key) {
    case 'sessions':
      return getSessionRepository().importMany(records as Session[]);
    case 'prompts':
      return getPromptRepository().importMany(records as Prompt[]);
    case 'promptFolders':
      return getPromptFolderRepository().importMany(records as PromptFolder[]);
    case 'subscriptions':
      return getSubscriptionRepository().importMany(records as Subscription[]);
    case 'tabGroupTemplates':
      return TabGroupTemplateStorage.applyRemote(records as TabGroupTemplate[]);
    default:
      return newtabDB.putMany(NEWTAB_STORE[key]!, records as unknown as { id: string }[]);
  }
}

/** Remove records outright (no tombstone). */
export async function removeRecords(key: RecordKey, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  switch (key) {
    case 'sessions': {
      const repo = getSessionRepository();
      for (const id of ids) await repo.delete(id);
      return;
    }
    case 'prompts':
      for (const id of ids) await getPromptRepository().delete(id);
      return;
    case 'promptFolders':
      for (const id of ids) await getPromptFolderRepository().delete(id);
      return;
    case 'subscriptions':
      for (const id of ids) await getSubscriptionRepository().delete(id);
      return;
    case 'tabGroupTemplates':
      return TabGroupTemplateStorage.removeMany(ids);
    default:
      return newtabDB.deleteMany(NEWTAB_STORE[key]!, ids);
  }
}

/**
 * Auto-saves from before per-browser auto-saves have no source. Only this
 * browser can have made them, so claim them before sharing.
 */
export async function adoptLegacyAutoSaves(
  sessions: Versioned[],
  instance: { id: string; label: string },
): Promise<Versioned[]> {
  const legacy = (sessions as Session[]).filter((s) => s.isAutoSave && !s.sourceInstanceId);
  if (legacy.length === 0) return sessions;
  const repo = getSessionRepository();
  const adopted = new Map<string, Versioned>();
  for (const session of legacy) {
    const updated = await repo.update(session.id, { sourceInstanceId: instance.id, sourceLabel: instance.label });
    if (updated) adopted.set(session.id, shareable(updated));
  }
  return sessions.map((s) => adopted.get((s as Session).id) ?? s);
}

// ── Lists ──────────────────────────────────────────────────────────────────────

export async function readList(key: ListKey): Promise<unknown[]> {
  switch (key) {
    case 'promptCategories':
      return PromptStorage.getCategories();
    case 'promptTags':
      return PromptStorage.getTags();
    case 'subscriptionCategories':
      return SubscriptionStorage.getCustomCategories();
  }
}

export async function writeList(key: ListKey, items: unknown[]): Promise<void> {
  switch (key) {
    case 'promptCategories':
      return PromptStorage.setCategories(items as PromptCategory[]);
    case 'promptTags':
      return PromptStorage.setTags(items as PromptTag[]);
    case 'subscriptionCategories':
      return SubscriptionStorage.replaceCustomCategories(items as CustomCategory[]);
  }
}

export function listItemKey(key: ListKey): (item: unknown) => string {
  return key === 'subscriptionCategories'
    ? (item) => (item as CustomCategory).value
    : (item) => (item as { id: string }).id;
}

// ── Settings ───────────────────────────────────────────────────────────────────

export interface LocalSettings {
  /** Shareable fields only (per-browser fields removed). */
  values: Record<string, unknown>;
  defaults: Record<string, unknown>;
}

export async function readSettings(key: SettingsKey): Promise<LocalSettings> {
  if (key === 'settings') {
    const stored = await getSettingsStorage().get<Settings>(STORAGE_KEYS.SETTINGS);
    return {
      values: { ...DEFAULT_SETTINGS, ...(stored ?? {}) },
      defaults: { ...DEFAULT_SETTINGS },
    };
  }
  const values: Record<string, unknown> = { ...(await getNewTabSettings()) };
  for (const field of PER_BROWSER_NEWTAB_FIELDS) delete values[field];
  return { values, defaults: { ...DEFAULT_NEWTAB_SETTINGS } };
}

export async function writeSettings(key: SettingsKey, changed: Record<string, unknown>): Promise<void> {
  if (Object.keys(changed).length === 0) return;
  if (key === 'settings') {
    const storage = getSettingsStorage();
    const stored = await storage.get<Settings>(STORAGE_KEYS.SETTINGS);
    await storage.set(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS, ...(stored ?? {}), ...changed });
    return;
  }
  const safe = { ...changed };
  for (const field of PER_BROWSER_NEWTAB_FIELDS) delete safe[field];
  await updateNewTabSettings(safe as Partial<NewTabSettings>);
}

// ── First join ─────────────────────────────────────────────────────────────────

const DASHBOARD_KEYS: RecordKey[] = [
  'boards', 'bookmarkCategories', 'bookmarkEntries', 'quickLinks', 'todoLists', 'todoItems',
];
const DEFAULT_BOARD_NAMES = new Set(['Main', 'Bookmarks']);
const DEFAULT_CARD_NAMES = new Set(['Private', 'Work']);
const DEFAULT_LINK_URLS = new Set(['https://www.google.com', 'https://claude.ai', 'https://translate.google.com']);

/**
 * True when the start-tab data here is only the untouched defaults (boards,
 * sample cards, quick links, empty task list) — nothing the user would miss.
 */
export async function hasOnlyDefaultDashboard(): Promise<boolean> {
  const alive = <T extends { deletedAt?: string | null }>(records: T[]) => records.filter((r) => !r.deletedAt);
  const [boards, cards, entries, links, lists, items] = await Promise.all([
    newtabDB.getAll<Board>('boards'),
    newtabDB.getAll<BookmarkCategory>('bookmarkCategories'),
    newtabDB.getAll<BookmarkEntry>('bookmarkEntries'),
    newtabDB.getAll<QuickLink>('quickLinks'),
    newtabDB.getAll<TodoList>('todoLists'),
    newtabDB.getAll<TodoItem>('todoItems'),
  ]);
  if (alive(entries).length > 0 || alive(items).length > 0) return false;
  return (
    alive(boards).every((b) => DEFAULT_BOARD_NAMES.has(b.name)) &&
    alive(cards).every(
      (c) =>
        DEFAULT_CARD_NAMES.has(c.name) &&
        c.bookmarkIds.length === 0 &&
        !c.noteContent &&
        (c.cardType ?? 'bookmark') === 'bookmark',
    ) &&
    alive(links).every((l) => DEFAULT_LINK_URLS.has(l.url)) &&
    alive(lists).every((l) => l.name === 'My Tasks')
  );
}

/** Remove all start-tab records (not wallpapers). Used before adopting a shared dashboard. */
export async function clearDashboardRecords(): Promise<void> {
  for (const key of DASHBOARD_KEYS) {
    const records = await newtabDB.getAll<{ id: string }>(NEWTAB_STORE[key]!);
    await newtabDB.deleteMany(NEWTAB_STORE[key]!, records.map((r) => r.id));
  }
}
