import { newtabDB } from '@core/storage/newtab-storage';
import { softDeleteNewTab, softDeleteNewTabMany } from '@core/storage/newtab-soft-delete';
import type { TodoItem, TodoList, BookmarkCategory } from '@core/types/newtab.types';
import { generateId } from '@core/utils/uuid';
import { nowISO } from '@core/utils/date';
import { guardAction, trackAction } from '@core/services/limits/limit-guard';

const db = newtabDB;

const LISTS = 'todoLists';
const ITEMS = 'todoItems';

// ─── TodoList ──────────────────────────────────────────────────────────────────

export async function getTodoLists(): Promise<TodoList[]> {
  const lists = await db.getAll<TodoList>(LISTS);
  return lists
    .filter((l) => !l.deletedAt)
    .sort((a, b) => a.position - b.position);
}

export async function saveTodoList(
  data: Omit<TodoList, 'id' | 'createdAt'>,
): Promise<TodoList> {
  const list: TodoList = { ...data, id: generateId(), createdAt: nowISO() };
  await db.put(LISTS, list);
  return list;
}

export async function updateTodoList(
  id: string,
  updates: Partial<Omit<TodoList, 'id' | 'createdAt'>>,
): Promise<void> {
  const existing = await db.get<TodoList>(LISTS, id);
  if (!existing) return;
  await db.put(LISTS, { ...existing, ...updates });
}

export async function deleteTodoList(id: string): Promise<void> {
  const items = await db.getAllByIndex<TodoItem>(ITEMS, 'listId', id);
  await Promise.all(items.map((item) => removeTodoFromCardNoteContent(item.id)));
  await softDeleteNewTabMany(ITEMS, items.map((i) => i.id));
  await softDeleteNewTab(LISTS, id);
}

// ─── TodoItem ──────────────────────────────────────────────────────────────────

export async function getTodoItems(listId: string): Promise<TodoItem[]> {
  const items = await db.getAllByIndex<TodoItem>(ITEMS, 'listId', listId);
  return items
    .filter((i) => !i.deletedAt)
    .sort((a, b) => a.position - b.position);
}

export async function saveTodoItem(
  data: Omit<TodoItem, 'id' | 'createdAt'>,
): Promise<TodoItem> {
  await guardAction();
  const item: TodoItem = { ...data, id: generateId(), createdAt: nowISO() };
  await db.put(ITEMS, item);
  void trackAction();
  return item;
}

export async function updateTodoItem(
  id: string,
  updates: Partial<Omit<TodoItem, 'id' | 'createdAt'>>,
): Promise<void> {
  await guardAction();
  const existing = await db.get<TodoItem>(ITEMS, id);
  if (!existing) return;
  await db.put(ITEMS, { ...existing, ...updates });
  void trackAction();
}

export async function deleteTodoItem(id: string): Promise<void> {
  await guardAction();
  await softDeleteNewTab(ITEMS, id);
  await removeTodoFromCardNoteContent(id);
  void trackAction();
}

export async function reorderTodoItems(
  listId: string,
  orderedIds: string[],
): Promise<void> {
  const items = await db.getAllByIndex<TodoItem>(ITEMS, 'listId', listId);
  const map = new Map(items.map((i) => [i.id, i]));
  await Promise.all(
    orderedIds.map((id, index) => {
      const item = map.get(id);
      if (item) return db.put(ITEMS, { ...item, position: index });
      return Promise.resolve();
    }),
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function removeTodoFromCardNoteContent(itemId: string): Promise<void> {
  const allCats = await db.getAll<BookmarkCategory>('bookmarkCategories');
  for (const cat of allCats) {
    if (cat.cardType !== 'todo' || !cat.noteContent) continue;
    let items: { id: string; text: string; done: boolean }[];
    try { items = JSON.parse(cat.noteContent); } catch { continue; }
    const filtered = items.filter((i) => i.id !== itemId);
    if (filtered.length !== items.length) {
      await db.put<BookmarkCategory>('bookmarkCategories', {
        ...cat,
        noteContent: JSON.stringify(filtered),
      });
    }
  }
}
