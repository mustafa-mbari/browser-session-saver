/**
 * selective-sync-settings.ts — User-facing sync toggles persisted to
 * chrome.storage.local.
 *
 * Three levels of control:
 *   1. `syncEnabled` — master kill switch (blocks push and pull for all).
 *   2. `entities[key]` — per-entity toggle.
 *   3. `pauseUntil`   — temporary pause set by the "Pause 1h / 24h" action
 *      or tripped automatically by MassDeleteGuard.
 *
 * Local writes still dirty-stamp records while sync is disabled, so
 * re-enabling drains a backlog without extra work from the service layer.
 */

import { ALL_SYNC_ENTITY_KEYS, type SyncEntityKey } from '../types/syncable';

export interface SelectiveSyncSettings {
  syncEnabled: boolean;
  entities: Record<SyncEntityKey, boolean>;
  /** ISO timestamp — sync is a no-op until this time has passed. */
  pauseUntil?: string;
  /** Optional human-readable reason the pause was set (e.g. 'mass-delete-suspected'). */
  pauseReason?: string;
}

const STORAGE_KEY = 'sync_selective_settings';

export function defaultSettings(): SelectiveSyncSettings {
  const entities = {} as Record<SyncEntityKey, boolean>;
  for (const k of ALL_SYNC_ENTITY_KEYS) entities[k] = true;
  return { syncEnabled: true, entities };
}

export async function getSettings(): Promise<SelectiveSyncSettings> {
  try {
    const r = await chrome.storage.local.get(STORAGE_KEY);
    const stored = r?.[STORAGE_KEY] as Partial<SelectiveSyncSettings> | undefined;
    if (!stored) return defaultSettings();
    // Fill in any entity keys missing from older stored shape.
    const merged = defaultSettings();
    merged.syncEnabled = stored.syncEnabled ?? true;
    if (stored.entities) {
      for (const k of ALL_SYNC_ENTITY_KEYS) {
        if (k in stored.entities) merged.entities[k] = stored.entities[k] ?? true;
      }
    }
    merged.pauseUntil = stored.pauseUntil;
    merged.pauseReason = stored.pauseReason;
    return merged;
  } catch {
    return defaultSettings();
  }
}

export async function setSettings(settings: SelectiveSyncSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

export async function updateSettings(
  patch: Partial<SelectiveSyncSettings>,
): Promise<SelectiveSyncSettings> {
  const current = await getSettings();
  const next: SelectiveSyncSettings = {
    ...current,
    ...patch,
    entities: { ...current.entities, ...(patch.entities ?? {}) },
  };
  await setSettings(next);
  return next;
}

/** Pause sync for N minutes from now. */
export async function pauseSyncFor(minutes: number, reason?: string): Promise<void> {
  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  await updateSettings({ pauseUntil: until, pauseReason: reason });
}

/** Clear any active pause. */
export async function clearPause(): Promise<void> {
  await updateSettings({ pauseUntil: undefined, pauseReason: undefined });
}

/** True if the current pauseUntil is still in the future. */
export function isPaused(settings: SelectiveSyncSettings, now = new Date()): boolean {
  if (!settings.pauseUntil) return false;
  return Date.parse(settings.pauseUntil) > now.getTime();
}

/**
 * True when the engine should process this entity on the current cycle:
 * master switch on, per-entity toggle on, and not currently paused.
 */
export function isEntityActive(
  settings: SelectiveSyncSettings,
  entity: SyncEntityKey,
  now = new Date(),
): boolean {
  if (!settings.syncEnabled) return false;
  if (isPaused(settings, now)) return false;
  return settings.entities[entity] !== false;
}
