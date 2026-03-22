import type { NewTabDB } from '@core/storage/newtab-storage';
import type { Board, BookmarkCategory, TodoList } from '@core/types/newtab.types';
import { generateId } from '@core/utils/uuid';

/** Returns ISO string staggered by `offsetMs` from a base time. */
function ts(base: number, offsetMs: number): string {
  return new Date(base + offsetMs).toISOString();
}

interface SeedResult {
  mainBoard: Board;
  bookmarksBoard: Board;
  todoList: TodoList;
}

/**
 * Seeds the two default boards (Main + Bookmarks) and a default TodoList.
 * Should only be called when the DB has no boards yet.
 */
export async function seedDefaultData(db: NewTabDB): Promise<SeedResult> {
  const base = Date.now();

  // ── Main board cards ──────────────────────────────────────────────────────

  const mainBoardId = generateId();

  const noteCard: BookmarkCategory = {
    id: generateId(),
    boardId: mainBoardId,
    name: 'Note',
    icon: '📝',
    color: '#f59e0b',
    bookmarkIds: [],
    collapsed: false,
    colSpan: 1,
    rowSpan: 1,
    cardType: 'note',
    noteContent: '',
    createdAt: ts(base, 0),
  };

  const clockCard: BookmarkCategory = {
    id: generateId(),
    boardId: mainBoardId,
    name: 'Clock',
    icon: '🕐',
    color: '#06b6d4',
    bookmarkIds: [],
    collapsed: false,
    colSpan: 1,
    rowSpan: 1,
    cardType: 'clock',
    createdAt: ts(base, 1),
  };

  const todoCard: BookmarkCategory = {
    id: generateId(),
    boardId: mainBoardId,
    name: 'To-Do',
    icon: '✅',
    color: '#22c55e',
    bookmarkIds: [],
    collapsed: false,
    colSpan: 1,
    rowSpan: 1,
    cardType: 'todo',
    noteContent: '[]',
    createdAt: ts(base, 2),
  };

  const privateCard: BookmarkCategory = {
    id: generateId(),
    boardId: mainBoardId,
    name: 'Private',
    icon: '📁',
    color: '#6366f1',
    bookmarkIds: [],
    collapsed: false,
    colSpan: 1,
    rowSpan: 2,
    cardType: 'bookmark',
    createdAt: ts(base, 3),
  };

  const workCard: BookmarkCategory = {
    id: generateId(),
    boardId: mainBoardId,
    name: 'Work',
    icon: '💼',
    color: '#3b82f6',
    bookmarkIds: [],
    collapsed: false,
    colSpan: 1,
    rowSpan: 2,
    cardType: 'bookmark',
    createdAt: ts(base, 4),
  };

  const mainCards = [noteCard, clockCard, todoCard, privateCard, workCard];

  const mainBoard: Board = {
    id: mainBoardId,
    name: 'Main',
    icon: '🏠',
    categoryIds: mainCards.map((c) => c.id),
    createdAt: ts(base, 0),
    updatedAt: ts(base, 0),
  };

  // ── Default TodoList (for the TodoWidget in Focus / Minimal layouts) ───────

  const todoList: TodoList = {
    id: generateId(),
    name: 'My Tasks',
    icon: '✅',
    position: 0,
    createdAt: ts(base, 0),
  };

  // ── Bookmarks board (empty — user populates via Folder Explorer) ─────────

  const bookmarksBoardId = generateId();

  const bookmarksBoard: Board = {
    id: bookmarksBoardId,
    name: 'Bookmarks',
    icon: '🔖',
    categoryIds: [],
    createdAt: ts(base, 1),
    updatedAt: ts(base, 1),
  };

  // ── Write everything to DB in one batch ───────────────────────────────────

  await Promise.all([
    db.put('boards', mainBoard),
    db.put('boards', bookmarksBoard),
    db.put('todoLists', todoList),
    ...mainCards.map((c) => db.put('bookmarkCategories', c)),
  ]);

  return { mainBoard, bookmarksBoard, todoList };
}
