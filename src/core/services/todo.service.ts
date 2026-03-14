import type { NewTabDB } from '@core/storage/newtab-storage';
import type { TodoItem, TodoList } from '@core/types/newtab.types';
import { generateId } from '@core/utils/uuid';
import { nowISO } from '@core/utils/date';

const LISTS = 'todoLists';
const ITEMS = 'todoItems';

// ─── TodoList ──────────────────────────────────────────────────────────────────

export async function getTodoLists(db: NewTabDB): Promise<TodoList[]> {
  const lists = await db.getAll<TodoList>(LISTS);
  return lists.sort((a, b) => a.position - b.position);
}

export async function saveTodoList(
  db: NewTabDB,
  data: Omit<TodoList, 'id' | 'createdAt'>,
): Promise<TodoList> {
  const list: TodoList = { ...data, id: generateId(), createdAt: nowISO() };
  await db.put(LISTS, list);
  return list;
}

export async function updateTodoList(
  db: NewTabDB,
  id: string,
  updates: Partial<Omit<TodoList, 'id' | 'createdAt'>>,
): Promise<void> {
  const existing = await db.get<TodoList>(LISTS, id);
  if (!existing) return;
  await db.put(LISTS, { ...existing, ...updates });
}

export async function deleteTodoList(db: NewTabDB, id: string): Promise<void> {
  const items = await db.getAllByIndex<TodoItem>(ITEMS, 'listId', id);
  await Promise.all(items.map((item) => db.delete(ITEMS, item.id)));
  await db.delete(LISTS, id);
}

// ─── TodoItem ──────────────────────────────────────────────────────────────────

export async function getTodoItems(db: NewTabDB, listId: string): Promise<TodoItem[]> {
  const items = await db.getAllByIndex<TodoItem>(ITEMS, 'listId', listId);
  return items.sort((a, b) => a.position - b.position);
}

export async function saveTodoItem(
  db: NewTabDB,
  data: Omit<TodoItem, 'id' | 'createdAt'>,
): Promise<TodoItem> {
  const item: TodoItem = { ...data, id: generateId(), createdAt: nowISO() };
  await db.put(ITEMS, item);
  return item;
}

export async function updateTodoItem(
  db: NewTabDB,
  id: string,
  updates: Partial<Omit<TodoItem, 'id' | 'createdAt'>>,
): Promise<void> {
  const existing = await db.get<TodoItem>(ITEMS, id);
  if (!existing) return;
  await db.put(ITEMS, { ...existing, ...updates });
}

export async function deleteTodoItem(db: NewTabDB, id: string): Promise<void> {
  await db.delete(ITEMS, id);
}

export async function reorderTodoItems(
  db: NewTabDB,
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
