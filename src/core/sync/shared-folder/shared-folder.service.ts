/**
 * shared-folder.service.ts — one data set for every browser on this computer.
 *
 * The user picks the same folder in each browser. Each browser writes only its
 * own file there and merges the others' files into its local data, so browsers
 * never write the same file and the folder can live in a cloud-synced directory.
 * Runs from extension pages (the folder permission needs a page).
 */
import { getBrowserInstance } from '@core/services/browser-instance.service';
import { createAutoBackup, executeImport, previewImport } from '@core/services/full-import.service';
import { notifySyncApplied, type DataModule } from '@core/events/data-change-bus';
import { TOMBSTONE_RETENTION_MS } from '@core/constants/timings';
import {
  ALL_MODULES_SELECTED,
  type BackupModule,
  type ModuleSelection,
} from '@core/types/import-export.types';
import {
  clearFolderHandle,
  ensureFolderAccess,
  isFolderAccessSupported,
  listSharedFiles,
  loadFolderHandle,
  loadPreShareBackup,
  parseSharedFile,
  pickFolder,
  removeSharedFile,
  savePreShareBackup,
  saveFolderHandle,
  sharedFileName,
  writeSharedFile,
} from './folder';
import {
  findRemovedWhileAway,
  fingerprint,
  mergeList,
  mergeRecords,
  mergeSettings,
  stableStringify,
  unionList,
  type Versioned,
} from './merge';
import {
  adoptLegacyAutoSaves,
  clearDashboardRecords,
  DATA_MODULE_OF,
  enabledKeys,
  hasOnlyDefaultDashboard,
  listItemKey,
  readList,
  readRecords,
  readSettings,
  recordKeyOf,
  removeRecords,
  writeList,
  writeRecords,
  writeSettings,
} from './local-data';
import {
  clearSyncMeta,
  getSharedFolderState,
  getSyncMeta,
  setSyncMeta,
  updateSharedFolderState,
  type SharedPeer,
  type SyncMeta,
} from './state';
import {
  LIST_KEYS,
  PER_BROWSER_NEWTAB_FIELDS,
  RECORD_KEYS,
  SETTINGS_KEYS,
  SHARED_FILE_FORMAT,
  SHARED_FILE_SCHEMA,
  type SharedData,
  type SharedFile,
  type SharedList,
  type SharedSettings,
} from './types';

export { isFolderAccessSupported };

export type SyncOutcome =
  | { status: 'ok'; applied: number }
  | { status: 'off' | 'busy' | 'needs-permission' }
  | { status: 'error'; error: string };

const SYNC_LOCK = 'browser-hub-shared-folder-sync';
const EPOCH = '1970-01-01T00:00:00.000Z';
/** Rewrite this browser's file at least this often, so peers can see it is alive. */
const REWRITE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ALL_BACKUP_MODULES = Object.keys(ALL_MODULES_SELECTED) as BackupModule[];

// ── User actions (call from a click handler) ───────────────────────────────────

/** Choose the shared folder and run the first sync. Throws AbortError if the user cancels. */
export async function connectFolder(): Promise<SyncOutcome> {
  const dir = await pickFolder();
  if ((await ensureFolderAccess(dir, true)) !== 'granted') {
    throw new Error('Browser Hub needs permission to read and write the folder.');
  }
  await saveFolderHandle(dir);
  await clearSyncMeta();
  await updateSharedFolderState({
    enabled: true,
    status: 'ok',
    folderName: dir.name,
    joinedAt: null,
    lastError: null,
    ownFileName: null,
    ownFingerprint: null,
    ownWrittenAt: null,
    syncedModules: null,
    peers: [],
  });
  return syncNow({ interactive: true });
}

/** Ask again for permission to the folder (Chrome may ask after a restart). */
export function reconnectFolder(): Promise<SyncOutcome> {
  return syncNow({ interactive: true });
}

/** Stop sharing. Local data stays; this browser's file is removed from the folder. */
export async function stopSharing(): Promise<void> {
  const state = await getSharedFolderState();
  const dir = await loadFolderHandle();
  if (dir && state.ownFileName) {
    try {
      if ((await ensureFolderAccess(dir, false)) === 'granted') await removeSharedFile(dir, state.ownFileName);
    } catch {
      // The folder may be gone; nothing to clean up
    }
  }
  await clearFolderHandle();
  await clearSyncMeta();
  await updateSharedFolderState({
    enabled: false,
    status: 'off',
    folderName: null,
    joinedAt: null,
    lastError: null,
    ownFileName: null,
    ownFingerprint: null,
    ownWrittenAt: null,
    syncedModules: null,
    peers: [],
  });
}

export async function setSharedModules(modules: ModuleSelection): Promise<void> {
  await updateSharedFolderState({ modules });
}

/** Delete another browser's file (e.g. a browser that is no longer used). */
export async function removePeer(fileName: string): Promise<void> {
  const dir = await loadFolderHandle();
  if (!dir || (await ensureFolderAccess(dir, true)) !== 'granted') return;
  await removeSharedFile(dir, fileName);
  const state = await getSharedFolderState();
  await updateSharedFolderState({ peers: state.peers.filter((p) => p.fileName !== fileName) });
}

export async function getPreShareBackupDate(): Promise<string | null> {
  return (await loadPreShareBackup())?.createdAt ?? null;
}

/**
 * Put back the data this browser had before it first joined the folder.
 * Sharing stops first; otherwise the next sync would bring the shared data back.
 */
export async function restorePreShareBackup(): Promise<boolean> {
  const backup = await loadPreShareBackup();
  if (!backup) return false;
  await stopSharing();
  const preview = previewImport(backup.json);
  const result = await executeImport(backup.json, preview, { ...ALL_MODULES_SELECTED }, 'replace');
  notifySyncApplied('sessions', 'prompts', 'subscriptions', 'tabGroups', 'dashboard', 'settings');
  return result.success;
}

// ── Sync ───────────────────────────────────────────────────────────────────────

/**
 * Merge with the other browsers' files and write this browser's file.
 * Only one sync runs at a time across this browser's pages; others return 'busy'.
 * `interactive` may show a permission prompt and needs a user gesture.
 */
export async function syncNow(options: { interactive?: boolean } = {}): Promise<SyncOutcome> {
  const interactive = options.interactive ?? false;
  if (!navigator.locks) return runSync(interactive);
  return navigator.locks.request(SYNC_LOCK, { ifAvailable: true }, (lock) =>
    lock ? runSync(interactive) : { status: 'busy' as const },
  );
}

function isStale(writtenAt: string, nowMs: number): boolean {
  return nowMs - Date.parse(writtenAt) > TOMBSTONE_RETENTION_MS;
}

/** Tombstones older than the retention window are dropped from the shared file. */
function withoutExpiredTombstones<T extends Versioned>(records: T[], cutoff: string): T[] {
  return records.filter((r) => !(r.deletedAt && r.deletedAt < cutoff));
}

async function runSync(interactive: boolean): Promise<SyncOutcome> {
  const state = await getSharedFolderState();
  if (!state.enabled) return { status: 'off' };

  const dir = await loadFolderHandle();
  if (!dir) {
    const error = 'The shared folder is no longer available. Choose it again.';
    await updateSharedFolderState({ status: 'error', lastError: error });
    return { status: 'error', error };
  }
  if ((await ensureFolderAccess(dir, interactive).catch(() => 'denied' as const)) !== 'granted') {
    if (state.status !== 'needs-permission') await updateSharedFolderState({ status: 'needs-permission' });
    return { status: 'needs-permission' };
  }

  try {
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const tombstoneCutoff = new Date(nowMs - TOMBSTONE_RETENTION_MS).toISOString();
    const instance = await getBrowserInstance();
    const ownFileName = sharedFileName(instance);
    const keys = enabledKeys(state.modules);
    const modulesKey = stableStringify(state.modules);
    const firstJoin = !state.joinedAt;
    const returning = !firstJoin && state.lastSyncAt !== null && isStale(state.lastSyncAt, nowMs);
    const fullRead = firstJoin || returning || state.syncedModules !== modulesKey;

    // 1. Other browsers' files — read only the ones that changed since last time.
    const known = new Map(state.peers.map((p) => [p.fileName, p]));
    const peers: SharedPeer[] = [];
    const remotes: SharedData[] = [];
    for (const handle of await listSharedFiles(dir)) {
      if (handle.name === ownFileName) continue;
      const file = await handle.getFile();
      const previous = known.get(handle.name);
      if (!fullRead && previous && previous.lastModified === file.lastModified) {
        peers.push({ ...previous, stale: isStale(previous.writtenAt, nowMs) });
        continue;
      }
      const shared = parseSharedFile(await file.text());
      if (!shared) continue;
      if (shared.instance.id === instance.id) {
        // This browser's own file under an earlier name (the browser was renamed).
        await removeSharedFile(dir, handle.name);
        continue;
      }
      const stale = isStale(shared.writtenAt, nowMs);
      peers.push({
        fileName: handle.name,
        instanceId: shared.instance.id,
        label: shared.instance.label,
        writtenAt: shared.writtenAt,
        lastModified: file.lastModified,
        stale,
      });
      if (!stale) remotes.push(shared.data);
    }

    // 2. First time in this folder: keep a backup; drop untouched default
    //    start-tab data when the folder already has a dashboard to adopt.
    if (firstJoin) {
      await savePreShareBackup({ createdAt: now, json: await createAutoBackup(ALL_BACKUP_MODULES) });
      const folderHasDashboard = remotes.some((r) => (r.boards?.length ?? 0) > 0);
      if (keys.has('boards') && folderHasDashboard && (await hasOnlyDefaultDashboard())) {
        await clearDashboardRecords();
      }
    }

    const meta: SyncMeta = firstJoin ? { lists: {}, settings: {} } : await getSyncMeta();
    const nextMeta: SyncMeta = { lists: {}, settings: {} };
    const data: SharedData = {};
    const changedModules = new Set<DataModule>();
    let applied = 0;

    // 3. Records: newest copy wins, deletions travel as tombstones.
    for (const key of RECORD_KEYS) {
      if (!keys.has(key)) continue;
      const keyOf = recordKeyOf(key);
      let local = await readRecords(key);
      if (key === 'sessions') local = await adoptLegacyAutoSaves(local, instance);
      const remoteRecords = remotes.map((r) => r[key] as Versioned[] | undefined);

      if (returning && remotes.length > 0 && state.lastSyncAt) {
        // Away longer than deletions are kept: records the others no longer have
        // and that did not change here were deleted elsewhere.
        const removed = findRemovedWhileAway(local, remoteRecords, keyOf, state.lastSyncAt);
        if (removed.length > 0) {
          await removeRecords(key, removed);
          const gone = new Set(removed);
          local = local.filter((r) => !gone.has(keyOf(r) ?? ''));
          changedModules.add(DATA_MODULE_OF[key]);
        }
      }

      const { merged, toApply } = mergeRecords(local, remoteRecords, keyOf);
      if (toApply.length > 0) {
        await writeRecords(key, toApply);
        applied += toApply.length;
        changedModules.add(DATA_MODULE_OF[key]);
      }
      (data as Record<string, Versioned[]>)[key] = withoutExpiredTombstones(merged, tombstoneCutoff);
    }

    // 4. Lists: the newest list wins; the first sync keeps every browser's items.
    for (const key of LIST_KEYS) {
      if (!keys.has(key)) continue;
      const items = await readList(key);
      const remoteLists = remotes.map((r) => r[key] as SharedList<unknown> | undefined);
      const previous = meta.lists[key];
      const local: SharedList<unknown> = previous
        ? {
            updatedAt: previous.fingerprint === fingerprint(stableStringify(items)) ? previous.updatedAt : now,
            items,
          }
        : { updatedAt: now, items: unionList(items, remoteLists, listItemKey(key)) };

      const winner = mergeList(local, remoteLists);
      if (stableStringify(winner.items) !== stableStringify(items)) {
        await writeList(key, winner.items);
        applied += 1;
        changedModules.add(DATA_MODULE_OF[key]);
      }
      nextMeta.lists[key] = { fingerprint: fingerprint(stableStringify(winner.items)), updatedAt: winner.updatedAt };
      (data as Record<string, SharedList<unknown>>)[key] = winner;
    }

    // 5. Settings, field by field. Before its first sync, a field counts as
    //    changed only if it differs from the default.
    for (const key of SETTINGS_KEYS) {
      if (!keys.has(key)) continue;
      const { values, defaults } = await readSettings(key);
      const previous = meta.settings[key];
      const fieldUpdatedAt: Record<string, string> = {};
      for (const [field, value] of Object.entries(values)) {
        const json = stableStringify(value);
        fieldUpdatedAt[field] = previous
          ? previous.values[field] === json
            ? (previous.fieldUpdatedAt[field] ?? EPOCH)
            : now
          : json === stableStringify(defaults[field])
            ? EPOCH
            : now;
      }

      const { merged, changed } = mergeSettings<Record<string, unknown>>(
        { values, fieldUpdatedAt },
        remotes.map((r) => r[key] as SharedSettings<Record<string, unknown>> | undefined),
      );
      if (key === 'newtabSettings') {
        for (const field of PER_BROWSER_NEWTAB_FIELDS) {
          delete merged.values[field];
          delete merged.fieldUpdatedAt[field];
          delete changed[field];
        }
      }
      if (Object.keys(changed).length > 0) {
        await writeSettings(key, changed);
        applied += 1;
        changedModules.add('settings');
      }
      nextMeta.settings[key] = {
        values: Object.fromEntries(Object.entries(merged.values).map(([f, v]) => [f, stableStringify(v)])),
        fieldUpdatedAt: merged.fieldUpdatedAt,
      };
      (data as Record<string, SharedSettings<Record<string, unknown>>>)[key] = merged;
    }

    // 6. This browser's file: rewrite when the content changed (and daily).
    const contentPrint = fingerprint(stableStringify(data));
    const due =
      !state.ownWrittenAt || nowMs - Date.parse(state.ownWrittenAt) > REWRITE_INTERVAL_MS;
    let ownWrittenAt = state.ownWrittenAt;
    if (contentPrint !== state.ownFingerprint || state.ownFileName !== ownFileName || due) {
      const file: SharedFile = {
        format: SHARED_FILE_FORMAT,
        schema: SHARED_FILE_SCHEMA,
        instance: { id: instance.id, label: instance.label },
        writtenAt: now,
        data,
      };
      await writeSharedFile(dir, ownFileName, JSON.stringify(file));
      if (state.ownFileName && state.ownFileName !== ownFileName) {
        await removeSharedFile(dir, state.ownFileName);
      }
      ownWrittenAt = now;
    }

    await setSyncMeta(nextMeta);
    await updateSharedFolderState({
      status: 'ok',
      lastSyncAt: now,
      lastError: null,
      joinedAt: state.joinedAt ?? now,
      ownFileName,
      ownFingerprint: contentPrint,
      ownWrittenAt,
      syncedModules: modulesKey,
      peers,
    });
    if (changedModules.size > 0) notifySyncApplied(...changedModules);
    return { status: 'ok', applied };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateSharedFolderState({ status: 'error', lastError: message });
    return { status: 'error', error: message };
  }
}
