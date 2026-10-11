import { withStorageLock } from '@core/storage/storage-mutex';
import { ALL_MODULES_SELECTED, type ModuleSelection } from '@core/types/import-export.types';
import type { ListKey, SettingsKey } from './types';

export type SharedFolderStatus = 'off' | 'ok' | 'needs-permission' | 'error';

/** Another browser found in the shared folder. */
export interface SharedPeer {
  fileName: string;
  instanceId: string;
  label: string;
  writtenAt: string;
  lastModified: number;
  /** Not written for longer than deletions are kept; ignored when merging. */
  stale: boolean;
}

export interface SharedFolderState {
  enabled: boolean;
  status: SharedFolderStatus;
  folderName: string | null;
  /** Which kinds of data this browser shares. */
  modules: ModuleSelection;
  lastSyncAt: string | null;
  lastError: string | null;
  /** First successful sync with the current folder. */
  joinedAt: string | null;
  ownFileName: string | null;
  /** Fingerprint of the data in this browser's file, to skip identical rewrites. */
  ownFingerprint: string | null;
  /** When this browser last wrote its file. */
  ownWrittenAt: string | null;
  /** `modules` at the last sync; a change means peers must be read in full again. */
  syncedModules: string | null;
  peers: SharedPeer[];
}

export const DEFAULT_SHARED_FOLDER_STATE: SharedFolderState = {
  enabled: false,
  status: 'off',
  folderName: null,
  modules: { ...ALL_MODULES_SELECTED },
  lastSyncAt: null,
  lastError: null,
  joinedAt: null,
  ownFileName: null,
  ownFingerprint: null,
  ownWrittenAt: null,
  syncedModules: null,
  peers: [],
};

export const SHARED_FOLDER_STATE_KEY = 'shared_folder_state';

export async function getSharedFolderState(): Promise<SharedFolderState> {
  const result = await chrome.storage.local.get(SHARED_FOLDER_STATE_KEY);
  const stored = result[SHARED_FOLDER_STATE_KEY] as Partial<SharedFolderState> | undefined;
  return { ...DEFAULT_SHARED_FOLDER_STATE, ...(stored ?? {}) };
}

export function updateSharedFolderState(patch: Partial<SharedFolderState>): Promise<SharedFolderState> {
  return withStorageLock(SHARED_FOLDER_STATE_KEY, async () => {
    const next = { ...(await getSharedFolderState()), ...patch };
    await chrome.storage.local.set({ [SHARED_FOLDER_STATE_KEY]: next });
    return next;
  });
}

// ── Sync bookkeeping ──────────────────────────────────────────────────────────
// Lists and settings have no timestamps of their own. The last synced version
// is kept here so a local change can be told apart from an unchanged value.

export interface SyncMeta {
  lists: Partial<Record<ListKey, { fingerprint: string; updatedAt: string }>>;
  settings: Partial<Record<SettingsKey, { values: Record<string, string>; fieldUpdatedAt: Record<string, string> }>>;
}

const META_KEY = 'shared_folder_meta';

export async function getSyncMeta(): Promise<SyncMeta> {
  const result = await chrome.storage.local.get(META_KEY);
  const stored = result[META_KEY] as Partial<SyncMeta> | undefined;
  return { lists: stored?.lists ?? {}, settings: stored?.settings ?? {} };
}

export async function setSyncMeta(meta: SyncMeta): Promise<void> {
  await chrome.storage.local.set({ [META_KEY]: meta });
}

export async function clearSyncMeta(): Promise<void> {
  await chrome.storage.local.remove(META_KEY);
}
