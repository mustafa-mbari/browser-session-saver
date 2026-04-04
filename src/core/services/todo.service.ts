import { newtabDB } from '@core/storage/newtab-storage';
import type { TodoItem, TodoList } from '@core/types/newtab.types';
import { generateId } from '@core/utils/uuid';
import { nowISO } from '@core/utils/date';

const db = newtabDB;

const LISTS = 'todoLists';
const ITEMS = 'todoItems';

// ─── TodoList ──────────────────────────────────────────────────────────────────

export async function getTodoLists(): Promise<TodoList[]> {
  const lists = await db.getAll<TodoList>(LISTS);
  return lists.sort((a, b) => a.position - b.position);
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
  await Promise.all(items.map((item) => db.delete(ITEMS, item.id)));
  await db.delete(LISTS, id);
}

// ─── TodoItem ──────────────────────────────────────────────────────────────────

export async function getTodoItems(listId: string): Promise<TodoItem[]> {
  const items = await db.getAllByIndex<TodoItem>(ITEMS, 'listId', listId);
  return items.sort((a, b) => a.position - b.position);
}

export async function saveTodoItem(
  data: Omit<TodoItem, 'id' | 'createdAt'>,
): Promise<TodoItem> {
  const item: TodoItem = { ...data, id: generateId(), createdAt: nowISO() };
  await db.put(ITEMS, item);
  return item;
}

export async function updateTodoItem(
  id: string,
  updates: Partial<Omit<TodoItem, 'id' | 'createdAt'>>,
): Promise<void> {
  const existing = await db.get<TodoItem>(ITEMS, id);
  if (!existing) return;
  await db.put(ITEMS, { ...existing, ...updates });
}

export async function deleteTodoItem(id: string): Promise<void> {
  await db.delete(ITEMS, id);
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
