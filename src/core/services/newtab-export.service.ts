import { newtabDB } from '@core/storage/newtab-storage';
import { getNewTabSettings, updateNewTabSettings } from '@core/services/newtab-settings.service';
import type {
  Board,
  BookmarkCategory,
  BookmarkEntry,
  QuickLink,
  TodoList,
  TodoItem,
  NewTabSettings,
} from '@core/types/newtab.types';

export interface DashboardExportEnvelope {
  version: '1.0.0';
  exportedAt: string;
  source: 'browser-hub-dashboard';
  counts: {
    boards: number;
    categories: number;
    entries: number;
    quickLinks: number;
    todoLists: number;
    todoItems: number;
  };
  boards: Board[];
  categories: BookmarkCategory[];
  entries: BookmarkEntry[];
  quickLinks: QuickLink[];
  todoLists: TodoList[];
  todoItems: TodoItem[];
  settings: NewTabSettings;
}

export interface DashboardImportResult {
  success: boolean;
  error?: string;
  counts?: DashboardExportEnvelope['counts'];
}

// The six data stores to clear/restore — wallpaperImages is intentionally excluded
const DATA_STORES = [
  'boards',
  'bookmarkCategories',
  'bookmarkEntries',
  'quickLinks',
  'todoLists',
  'todoItems',
] as const;

function isValidEnvelope(parsed: unknown): parsed is DashboardExportEnvelope {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const p = parsed as Record<string, unknown>;
  return (
    p['source'] === 'browser-hub-dashboard' &&
    typeof p['version'] === 'string' &&
    Array.isArray(p['boards']) &&
    Array.isArray(p['categories']) &&
    Array.isArray(p['entries']) &&
    Array.isArray(p['quickLinks']) &&
    Array.isArray(p['todoLists']) &&
    Array.isArray(p['todoItems']) &&
    typeof p['settings'] === 'object' &&
    p['settings'] !== null
  );
}

async function clearDataStores(): Promise<void> {
  for (const store of DATA_STORES) {
    const records = await newtabDB.getAll<{ id: string }>(store);
    await Promise.all(records.map((r) => newtabDB.delete(store, r.id)));
  }
}

export async function exportDashboardAsJSON(): Promise<string> {
  const [boards, categories, entries, quickLinks, todoLists, todoItems, settings] =
    await Promise.all([
      newtabDB.getAll<Board>('boards'),
      newtabDB.getAll<BookmarkCategory>('bookmarkCategories'),
      newtabDB.getAll<BookmarkEntry>('bookmarkEntries'),
      newtabDB.getAll<QuickLink>('quickLinks'),
      newtabDB.getAll<TodoList>('todoLists'),
      newtabDB.getAll<TodoItem>('todoItems'),
      getNewTabSettings(),
    ]);

  const envelope: DashboardExportEnvelope = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    source: 'browser-hub-dashboard',
    counts: {
      boards: boards.length,
      categories: categories.length,
      entries: entries.length,
      quickLinks: quickLinks.length,
      todoLists: todoLists.length,
      todoItems: todoItems.length,
    },
    boards,
    categories,
    entries,
    quickLinks,
    todoLists,
    todoItems,
    settings,
  };

  return JSON.stringify(envelope, null, 2);
}

export async function importDashboardFromJSON(jsonString: string): Promise<DashboardImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { success: false, error: 'File is not valid JSON' };
  }

  if (!isValidEnvelope(parsed)) {
    return {
      success: false,
      error: 'File does not appear to be a Browser Hub dashboard export',
    };
  }

  const envelope = parsed;

  try {
    await clearDataStores();
  } catch (e) {
    return { success: false, error: `Failed to clear existing data: ${String(e)}` };
  }

  try {
    await Promise.all([
      ...envelope.boards.map((r) => newtabDB.put('boards', r)),
      ...envelope.categories.map((r) => newtabDB.put('bookmarkCategories', r)),
      ...envelope.entries.map((r) => newtabDB.put('bookmarkEntries', r)),
      ...envelope.quickLinks.map((r) => newtabDB.put('quickLinks', r)),
      ...envelope.todoLists.map((r) => newtabDB.put('todoLists', r)),
      ...envelope.todoItems.map((r) => newtabDB.put('todoItems', r)),
    ]);
  } catch (e) {
    return { success: false, error: `Failed to write data: ${String(e)}` };
  }

  try {
    const settingsToWrite: NewTabSettings = { ...envelope.settings };
    if (settingsToWrite.backgroundType === 'image') {
      settingsToWrite.backgroundType = 'gradient';
      delete settingsToWrite.backgroundImageId;
    }
    await updateNewTabSettings(settingsToWrite);
  } catch (e) {
    return { success: false, error: `Failed to write settings: ${String(e)}` };
  }

  return { success: true, counts: envelope.counts };
}
