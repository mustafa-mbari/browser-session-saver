import type { NewTabDB } from '@core/storage/newtab-storage';
import type { Board, BookmarkCategory, BookmarkEntry } from '@core/types/newtab.types';
import { generateId } from '@core/utils/uuid';
import { nowISO } from '@core/utils/date';
import { getFaviconUrl } from '@core/utils/favicon';

const BOARDS = 'boards';
const CATEGORIES = 'bookmarkCategories';
const ENTRIES = 'bookmarkEntries';

// ─── Boards ───────────────────────────────────────────────────────────────────

export async function getBoards(db: NewTabDB): Promise<Board[]> {
  const boards = await db.getAll<Board>(BOARDS);
  return boards.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveBoard(
  db: NewTabDB,
  data: Omit<Board, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Board> {
  const now = nowISO();
  const board: Board = { ...data, id: generateId(), createdAt: now, updatedAt: now };
  await db.put(BOARDS, board);
  return board;
}

export async function updateBoard(
  db: NewTabDB,
  id: string,
  updates: Partial<Omit<Board, 'id' | 'createdAt'>>,
): Promise<void> {
  const existing = await db.get<Board>(BOARDS, id);
  if (!existing) return;
  await db.put(BOARDS, { ...existing, ...updates, updatedAt: nowISO() });
}

export async function deleteBoard(db: NewTabDB, id: string): Promise<void> {
  const categories = await db.getAllByIndex<BookmarkCategory>(CATEGORIES, 'boardId', id);
  await Promise.all(
    categories.map(async (cat) => {
      const entries = await db.getAllByIndex<BookmarkEntry>(ENTRIES, 'categoryId', cat.id);
      await Promise.all(entries.map((e) => db.delete(ENTRIES, e.id)));
      await db.delete(CATEGORIES, cat.id);
    }),
  );
  await db.delete(BOARDS, id);
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(db: NewTabDB, boardId: string): Promise<BookmarkCategory[]> {
  const cats = await db.getAllByIndex<BookmarkCategory>(CATEGORIES, 'boardId', boardId);
  const board = await db.get<Board>(BOARDS, boardId);
  if (board && board.categoryIds.length > 0) {
    const order = new Map(board.categoryIds.map((id, idx) => [id, idx]));
    return cats.sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
  }
  return cats.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveCategory(
  db: NewTabDB,
  data: Omit<BookmarkCategory, 'id' | 'createdAt'>,
): Promise<BookmarkCategory> {
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
  return cat;
}

export async function updateCategory(
  db: NewTabDB,
  id: string,
  updates: Partial<Omit<BookmarkCategory, 'id' | 'createdAt'>>,
): Promise<void> {
  const existing = await db.get<BookmarkCategory>(CATEGORIES, id);
  if (!existing) return;
  await db.put(CATEGORIES, { ...existing, ...updates });
}

export async function deleteCategory(db: NewTabDB, id: string): Promise<void> {
  const entries = await db.getAllByIndex<BookmarkEntry>(ENTRIES, 'categoryId', id);
  await Promise.all(entries.map((e) => db.delete(ENTRIES, e.id)));

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
  await db.delete(CATEGORIES, id);
}

// ─── Entries ──────────────────────────────────────────────────────────────────

export async function getEntries(db: NewTabDB, categoryId: string): Promise<BookmarkEntry[]> {
  const entries = await db.getAllByIndex<BookmarkEntry>(ENTRIES, 'categoryId', categoryId);
  const cat = await db.get<BookmarkCategory>(CATEGORIES, categoryId);
  if (cat && cat.bookmarkIds.length > 0) {
    const order = new Map(cat.bookmarkIds.map((id, idx) => [id, idx]));
    return entries.sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
  }
  return entries.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export async function saveEntry(
  db: NewTabDB,
  data: Omit<BookmarkEntry, 'id' | 'addedAt'>,
): Promise<BookmarkEntry> {
  const entry: BookmarkEntry = { ...data, id: generateId(), addedAt: nowISO() };
  await db.put(ENTRIES, entry);

  const cat = await db.get<BookmarkCategory>(CATEGORIES, data.categoryId);
  if (cat) {
    await db.put(CATEGORIES, { ...cat, bookmarkIds: [...cat.bookmarkIds, entry.id] });
  }
  return entry;
}

export async function updateEntry(
  db: NewTabDB,
  id: string,
  updates: Partial<Omit<BookmarkEntry, 'id' | 'addedAt'>>,
): Promise<void> {
  const existing = await db.get<BookmarkEntry>(ENTRIES, id);
  if (!existing) return;
  await db.put(ENTRIES, { ...existing, ...updates });
}

export async function deleteEntry(db: NewTabDB, id: string): Promise<void> {
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
  await db.delete(ENTRIES, id);
}

// ─── Native Import ─────────────────────────────────────────────────────────────

function flattenBookmarkTree(
  node: chrome.bookmarks.BookmarkTreeNode,
  boardId: string,
  db: NewTabDB,
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
        flattenBookmarkTree(child, boardId, db, promises);
      }
    }
  } else {
    for (const child of children) {
      flattenBookmarkTree(child, boardId, db, promises);
    }
  }
}

export async function importNativeBookmarks(
  db: NewTabDB,
  boardId: string,
): Promise<{ imported: number }> {
  const tree = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>((resolve) => {
    chrome.bookmarks.getTree(resolve);
  });

  const promises: Promise<void>[] = [];
  for (const root of tree) {
    flattenBookmarkTree(root, boardId, db, promises);
  }
  await Promise.all(promises);
  return { imported: promises.length };
}
