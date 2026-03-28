import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { NewTabDB } from '@core/storage/newtab-storage';
import {
  getBoards,
  saveBoard,
  updateBoard,
  deleteBoard,
  getCategories,
  saveCategory,
  updateCategory,
  deleteCategory,
  getEntries,
  saveEntry,
  updateEntry,
  deleteEntry,
  getFolderTree,
  getFolderPath,
  createSubFolder,
  deleteFolderRecursive,
  getAllCategories,
  importNativeBookmarks,
} from '@core/services/bookmark.service';

let db: NewTabDB;

beforeEach(() => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  db = new NewTabDB();
});

// ── Boards ────────────────────────────────────────────────────────────────────

describe('Board CRUD', () => {
  it('getBoards returns empty array initially', async () => {
    expect(await getBoards(db)).toEqual([]);
  });

  it('saveBoard creates a board with id and timestamps', async () => {
    const board = await saveBoard(db, { name: 'Work', icon: '💼', categoryIds: [] });
    expect(board.id).toBeTruthy();
    expect(board.name).toBe('Work');
    expect(board.createdAt).toBeTruthy();
  });

  it('getBoards returns saved boards sorted by createdAt', async () => {
    await saveBoard(db, { name: 'A', icon: '📌', categoryIds: [] });
    await saveBoard(db, { name: 'B', icon: '📎', categoryIds: [] });
    const boards = await getBoards(db);
    expect(boards).toHaveLength(2);
  });

  it('updateBoard modifies the board', async () => {
    const board = await saveBoard(db, { name: 'Old', icon: '🔵', categoryIds: [] });
    await updateBoard(db, board.id, { name: 'New' });
    const boards = await getBoards(db);
    expect(boards[0].name).toBe('New');
  });

  it('deleteBoard removes the board and its categories and entries', async () => {
    const board = await saveBoard(db, { name: 'Delete me', icon: '🗑️', categoryIds: [] });
    const cat = await saveCategory(db, {
      boardId: board.id,
      name: 'Cat',
      icon: '📁',
      color: '#fff',
      bookmarkIds: [],
      collapsed: false,
    });
    await saveEntry(db, {
      categoryId: cat.id,
      title: 'Entry',
      url: 'https://example.com',
      favIconUrl: '',
      isNative: false,
    });

    await deleteBoard(db, board.id);
    expect(await getBoards(db)).toEqual([]);
    expect(await getCategories(db, board.id)).toEqual([]);
    expect(await getEntries(db, cat.id)).toEqual([]);
  });
});

// ── Categories ────────────────────────────────────────────────────────────────

describe('Category CRUD', () => {
  let boardId: string;

  beforeEach(async () => {
    const board = await saveBoard(db, { name: 'Test Board', icon: '📌', categoryIds: [] });
    boardId = board.id;
  });

  it('saveCategory creates a category and adds it to board.categoryIds', async () => {
    const cat = await saveCategory(db, {
      boardId,
      name: 'Links',
      icon: '🔗',
      color: '#fff',
      bookmarkIds: [],
      collapsed: false,
    });
    expect(cat.id).toBeTruthy();
    const boards = await getBoards(db);
    expect(boards[0].categoryIds).toContain(cat.id);
  });

  it('updateCategory modifies category fields', async () => {
    const cat = await saveCategory(db, {
      boardId,
      name: 'Old',
      icon: '📁',
      color: '#000',
      bookmarkIds: [],
      collapsed: false,
    });
    await updateCategory(db, cat.id, { name: 'New', collapsed: true });
    const cats = await getCategories(db, boardId);
    expect(cats[0].name).toBe('New');
    expect(cats[0].collapsed).toBe(true);
  });

  it('deleteCategory removes category, its entries, and removes from board.categoryIds', async () => {
    const cat = await saveCategory(db, {
      boardId,
      name: 'To Delete',
      icon: '📁',
      color: '#fff',
      bookmarkIds: [],
      collapsed: false,
    });
    await saveEntry(db, {
      categoryId: cat.id,
      title: 'Entry',
      url: 'https://x.com',
      favIconUrl: '',
      isNative: false,
    });

    await deleteCategory(db, cat.id);
    expect(await getCategories(db, boardId)).toHaveLength(0);
    expect(await getEntries(db, cat.id)).toHaveLength(0);
    const boards = await getBoards(db);
    expect(boards[0].categoryIds).not.toContain(cat.id);
  });
});

// ── Entries ───────────────────────────────────────────────────────────────────

describe('Entry CRUD', () => {
  let catId: string;

  beforeEach(async () => {
    const board = await saveBoard(db, { name: 'B', icon: '📌', categoryIds: [] });
    const cat = await saveCategory(db, {
      boardId: board.id,
      name: 'C',
      icon: '📁',
      color: '#fff',
      bookmarkIds: [],
      collapsed: false,
    });
    catId = cat.id;
  });

  it('saveEntry creates an entry and appends to category.bookmarkIds', async () => {
    const entry = await saveEntry(db, {
      categoryId: catId,
      title: 'GitHub',
      url: 'https://github.com',
      favIconUrl: '',
      isNative: false,
    });
    expect(entry.id).toBeTruthy();
    expect(entry.addedAt).toBeTruthy();
  });

  it('getEntries returns sorted entries', async () => {
    await saveEntry(db, { categoryId: catId, title: 'A', url: 'https://a.com', favIconUrl: '', isNative: false });
    await saveEntry(db, { categoryId: catId, title: 'B', url: 'https://b.com', favIconUrl: '', isNative: false });
    const entries = await getEntries(db, catId);
    expect(entries).toHaveLength(2);
  });

  it('updateEntry modifies entry fields', async () => {
    const entry = await saveEntry(db, {
      categoryId: catId,
      title: 'Old Title',
      url: 'https://old.com',
      favIconUrl: '',
      isNative: false,
    });
    await updateEntry(db, entry.id, { title: 'New Title' });
    const entries = await getEntries(db, catId);
    expect(entries[0].title).toBe('New Title');
  });

  it('deleteEntry removes entry and removes from category.bookmarkIds', async () => {
    const entry = await saveEntry(db, {
      categoryId: catId,
      title: 'Del',
      url: 'https://del.com',
      favIconUrl: '',
      isNative: false,
    });
    await deleteEntry(db, entry.id);
    expect(await getEntries(db, catId)).toHaveLength(0);
  });
});

// ── Folder tree ───────────────────────────────────────────────────────────────

describe('getFolderTree', () => {
  it('returns a nested tree of categories', async () => {
    const board = await saveBoard(db, { name: 'B', icon: '📌', categoryIds: [] });
    const parent = await saveCategory(db, {
      boardId: board.id,
      name: 'Parent',
      icon: '📁',
      color: '#fff',
      bookmarkIds: [],
      collapsed: false,
    });
    const child = await createSubFolder(db, parent.id, 'Child', board.id);

    const tree = await getFolderTree(db, board.id);
    expect(tree).toHaveLength(1);
    expect(tree[0].folder.id).toBe(parent.id);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].folder.id).toBe(child.id);
  });
});

// ── getFolderPath ─────────────────────────────────────────────────────────────

describe('getFolderPath', () => {
  it('returns breadcrumb path from root to folder', async () => {
    const board = await saveBoard(db, { name: 'B', icon: '📌', categoryIds: [] });
    const root = await saveCategory(db, {
      boardId: board.id,
      name: 'Root',
      icon: '📁',
      color: '#fff',
      bookmarkIds: [],
      collapsed: false,
    });
    const child = await createSubFolder(db, root.id, 'Child', board.id);
    const grandchild = await createSubFolder(db, child.id, 'Grandchild', board.id);

    const path = await getFolderPath(db, grandchild.id);
    expect(path).toHaveLength(3);
    expect(path[0].id).toBe(root.id);
    expect(path[1].id).toBe(child.id);
    expect(path[2].id).toBe(grandchild.id);
  });

  it('returns empty array for non-existent folder', async () => {
    const path = await getFolderPath(db, 'no-such-id');
    expect(path).toEqual([]);
  });
});

// ── deleteFolderRecursive ─────────────────────────────────────────────────────

describe('deleteFolderRecursive', () => {
  it('deletes folder, sub-folders, and entries recursively', async () => {
    const board = await saveBoard(db, { name: 'B', icon: '📌', categoryIds: [] });
    const parent = await saveCategory(db, {
      boardId: board.id,
      name: 'Parent',
      icon: '📁',
      color: '#fff',
      bookmarkIds: [],
      collapsed: false,
    });
    const child = await createSubFolder(db, parent.id, 'Child', board.id);
    await saveEntry(db, {
      categoryId: parent.id,
      title: 'Entry',
      url: 'https://example.com',
      favIconUrl: '',
      isNative: false,
    });

    await deleteFolderRecursive(db, parent.id);

    const all = await getAllCategories(db);
    expect(all.find((c) => c.id === parent.id)).toBeUndefined();
    expect(all.find((c) => c.id === child.id)).toBeUndefined();
    expect(await getEntries(db, parent.id)).toHaveLength(0);
  });
});

// ── importNativeBookmarks ─────────────────────────────────────────────────────

describe('importNativeBookmarks', () => {
  it('imports chrome bookmark tree into the db', async () => {
    const board = await saveBoard(db, { name: 'Imported', icon: '🌐', categoryIds: [] });

    vi.mocked(chrome.bookmarks.getTree).mockImplementation((cb) => {
      cb([{
        id: '0',
        title: '',
        children: [{
          id: '1',
          title: 'Bookmarks Bar',
          children: [
            { id: '2', title: 'GitHub', url: 'https://github.com' },
            { id: '3', title: 'MDN', url: 'https://developer.mozilla.org' },
          ],
        }],
      }]);
    });

    const { imported } = await importNativeBookmarks(db, board.id);
    // imported counts: 1 category + 2 entries = 3 promises
    expect(imported).toBeGreaterThan(0);
    const cats = await getCategories(db, board.id);
    expect(cats.length).toBeGreaterThan(0);
  });
});
