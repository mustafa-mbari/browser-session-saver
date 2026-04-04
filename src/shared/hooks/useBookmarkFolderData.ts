import { useState, useEffect, useCallback } from 'react';
import type { Board, BookmarkCategory, BookmarkEntry } from '@core/types/newtab.types';
import * as BookmarkService from '@core/services/bookmark.service';
import type { FolderNode } from '@core/services/bookmark.service';
import { getFaviconUrl } from '@core/utils/favicon';

export type { FolderNode };

export interface BookmarkFolderState {
  boards: Board[];
  categories: BookmarkCategory[];
  entries: BookmarkEntry[];
  loading: boolean;
  error: string | null;
}

export interface BookmarkFolderActions {
  reload: () => Promise<void>;
  createTopLevelFolder: (boardId: string, name: string) => Promise<BookmarkCategory>;
  createSubFolder: (parentCategoryId: string, name: string, boardId: string) => Promise<BookmarkCategory>;
  renameFolder: (id: string, name: string) => Promise<void>;
  updateFolderColor: (id: string, color: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  addEntry: (categoryId: string, title: string, url: string, category?: string, description?: string) => Promise<BookmarkEntry>;
  renameEntry: (id: string, title: string, url: string, category?: string, description?: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  saveCurrentTab: (categoryId: string) => Promise<BookmarkEntry | null>;
  moveFolder: (id: string, newParentId: string) => Promise<void>;
  moveEntry: (id: string, newCategoryId: string) => Promise<void>;
  /** Build FolderNode tree for a single board from cached categories */
  getFolderTreeForBoard: (boardId: string) => FolderNode[];
  /** Get entries for a given category from cache */
  getEntriesForCategory: (categoryId: string) => BookmarkEntry[];
  /** Get breadcrumb path as an array of categories */
  getFolderPath: (folderId: string) => BookmarkCategory[];
}

export function useBookmarkFolderData(): BookmarkFolderState & BookmarkFolderActions {
  const [boards, setBoards] = useState<Board[]>([]);
  const [categories, setCategories] = useState<BookmarkCategory[]>([]);
  const [entries, setEntries] = useState<BookmarkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, c, e] = await Promise.all([
        BookmarkService.getBoards(),
        BookmarkService.getAllCategories(),
        BookmarkService.getAllEntries(),
      ]);
      setBoards(b);
      setCategories(c);
      setEntries(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Reload whenever the background SW completes a pull
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.cloud_last_pull_at) void reload();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [reload]);

  // ── Tree builder (in-memory, no DB calls) ───────────────────────────────────
  const getFolderTreeForBoard = useCallback(
    (boardId: string): FolderNode[] => {
      const boardCats = categories.filter((c) => c.boardId === boardId);
      const byParent = new Map<string, BookmarkCategory[]>();
      for (const cat of boardCats) {
        const key = cat.parentCategoryId ?? '__root__';
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push(cat);
      }
      function buildNodes(parentKey: string): FolderNode[] {
        return (byParent.get(parentKey) ?? []).map((folder) => ({
          folder,
          children: buildNodes(folder.id),
        }));
      }
      return buildNodes('__root__');
    },
    [categories],
  );

  const getEntriesForCategory = useCallback(
    (categoryId: string): BookmarkEntry[] => {
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat || cat.bookmarkIds.length === 0) {
        return entries.filter((e) => e.categoryId === categoryId);
      }
      const order = new Map(cat.bookmarkIds.map((id, idx) => [id, idx]));
      return entries
        .filter((e) => e.categoryId === categoryId)
        .sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
    },
    [entries, categories],
  );

  const getFolderPath = useCallback(
    (folderId: string): BookmarkCategory[] => {
      const path: BookmarkCategory[] = [];
      const byId = new Map(categories.map((c) => [c.id, c]));
      let current = byId.get(folderId);
      while (current) {
        path.unshift(current);
        if (!current.parentCategoryId) break;
        current = byId.get(current.parentCategoryId);
      }
      return path;
    },
    [categories],
  );

  // ── CRUD actions ─────────────────────────────────────────────────────────────

  const createTopLevelFolder = useCallback(
    async (boardId: string, name: string): Promise<BookmarkCategory> => {
      const cat = await BookmarkService.createTopLevelFolder(boardId, name);
      setCategories((prev) => [...prev, cat]);
      // Board.categoryIds is unchanged — this folder is NOT a dashboard widget
      return cat;
    },
    [],
  );

  const createSubFolder = useCallback(
    async (parentCategoryId: string, name: string, boardId: string): Promise<BookmarkCategory> => {
      const cat = await BookmarkService.createSubFolder(parentCategoryId, name, boardId);
      setCategories((prev) => [...prev, cat]);
      return cat;
    },
    [],
  );

  const moveFolder = useCallback(async (id: string, newParentId: string): Promise<void> => {
    await BookmarkService.updateCategory(id, { parentCategoryId: newParentId });
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, parentCategoryId: newParentId } : c)));
  }, []);

  const moveEntry = useCallback(async (id: string, newCategoryId: string): Promise<void> => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const oldCategoryId = entry.categoryId;
    if (oldCategoryId === newCategoryId) return;
    const sourceCategory = categories.find((c) => c.id === oldCategoryId);
    const targetCategory = categories.find((c) => c.id === newCategoryId);
    if (!targetCategory) return;

    await BookmarkService.updateEntry(id, { categoryId: newCategoryId });
    if (sourceCategory) {
      await BookmarkService.updateCategory(oldCategoryId, {
        bookmarkIds: sourceCategory.bookmarkIds.filter((bid) => bid !== id),
      });
    }
    await BookmarkService.updateCategory(newCategoryId, {
      bookmarkIds: [...targetCategory.bookmarkIds, id],
    });

    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, categoryId: newCategoryId } : e)));
    setCategories((prev) => prev.map((c) => {
      if (c.id === oldCategoryId && sourceCategory) return { ...c, bookmarkIds: c.bookmarkIds.filter((bid) => bid !== id) };
      if (c.id === newCategoryId) return { ...c, bookmarkIds: [...c.bookmarkIds, id] };
      return c;
    }));
  }, [entries, categories]);

  const renameFolder = useCallback(async (id: string, name: string): Promise<void> => {
    await BookmarkService.updateCategory(id, { name });
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);

  const updateFolderColor = useCallback(async (id: string, color: string): Promise<void> => {
    await BookmarkService.updateCategory(id, { color });
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)));
  }, []);

  const deleteFolder = useCallback(async (id: string): Promise<void> => {
    // Collect all descendant IDs to remove from local state
    const toDelete = new Set<string>();
    const collectIds = (folderId: string) => {
      toDelete.add(folderId);
      categories.filter((c) => c.parentCategoryId === folderId).forEach((c) => collectIds(c.id));
    };
    collectIds(id);

    await BookmarkService.deleteFolderRecursive(id);

    const deletedEntryIds = new Set(entries.filter((e) => toDelete.has(e.categoryId)).map((e) => e.id));
    setCategories((prev) => prev.filter((c) => !toDelete.has(c.id)));
    setEntries((prev) => prev.filter((e) => !deletedEntryIds.has(e.id)));

    // Update board's categoryIds if a top-level category was deleted
    const cat = categories.find((c) => c.id === id);
    if (cat && !cat.parentCategoryId) {
      setBoards((prev) =>
        prev.map((b) =>
          b.id === cat.boardId
            ? { ...b, categoryIds: b.categoryIds.filter((cid) => cid !== id) }
            : b,
        ),
      );
    }
  }, [categories, entries]);

  const addEntry = useCallback(
    async (categoryId: string, title: string, url: string, category?: string, description?: string): Promise<BookmarkEntry> => {
      const entry = await BookmarkService.saveEntry({
        categoryId,
        title: title.trim() || url,
        url,
        favIconUrl: getFaviconUrl(url),
        isNative: false,
        ...(category ? { category } : {}),
        ...(description ? { description } : {}),
      });
      setEntries((prev) => [...prev, entry]);
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, bookmarkIds: [...c.bookmarkIds, entry.id] } : c)),
      );
      return entry;
    },
    [],
  );

  const renameEntry = useCallback(async (id: string, title: string, url: string, category?: string, description?: string): Promise<void> => {
    const updates = { title, url, favIconUrl: getFaviconUrl(url), category, description };
    await BookmarkService.updateEntry(id, updates);
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, ...updates } : e,
      ),
    );
  }, []);

  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    const entry = entries.find((e) => e.id === id);
    await BookmarkService.deleteEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (entry) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === entry.categoryId
            ? { ...c, bookmarkIds: c.bookmarkIds.filter((bid) => bid !== id) }
            : c,
        ),
      );
    }
  }, [entries]);

  const saveCurrentTab = useCallback(
    async (categoryId: string): Promise<BookmarkEntry | null> => {
      try {
        const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) =>
          chrome.tabs.query({ active: true, currentWindow: true }, resolve),
        );
        const tab = tabs[0];
        if (!tab?.url) return null;
        return addEntry(categoryId, tab.title ?? tab.url, tab.url);
      } catch {
        return null;
      }
    },
    [addEntry],
  );

  return {
    boards,
    categories,
    entries,
    loading,
    error,
    reload,
    createTopLevelFolder,
    createSubFolder,
    moveFolder,
    moveEntry,
    renameFolder,
    updateFolderColor,
    deleteFolder,
    addEntry,
    renameEntry,
    deleteEntry,
    saveCurrentTab,
    getFolderTreeForBoard,
    getEntriesForCategory,
    getFolderPath,
  };
}

