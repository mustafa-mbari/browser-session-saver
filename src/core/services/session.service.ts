import type { Session, Tab, TabGroup, AutoSaveTrigger } from '@core/types/session.types';
import type { SessionFilter, SessionSort } from '@core/types/messages.types';
import type { Settings } from '@core/types/settings.types';
import { CURRENT_SCHEMA_VERSION } from '@core/types/storage.types';
import { generateId } from '@core/utils/uuid';
import { nowISO, formatTimestamp } from '@core/utils/date';
import { getSessionStorage, getSettingsStorage } from '@core/storage/storage-factory';
import { STORAGE_KEYS } from '@core/types/storage.types';
import type { StorageMetadata } from '@core/types/storage.types';

export interface SaveSessionOptions {
  name?: string;
  windowId?: number;
  isAutoSave?: boolean;
  autoSaveTrigger?: AutoSaveTrigger;
  isPinned?: boolean;
  isLocked?: boolean;
}

function generateSessionName(isAutoSave: boolean, trigger?: AutoSaveTrigger): string {
  const timestamp = formatTimestamp(nowISO());
  if (isAutoSave && trigger) {
    const triggerLabel = trigger.charAt(0).toUpperCase() + trigger.slice(1).replace('_', ' ');
    return `[Auto — ${triggerLabel}] ${timestamp}`;
  }
  return `Session — ${timestamp}`;
}

export async function saveSession(
  tabs: Tab[],
  tabGroups: TabGroup[],
  options: SaveSessionOptions = {},
): Promise<Session> {
  const storage = getSessionStorage();
  const id = generateId();
  const now = nowISO();
  const isAutoSave = options.isAutoSave ?? false;
  const trigger = options.autoSaveTrigger ?? 'manual';

  const session: Session = {
    id,
    name: options.name || generateSessionName(isAutoSave, trigger),
    createdAt: now,
    updatedAt: now,
    tabs,
    tabGroups,
    windowId: options.windowId ?? -1,
    tags: [],
    isPinned: options.isPinned ?? false,
    isStarred: false,
    isLocked: options.isLocked ?? false,
    isAutoSave,
    autoSaveTrigger: trigger,
    notes: '',
    tabCount: tabs.length,
    version: CURRENT_SCHEMA_VERSION,
  };

  await storage.set(id, session);

  if (isAutoSave) {
    const settingsStorage = getSettingsStorage();
    const settings = await settingsStorage.get<Settings>(STORAGE_KEYS.SETTINGS);
    const maxAutoSaves = settings?.maxAutoSaves ?? 50;
    await enforceAutoSaveLimit(maxAutoSaves);

    const metadata = (await settingsStorage.get<StorageMetadata>(STORAGE_KEYS.METADATA)) ?? {
      version: CURRENT_SCHEMA_VERSION,
      lastAutoSave: null,
      storageUsedBytes: 0,
    };
    metadata.lastAutoSave = now;
    await settingsStorage.set(STORAGE_KEYS.METADATA, metadata);
  }

  return session;
}

/**
 * Upsert the single persistent auto-save entry.
 *
 * There is exactly ONE auto-save entry in the store (regardless of trigger type).
 * It is always pinned and locked so it cannot be deleted accidentally.
 *
 * @param mergeWithExisting  When true (default = autoSaveOnTabClose is OFF):
 *   keep all existing tabs and only ADD new URLs from `tabs`.
 *   Closed tabs remain in the session — the auto-save grows as the user browses.
 *   When false (autoSaveOnTabClose is ON):
 *   replace the stored tabs with the current snapshot exactly.
 */
export async function upsertAutoSaveSession(
  tabs: Tab[],
  tabGroups: TabGroup[],
  options: SaveSessionOptions = {},
  mergeWithExisting = false,
): Promise<Session> {
  const storage = getSessionStorage();
  const trigger = options.autoSaveTrigger ?? 'timer';
  const now = nowISO();

  // Always find THE single auto-save entry (newest first, any trigger type)
  const all = await getAllSessions({ isAutoSave: true });
  const existing = all[0] ?? null;

  if (existing) {
    let finalTabs = tabs;
    let finalTabGroups = tabGroups;

    if (mergeWithExisting) {
      // Add-only: keep every existing tab, append URLs not yet present
      const existingUrls = new Set(existing.tabs.map((t) => t.url));
      const newTabs = tabs.filter((t) => !existingUrls.has(t.url));

      if (newTabs.length === 0 && tabGroups.length === existing.tabGroups.length) {
        // Nothing changed — skip the write
        return existing;
      }

      finalTabs = [...existing.tabs, ...newTabs];

      const existingGroupKeys = new Set(
        existing.tabGroups.map((g) => `${g.title}-${g.color}`),
      );
      const newGroups = tabGroups.filter(
        (g) => !existingGroupKeys.has(`${g.title}-${g.color}`),
      );
      finalTabGroups = [...existing.tabGroups, ...newGroups];
    }

    const updated: Session = {
      ...existing,
      tabs: finalTabs,
      tabGroups: finalTabGroups,
      tabCount: finalTabs.length,
      name: generateSessionName(true, trigger),
      updatedAt: now,
      isPinned: true,
      isLocked: true,
      autoSaveTrigger: trigger,
      windowId: options.windowId ?? existing.windowId,
    };
    await storage.set(existing.id, updated);

    const settingsStorage = getSettingsStorage();
    const metadata = (await settingsStorage.get<StorageMetadata>(STORAGE_KEYS.METADATA)) ?? {
      version: CURRENT_SCHEMA_VERSION,
      lastAutoSave: null,
      storageUsedBytes: 0,
    };
    metadata.lastAutoSave = now;
    await settingsStorage.set(STORAGE_KEYS.METADATA, metadata);

    return updated;
  }

  // No existing entry — create the first auto-save (pinned + locked)
  return saveSession(tabs, tabGroups, {
    ...options,
    isAutoSave: true,
    autoSaveTrigger: trigger,
    isPinned: true,
    isLocked: true,
  });
}

export async function getSession(id: string): Promise<Session | null> {
  const storage = getSessionStorage();
  return storage.get<Session>(id);
}

export async function getAllSessions(
  filter?: SessionFilter,
  sort?: SessionSort,
): Promise<Session[]> {
  const storage = getSessionStorage();
  const all = await storage.getAll();
  let sessions = Object.values(all) as Session[];

  if (filter) {
    sessions = applyFilter(sessions, filter);
  }

  if (sort) {
    sessions = applySort(sessions, sort);
  } else {
    sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return sessions;
}

export async function updateSession(
  id: string,
  updates: Partial<Session>,
): Promise<Session | null> {
  const storage = getSessionStorage();
  const session = await storage.get<Session>(id);
  if (!session) return null;

  const updated: Session = {
    ...session,
    ...updates,
    id: session.id,
    updatedAt: nowISO(),
  };

  await storage.set(id, updated);
  return updated;
}

export async function deleteSession(id: string): Promise<boolean> {
  const storage = getSessionStorage();
  const session = await storage.get<Session>(id);
  if (!session) return false;
  if (session.isLocked) return false;

  await storage.remove(id);
  return true;
}

export async function duplicateSession(id: string): Promise<Session | null> {
  const session = await getSession(id);
  if (!session) return null;

  return saveSession(session.tabs, session.tabGroups, {
    name: `${session.name} (Copy)`,
    windowId: session.windowId,
  });
}

export async function checkDuplicate(tabUrls: string[]): Promise<boolean> {
  const sessions = await getAllSessions(undefined, { field: 'createdAt', direction: 'desc' });
  if (sessions.length === 0) return false;

  const latest = sessions[0];
  if (latest.tabs.length !== tabUrls.length) return false;

  const latestUrls = latest.tabs.map((t) => t.url).sort();
  const currentUrls = [...tabUrls].sort();
  return latestUrls.every((url, i) => url === currentUrls[i]);
}

async function enforceAutoSaveLimit(maxAutoSaves: number): Promise<void> {
  const allSessions = await getAllSessions();
  const autoSaves = allSessions
    .filter((s) => s.isAutoSave && !s.isLocked)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const storage = getSessionStorage();
  while (autoSaves.length > maxAutoSaves) {
    const oldest = autoSaves.shift()!;
    await storage.remove(oldest.id);
  }
}

function applyFilter(sessions: Session[], filter: SessionFilter): Session[] {
  return sessions.filter((session) => {
    if (filter.isAutoSave !== undefined && session.isAutoSave !== filter.isAutoSave) return false;
    if (filter.isPinned !== undefined && session.isPinned !== filter.isPinned) return false;
    if (filter.isStarred !== undefined && session.isStarred !== filter.isStarred) return false;
    if (filter.tags && filter.tags.length > 0) {
      if (!filter.tags.some((tag) => session.tags.includes(tag))) return false;
    }
    if (filter.dateFrom && new Date(session.createdAt) < new Date(filter.dateFrom)) return false;
    if (filter.dateTo && new Date(session.createdAt) > new Date(filter.dateTo)) return false;
    return true;
  });
}

function applySort(sessions: Session[], sort: SessionSort): Session[] {
  const sorted = [...sessions];
  const dir = sort.direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sort.field) {
      case 'name':
        return dir * a.name.localeCompare(b.name);
      case 'tabCount':
        return dir * (a.tabCount - b.tabCount);
      case 'updatedAt':
        return dir * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      case 'createdAt':
      default:
        return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  });

  return sorted;
}
