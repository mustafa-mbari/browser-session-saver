import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@core/storage/newtab-storage', () => ({ newtabDB: {} }));

vi.mock('@core/services/bookmark.service', () => ({
  getBoards: vi.fn(),
  getAllCategories: vi.fn(),
  getAllEntries: vi.fn(),
  createTopLevelFolder: vi.fn(),
  createSubFolder: vi.fn(),
  updateCategory: vi.fn(),
  deleteFolderRecursive: vi.fn(),
  saveEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
}));

import { useBookmarkFolderData } from '@shared/hooks/useBookmarkFolderData';
import * as BookmarkService from '@core/services/bookmark.service';
import type { Board, BookmarkCategory, BookmarkEntry } from '@core/types/newtab.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBoard(overrides: Partial<Board> = {}): Board {
  return { id: 'board1', name: 'Board', categoryIds: [], ...overrides };
}

function makeCat(overrides: Partial<BookmarkCategory> = {}): BookmarkCategory {
  return {
    id: 'cat1',
    boardId: 'board1',
    name: 'Category',
    type: 'bookmark',
    bookmarkIds: [],
    color: '#fff',
    colSpan: 1,
    rowSpan: 1,
    position: 0,
    parentCategoryId: undefined,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<BookmarkEntry> = {}): BookmarkEntry {
  return {
    id: 'entry1',
    categoryId: 'cat1',
    title: 'Entry',
    url: 'https://example.com',
    favIconUrl: '',
    isNative: false,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useBookmarkFolderData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(BookmarkService.getBoards).mockResolvedValue([]);
    vi.mocked(BookmarkService.getAllCategories).mockResolvedValue([]);
    vi.mocked(BookmarkService.getAllEntries).mockResolvedValue([]);
  });

  it('loads boards, categories, and entries on mount', async () => {
    const board = makeBoard();
    const cat = makeCat();
    const entry = makeEntry();

    vi.mocked(BookmarkService.getBoards).mockResolvedValueOnce([board]);
    vi.mocked(BookmarkService.getAllCategories).mockResolvedValueOnce([cat]);
    vi.mocked(BookmarkService.getAllEntries).mockResolvedValueOnce([entry]);

    const { result } = renderHook(() => useBookmarkFolderData());

    await act(async () => { await Promise.resolve(); });

    expect(result.current.boards).toHaveLength(1);
    expect(result.current.categories).toHaveLength(1);
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error when loading fails', async () => {
    vi.mocked(BookmarkService.getBoards).mockRejectedValueOnce(new Error('DB error'));

    const { result } = renderHook(() => useBookmarkFolderData());

    await act(async () => { await Promise.resolve(); });

    expect(result.current.error).toContain('DB error');
  });

  it('getFolderTreeForBoard builds nested tree from flat categories', async () => {
    const board = makeBoard({ id: 'b1' });
    const root = makeCat({ id: 'root', boardId: 'b1', parentCategoryId: undefined });
    const child = makeCat({ id: 'child', boardId: 'b1', parentCategoryId: 'root' });
    const grandchild = makeCat({ id: 'grandchild', boardId: 'b1', parentCategoryId: 'child' });

    vi.mocked(BookmarkService.getBoards).mockResolvedValueOnce([board]);
    vi.mocked(BookmarkService.getAllCategories).mockResolvedValueOnce([root, child, grandchild]);
    vi.mocked(BookmarkService.getAllEntries).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useBookmarkFolderData());
    await act(async () => { await Promise.resolve(); });

    const tree = result.current.getFolderTreeForBoard('b1');

    expect(tree).toHaveLength(1);
    expect(tree[0].folder.id).toBe('root');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].folder.id).toBe('child');
    expect(tree[0].children[0].children[0].folder.id).toBe('grandchild');
  });

  it('getFolderPath returns breadcrumb from leaf to root', async () => {
    const root = makeCat({ id: 'root', boardId: 'b1', name: 'Root', parentCategoryId: undefined });
    const child = makeCat({ id: 'child', boardId: 'b1', name: 'Child', parentCategoryId: 'root' });
    const leaf = makeCat({ id: 'leaf', boardId: 'b1', name: 'Leaf', parentCategoryId: 'child' });

    vi.mocked(BookmarkService.getBoards).mockResolvedValueOnce([makeBoard({ id: 'b1' })]);
    vi.mocked(BookmarkService.getAllCategories).mockResolvedValueOnce([root, child, leaf]);
    vi.mocked(BookmarkService.getAllEntries).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useBookmarkFolderData());
    await act(async () => { await Promise.resolve(); });

    const path = result.current.getFolderPath('leaf');

    expect(path.map((c) => c.name)).toEqual(['Root', 'Child', 'Leaf']);
  });

  it('deleteFolder removes folder and its children from state', async () => {
    const parent = makeCat({ id: 'parent', boardId: 'b1', parentCategoryId: undefined });
    const child = makeCat({ id: 'child-cat', boardId: 'b1', parentCategoryId: 'parent' });
    const entry = makeEntry({ id: 'e1', categoryId: 'child-cat' });

    vi.mocked(BookmarkService.getBoards).mockResolvedValueOnce([makeBoard({ id: 'b1', categoryIds: ['parent'] })]);
    vi.mocked(BookmarkService.getAllCategories).mockResolvedValueOnce([parent, child]);
    vi.mocked(BookmarkService.getAllEntries).mockResolvedValueOnce([entry]);
    vi.mocked(BookmarkService.deleteFolderRecursive).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useBookmarkFolderData());
    await act(async () => { await Promise.resolve(); });

    expect(result.current.categories).toHaveLength(2);
    expect(result.current.entries).toHaveLength(1);

    await act(async () => { await result.current.deleteFolder('parent'); });

    expect(result.current.categories).toHaveLength(0);
    expect(result.current.entries).toHaveLength(0);
    expect(BookmarkService.deleteFolderRecursive).toHaveBeenCalled();
  });

  it('addEntry saves to service and updates local state', async () => {
    const cat = makeCat({ id: 'cat1', bookmarkIds: [] });
    const newEntry = makeEntry({ id: 'new-entry', categoryId: 'cat1' });

    vi.mocked(BookmarkService.getBoards).mockResolvedValueOnce([makeBoard()]);
    vi.mocked(BookmarkService.getAllCategories).mockResolvedValueOnce([cat]);
    vi.mocked(BookmarkService.getAllEntries).mockResolvedValueOnce([]);
    vi.mocked(BookmarkService.saveEntry).mockResolvedValueOnce(newEntry);

    const { result } = renderHook(() => useBookmarkFolderData());
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.addEntry('cat1', 'My Bookmark', 'https://example.com');
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).toBe('new-entry');
    // bookmarkIds on the category should be updated
    const updatedCat = result.current.categories.find((c) => c.id === 'cat1');
    expect(updatedCat?.bookmarkIds).toContain('new-entry');
  });

  it('saveCurrentTab uses active tab from chrome.tabs.query', async () => {
    vi.mocked(BookmarkService.getBoards).mockResolvedValueOnce([makeBoard()]);
    vi.mocked(BookmarkService.getAllCategories).mockResolvedValueOnce([makeCat({ bookmarkIds: [] })]);
    vi.mocked(BookmarkService.getAllEntries).mockResolvedValueOnce([]);

    const mockTab = { id: 99, url: 'https://github.com', title: 'GitHub', active: true } as chrome.tabs.Tab;
    vi.mocked(chrome.tabs.query).mockImplementation(
      ((_q: chrome.tabs.QueryInfo, cb: (tabs: chrome.tabs.Tab[]) => void) => {
        cb([mockTab]);
      }) as typeof chrome.tabs.query,
    );

    const savedEntry = makeEntry({ id: 'tab-entry', url: 'https://github.com', title: 'GitHub' });
    vi.mocked(BookmarkService.saveEntry).mockResolvedValueOnce(savedEntry);

    const { result } = renderHook(() => useBookmarkFolderData());
    await act(async () => { await Promise.resolve(); });

    let returned: BookmarkEntry | null = null;
    await act(async () => {
      returned = await result.current.saveCurrentTab('cat1');
    });

    expect(returned?.url).toBe('https://github.com');
    expect(BookmarkService.saveEntry).toHaveBeenCalled();
  });
});
