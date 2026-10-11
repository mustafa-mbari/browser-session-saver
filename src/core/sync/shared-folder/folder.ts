/**
 * folder.ts — the user-chosen shared folder (File System Access API).
 *
 * Each browser writes only its own file (`bh-<label>-<id>.json`) and reads the
 * others, so browsers never write the same file.
 */
import type { BrowserInstance } from '@core/services/browser-instance.service';
import { SHARED_FILE_FORMAT, SHARED_FILE_SCHEMA, type SharedFile } from './types';

type AccessMode = { mode: 'readwrite' };

/** Permission methods from the File System Access spec that TypeScript's DOM types lack. */
interface PermissionedHandle {
  queryPermission(descriptor: AccessMode): Promise<PermissionState>;
  requestPermission(descriptor: AccessMode): Promise<PermissionState>;
}

type DirectoryPicker = (options?: {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: 'documents' | 'desktop' | 'downloads';
}) => Promise<FileSystemDirectoryHandle>;

const SHARED_FILE_PATTERN = /^bh-.+\.json$/;

export function isFolderAccessSupported(): boolean {
  return typeof (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

/** Ask the user for a folder. Must be called from a user gesture in a page. */
export async function pickFolder(): Promise<FileSystemDirectoryHandle> {
  const picker = (globalThis as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  if (!picker) throw new Error('This browser cannot open folders for extensions.');
  return picker({ id: 'browser-hub-shared', mode: 'readwrite', startIn: 'documents' });
}

/**
 * Current permission for the folder. With `interactive`, asks the user when
 * needed — which requires a user gesture.
 */
export async function ensureFolderAccess(
  dir: FileSystemDirectoryHandle,
  interactive: boolean,
): Promise<PermissionState> {
  const handle = dir as unknown as PermissionedHandle;
  const state = await handle.queryPermission({ mode: 'readwrite' });
  if (state === 'granted' || !interactive) return state;
  return handle.requestPermission({ mode: 'readwrite' });
}

export function sharedFileName(instance: BrowserInstance): string {
  const slug =
    instance.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'browser';
  return `bh-${slug}-${instance.id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()}.json`;
}

export async function listSharedFiles(dir: FileSystemDirectoryHandle): Promise<FileSystemFileHandle[]> {
  const files: FileSystemFileHandle[] = [];
  for await (const handle of dir.values()) {
    if (handle.kind === 'file' && SHARED_FILE_PATTERN.test(handle.name)) {
      files.push(handle as FileSystemFileHandle);
    }
  }
  return files;
}

/** Parse a shared file; null when it is not a Browser Hub file this version understands. */
export function parseSharedFile(text: string): SharedFile | null {
  try {
    const parsed = JSON.parse(text) as Partial<SharedFile>;
    const valid =
      parsed?.format === SHARED_FILE_FORMAT &&
      parsed.schema === SHARED_FILE_SCHEMA &&
      typeof parsed.instance?.id === 'string' &&
      typeof parsed.writtenAt === 'string' &&
      typeof parsed.data === 'object' &&
      parsed.data !== null;
    return valid ? (parsed as SharedFile) : null;
  } catch {
    return null;
  }
}

/** Write via a temporary copy that replaces the file on close, so readers never see half a file. */
export async function writeSharedFile(dir: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function removeSharedFile(dir: FileSystemDirectoryHandle, name: string): Promise<void> {
  try {
    await dir.removeEntry(name);
  } catch {
    // Already gone
  }
}

// ── Remembering the folder ─────────────────────────────────────────────────────
// Handles can be stored in IndexedDB (not chrome.storage). A separate small
// database keeps the existing ones untouched; it also holds the pre-sharing
// backup, which can exceed chrome.storage.local's 10 MB quota.

const DB_NAME = 'browser-hub-sync';
const STORE = 'handles';
const FOLDER_KEY = 'shared-folder';
const BACKUP_KEY = 'pre-share-backup';

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withHandleStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openHandleDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function saveFolderHandle(dir: FileSystemDirectoryHandle): Promise<void> {
  await withHandleStore('readwrite', (store) => store.put(dir, FOLDER_KEY));
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await withHandleStore<FileSystemDirectoryHandle | undefined>('readonly', (store) =>
    store.get(FOLDER_KEY),
  );
  return handle ?? null;
}

export async function clearFolderHandle(): Promise<void> {
  await withHandleStore('readwrite', (store) => store.delete(FOLDER_KEY));
}

export interface PreShareBackup {
  createdAt: string;
  /** A full backup in the Import / Export format. */
  json: string;
}

export async function savePreShareBackup(backup: PreShareBackup): Promise<void> {
  await withHandleStore('readwrite', (store) => store.put(backup, BACKUP_KEY));
}

export async function loadPreShareBackup(): Promise<PreShareBackup | null> {
  const backup = await withHandleStore<PreShareBackup | undefined>('readonly', (store) => store.get(BACKUP_KEY));
  return backup ?? null;
}
