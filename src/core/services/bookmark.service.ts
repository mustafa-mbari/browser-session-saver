import { newtabDB } from '@core/storage/newtab-storage';
import { softDeleteNewTab, softDeleteNewTabMany } from '@core/storage/newtab-soft-delete';
import type { Board, BookmarkCategory, BookmarkEntry } from '@core/types/newtab.types';
import { generateId } from '@core/utils/uuid';
import { nowISO } from '@core/utils/date';
import { getFaviconUrl } from '@core/utils/favicon';
import { guardAction, trackAction } from '@core/services/limits/limit-guard';

const db = newtabDB;

const BOARDS = 'boards';
const CATEGORIES = 'bookmarkCategories';
const ENTRIES = 'bookmarkEntries';

// ─── Boards ───────────────────────────────────────────────────────────────────

export async function getBoards(): Promise<Board[]> {
  const boards = await db.getAll<Board>(BOARDS);
  return boards
    .filter((b) => !b.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveBoard(
  data: Omit<Board, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Board> {
  const now = nowISO();
  const board: Board = { ...data, id: generateId(), createdAt: now, updatedAt: now };
  await db.put(BOARDS, board);
  return board;
}

export async function updateBoard(
  id: string,
  updates: Partial<Omit<Board, 'id' | 'createdAt'>>,
): Promise<void> {
  const existing = await db.get<Board>(BOARDS, id);
  if (!existing) return;
  await db.put(BOARDS, { ...existing, ...updates, updatedAt: nowISO() });
}

export async function deleteBoard(id: string): Promise<void> {
  const categories = await db.getAllByIndex<BookmarkCategory>(CATEGORIES, 'boardId', id);
  const deletedEntryIds: string[] = [];
  for (const cat of categories) {
    const entries = await db.getAllByIndex<BookmarkEntry>(ENTRIES, 'categoryId', cat.id);
    deletedEntryIds.push(...entries.map((e) => e.id));
    await softDeleteNewTab(CATEGORIES, cat.id);
  }
  await softDeleteNewTabMany(ENTRIES, deletedEntryIds);
  // Boards themselves are not synced — hard delete is fine.
  await db.delete(BOARDS, id);
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(boardId: string): Promise<BookmarkCategory[]> {
  const raw = await db.getAllByIndex<BookmarkCategory>(CATEGORIES, 'boardId', boardId);
  const cats = raw.filter((c) => !c.deletedAt);
  const board = await db.get<Board>(BOARDS, boardId);
  if (board && board.categoryIds.length > 0) {
    const order = new Map(board.categoryIds.map((id, idx) => [id, idx]));
    return cats.sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
  }
  return cats.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveCategory(
  data: Omit<BookmarkCategory, 'id' | 'createdAt'>,
): Promise<BookmarkCategory> {
  await guardAction();
  const cat: BookmarkCategory = { colSpan: 1, rowSpan: 1, ...data, id: generateId(), createdAt: nowISO() };
  await db.put(CATEGORIES, cat);

  const board = await db.get<Board>(BOARDS, data.boardId);
  if (board) {
    await db.put(BOARDS, {
      ...board,
      categoryIds: [...board.categoryIds, cat.id],
      updatedAt: nowISO(),
    });
  }
  void trackAction();
  return cat;
}

export async function updateCategory(
  id: string,
  updates: Partial<Omit<BookmarkCategory, 'id' | 'createdAt'>>,
): Promise<void> {
  const existing = await db.get<BookmarkCategory>(CATEGORIES, id);
  if (!existing) return;
  if ('name' in updates && updates.name) {
    await assertNoDuplicateName(updates.name, existing.boardId, existing.parentCategoryId, id);
  }
  await db.put(CATEGORIES, { ...existing, ...updates });
}

export async function deleteCategory(id: string): Promise<void> {
  await guardAction();
  const entries = await db.getAllByIndex<BookmarkEntry>(ENTRIES, 'categoryId', id);
  const cat = await db.get<BookmarkCategory>(CATEGORIES, id);
  if (cat) {
    const board = await db.get<Board>(BOARDS, cat.boardId);
    if (board) {
      await db.put(BOARDS, {
        ...board,
        categoryIds: board.categoryIds.filter((cid) => cid !== id),
        updatedAt: nowISO(),
      });
    }
  }
  await softDeleteNewTab(CATEGORIES, id);
  await softDeleteNewTabMany(ENTRIES, entries.map((e) => e.id));
  void trackAction();
}

// ─── Entries ──────────────────────────────────────────────────────────────────

export async function getEntries(categoryId: string): Promise<BookmarkEntry[]> {
  const raw = await db.getAllByIndex<BookmarkEntry>(ENTRIES, 'categoryId', categoryId);
  const entries = raw.filter((e) => !e.deletedAt);
  const cat = await db.get<BookmarkCategory>(CATEGORIES, categoryId);
  if (cat && cat.bookmarkIds.length > 0) {
    const order = new Map(cat.bookmarkIds.map((id, idx) => [id, idx]));
    return entries.sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
  }
  return entries.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export async function saveEntry(
  data: Omit<BookmarkEntry, 'id' | 'addedAt'>,
): Promise<BookmarkEntry> {
  await guardAction();
  const entry: BookmarkEntry = { ...data, id: generateId(), addedAt: nowISO() };
  await db.put(ENTRIES, entry);

  const cat = await db.get<BookmarkCategory>(CATEGORIES, data.categoryId);
  if (cat) {
    await db.put(CATEGORIES, { ...cat, bookmarkIds: [...cat.bookmarkIds, entry.id] });
  }
  void trackAction();
  return entry;
}

export async function updateEntry(
  id: string,
  updates: Partial<Omit<BookmarkEntry, 'id' | 'addedAt'>>,
): Promise<void> {
  await guardAction();
  const existing = await db.get<BookmarkEntry>(ENTRIES, id);
  if (!existing) return;
  await db.put(ENTRIES, { ...existing, ...updates });
  void trackAction();
}

export async function deleteEntry(id: string): Promise<void> {
  await guardAction();
  const entry = await db.get<BookmarkEntry>(ENTRIES, id);
  if (entry) {
    const cat = await db.get<BookmarkCategory>(CATEGORIES, entry.categoryId);
    if (cat) {
      await db.put(CATEGORIES, {
        ...cat,
        bookmarkIds: cat.bookmarkIds.filter((bid) => bid !== id),
      });
    }
  }
  await softDeleteNewTab(ENTRIES, id);
  void trackAction();
}

/** Throws if a sibling folder at the same level already uses the same name (case-insensitive). */
async function assertNoDuplicateName(
  name: string,
  boardId: string,
  parentCategoryId: string | undefined,
  excludeId?: string,
): Promise<void> {
  const all = await db.getAll<BookmarkCategory>(CATEGORIES);
  const siblings = all.filter(
    (c) =>
      c.boardId === boardId &&
      (c.parentCategoryId ?? undefined) === parentCategoryId &&
      c.id !== excludeId,
  );
  if (siblings.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    throw new Error(`A folder named "${name.trim()}" already exists at this level`);
  }
}

/**
 * Creates a top-level folder for the Folders explorer WITHOUT adding it to
 * the board's categoryIds. The folder is stored in the DB but is NOT a
 * dashboard widget until explicitly linked via addExistingFolderAsWidget().
 */
export async function createTopLevelFolder(
  boardId: string,
  name: string,
): Promise<BookmarkCategory> {
  await assertNoDuplicateName(name, boardId, undefined);
  const cat: BookmarkCategory = {
    id: generateId(),
    boardId,
    name,
    icon: '📁',
    color: '#6366f1',
    bookmarkIds: [],
    collapsed: false,
    cardType: 'bookmark',
    createdAt: nowISO(),
  };
  await db.put(CATEGORIES, cat);
  return cat;
}

/**
 * Removes a category ID from Board.categoryIds (hides the widget on the
 * dashboard) WITHOUT deleting the category record or its entries.
 * The folder remains accessible from the Folders explorer.
 */
export async function removeWidgetFromBoard(categoryId: string): Promise<void> {
  const cat = await db.get<BookmarkCategory>(CATEGORIES, categoryId);
  if (!cat) return;
  const board = await db.get<Board>(BOARDS, cat.boardId);
  if (board) {
    await db.put(BOARDS, {
      ...board,
      categoryIds: board.categoryIds.filter((cid) => cid !== categoryId),
      updatedAt: nowISO(),
    });
  }
}

/**
 * Adds an existing category (folder) to the specified board's categoryIds,
 * making it appear as a widget on the dashboard. If the folder was previously
 * owned by a different board its boardId is updated to the target board.
 * Idempotent — no-op if already in the list.
 */
export async function addExistingFolderAsWidget(
  categoryId: string,
  targetBoardId: string,
): Promise<void> {
  const board = await db.get<Board>(BOARDS, targetBoardId);
  if (!board) return;
  if (!board.categoryIds.includes(categoryId)) {
    await db.put(BOARDS, {
      ...board,
      categoryIds: [...board.categoryIds, categoryId],
      updatedAt: nowISO(),
    });
  }
  // Re-assign the folder's boardId to the target board if it differs
  const cat = await db.get<BookmarkCategory>(CATEGORIES, categoryId);
  if (cat && cat.boardId !== targetBoardId) {
    await db.put(CATEGORIES, { ...cat, boardId: targetBoardId });
  }
}

// ─── Nested Folder Support ────────────────────────────────────────────────────

/** A folder node in the recursive tree used by the Bookmark Explorer */
export interface FolderNode {
  folder: BookmarkCategory;
  children: FolderNode[];
}

/**
 * Returns all BookmarkCategories across all boards (used by the explorer to
 * load all folders in a single query).
 */
export async function getAllCategories(): Promise<BookmarkCategory[]> {
  const all = await db.getAll<BookmarkCategory>(CATEGORIES);
  return all.filter((c) => !c.deletedAt);
}

/**
 * Returns all BookmarkEntries across all categories (used by the explorer).
 */
export async function getAllEntries(): Promise<BookmarkEntry[]> {
  const all = await db.getAll<BookmarkEntry>(ENTRIES);
  return all.filter((e) => !e.deletedAt);
}

/**
 * Returns the direct child folders of the given parent category.
 */
export async function getSubFolders(
  parentCategoryId: string,
): Promise<BookmarkCategory[]> {
  const raw = await db.getAllByIndex<BookmarkCategory>(CATEGORIES, 'parentCategoryId', parentCategoryId);
  return raw.filter((c) => !c.deletedAt);
}

/**
 * Returns the top-level categories for a board (those with no parentCategoryId).
 */
export async function getTopLevelCategories(
  boardId: string,
): Promise<BookmarkCategory[]> {
  const all = await getCategories(boardId);
  return all.filter((c) => !c.parentCategoryId);
}

/**
 * Recursively builds a FolderNode tree for the given board.
 * Top-level nodes are categories without a parentCategoryId.
 */
export async function getFolderTree(boardId: string): Promise<FolderNode[]> {
  const raw = await db.getAllByIndex<BookmarkCategory>(CATEGORIES, 'boardId', boardId);
  const all = raw.filter((c) => !c.deletedAt);
  const byParent = new Map<string, BookmarkCategory[]>();
  for (const cat of all) {
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
}

/**
 * Returns the breadcrumb path from the root to the given folder
 * (inclusive). Returns [] if the folder doesn't exist.
 */
export async function getFolderPath(folderId: string): Promise<BookmarkCategory[]> {
  const path: BookmarkCategory[] = [];
  let current = await db.get<BookmarkCategory>(CATEGORIES, folderId);
  while (current) {
    path.unshift(current);
    if (!current.parentCategoryId) break;
    current = await db.get<BookmarkCategory>(CATEGORIES, current.parentCategoryId);
  }
  return path;
}

/**
 * Creates a sub-folder nested inside the given parent category.
 * Sub-folders are NOT added to the board's categoryIds (they live outside the
 * widget grid) and have no colSpan / rowSpan.
 */
export async function createSubFolder(
  parentCategoryId: string,
  name: string,
  boardId: string,
): Promise<BookmarkCategory> {
  await assertNoDuplicateName(name, boardId, parentCategoryId);
  const cat: BookmarkCategory = {
    id: generateId(),
    boardId,
    parentCategoryId,
    name,
    icon: '📁',
    color: '#6366f1',
    bookmarkIds: [],
    collapsed: false,
    cardType: 'bookmark',
    createdAt: nowISO(),
  };
  await db.put(CATEGORIES, cat);
  return cat;
}

/**
 * Recursively deletes a folder and all its sub-folders and entries.
 * Also removes the folder from the parent board's categoryIds if applicable.
 */
export async function deleteFolderRecursive(id: string): Promise<void> {
  // Soft-delete all entries in this category.
  const entries = await db.getAllByIndex<BookmarkEntry>(ENTRIES, 'categoryId', id);
  await softDeleteNewTabMany(ENTRIES, entries.map((e) => e.id));

  // Recursively soft-delete sub-folders.
  const subFolders = await db.getAllByIndex<BookmarkCategory>(CATEGORIES, 'parentCategoryId', id);
  await Promise.all(subFolders.map((sf) => deleteFolderRecursive(sf.id)));

  // Remove from board's categoryIds if it was a top-level category.
  const cat = await db.get<BookmarkCategory>(CATEGORIES, id);
  if (cat && !cat.parentCategoryId) {
    const board = await db.get<Board>(BOARDS, cat.boardId);
    if (board) {
      await db.put(BOARDS, {
        ...board,
        categoryIds: board.categoryIds.filter((cid) => cid !== id),
        updatedAt: nowISO(),
      });
    }
  }
  await softDeleteNewTab(CATEGORIES, id);
}

// ─── Native Import ─────────────────────────────────────────────────────────────

function flattenBookmarkTree(
  node: chrome.bookmarks.BookmarkTreeNode,
  boardId: string,
  promises: Promise<void>[],
): void {
  const children = node.children ?? [];
  const isFolder = !node.url;

  if (isFolder && node.title && children.length > 0) {
    const catId = generateId();
    const cat: BookmarkCategory = {
      id: catId,
      boardId,
      name: node.title,
      icon: '📁',
      color: '#6366f1',
      bookmarkIds: [],
      collapsed: false,
      createdAt: nowISO(),
    };
    promises.push(db.put(CATEGORIES, cat));

    for (const child of children) {
      if (child.url) {
        const entry: BookmarkEntry = {
          id: generateId(),
          categoryId: catId,
          title: child.title || child.url,
          url: child.url,
          favIconUrl: getFaviconUrl(child.url),
          addedAt: nowISO(),
          isNative: true,
          nativeId: child.id,
        };
        promises.push(db.put(ENTRIES, entry));
      } else {
        flattenBookmarkTree(child, boardId, promises);
      }
    }
  } else {
    for (const child of children) {
      flattenBookmarkTree(child, boardId, promises);
    }
  }
}

export async function importNativeBookmarks(
  boardId: string,
): Promise<{ imported: number }> {
  const tree = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>((resolve) => {
    chrome.bookmarks.getTree(resolve);
  });

  const promises: Promise<void>[] = [];
  for (const root of tree) {
    flattenBookmarkTree(root, boardId, promises);
  }
  await Promise.all(promises);
  return { imported: promises.length };
}
