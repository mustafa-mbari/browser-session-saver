import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { newtabDB } from '@core/storage/newtab-storage';
import {
  getTodoLists,
  saveTodoList,
  updateTodoList,
  deleteTodoList,
  getTodoItems,
  saveTodoItem,
  updateTodoItem,
  deleteTodoItem,
  reorderTodoItems,
} from '@core/services/todo.service';

beforeEach(() => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  (newtabDB as any).dbPromise = null;
});

// ── TodoList ──────────────────────────────────────────────────────────────────

describe('TodoList CRUD', () => {
  it('getTodoLists returns empty array initially', async () => {
    expect(await getTodoLists()).toEqual([]);
  });

  it('saveTodoList creates a list with id and createdAt', async () => {
    const list = await saveTodoList({ name: 'Work', icon: '💼', position: 0 });
    expect(list.id).toBeTruthy();
    expect(list.name).toBe('Work');
    expect(list.createdAt).toBeTruthy();
  });

  it('getTodoLists returns lists sorted by position', async () => {
    await saveTodoList({ name: 'Second', icon: '📋', position: 1 });
    await saveTodoList({ name: 'First', icon: '📋', position: 0 });
    const lists = await getTodoLists();
    expect(lists[0].name).toBe('First');
    expect(lists[1].name).toBe('Second');
  });

  it('updateTodoList modifies the list', async () => {
    const list = await saveTodoList({ name: 'Old', icon: '📋', position: 0 });
    await updateTodoList(list.id, { name: 'New' });
    const lists = await getTodoLists();
    expect(lists[0].name).toBe('New');
  });

  it('updateTodoList is a no-op for unknown id', async () => {
    await updateTodoList('no-such-id', { name: 'Whatever' });
    expect(await getTodoLists()).toHaveLength(0);
  });

  it('deleteTodoList removes list and its items', async () => {
    const list = await saveTodoList({ name: 'Delete me', icon: '🗑️', position: 0 });
    await saveTodoItem({
      listId: list.id,
      text: 'Task',
      completed: false,
      priority: 'none',
      position: 0,
    });

    await deleteTodoList(list.id);
    expect(await getTodoLists()).toHaveLength(0);
    expect(await getTodoItems(list.id)).toHaveLength(0);
  });
});

// ── TodoItem ──────────────────────────────────────────────────────────────────

describe('TodoItem CRUD', () => {
  let listId: string;

  beforeEach(async () => {
    const list = await saveTodoList({ name: 'My List', icon: '📋', position: 0 });
    listId = list.id;
  });

  it('getTodoItems returns empty array initially', async () => {
    expect(await getTodoItems(listId)).toEqual([]);
  });

  it('saveTodoItem creates item with id and createdAt', async () => {
    const item = await saveTodoItem({
      listId,
      text: 'Buy groceries',
      completed: false,
      priority: 'high',
      position: 0,
    });
    expect(item.id).toBeTruthy();
    expect(item.text).toBe('Buy groceries');
    expect(item.createdAt).toBeTruthy();
  });

  it('getTodoItems returns items sorted by position', async () => {
    await saveTodoItem({ listId, text: 'B', completed: false, priority: 'none', position: 1 });
    await saveTodoItem({ listId, text: 'A', completed: false, priority: 'none', position: 0 });
    const items = await getTodoItems(listId);
    expect(items[0].text).toBe('A');
    expect(items[1].text).toBe('B');
  });

  it('updateTodoItem modifies item fields', async () => {
    const item = await saveTodoItem({
      listId,
      text: 'Old text',
      completed: false,
      priority: 'none',
      position: 0,
    });
    await updateTodoItem(item.id, { text: 'New text', completed: true });
    const items = await getTodoItems(listId);
    expect(items[0].text).toBe('New text');
    expect(items[0].completed).toBe(true);
  });

  it('updateTodoItem is a no-op for unknown id', async () => {
    await updateTodoItem('no-such-id', { text: 'X' });
    expect(await getTodoItems(listId)).toHaveLength(0);
  });

  it('deleteTodoItem removes the item', async () => {
    const item = await saveTodoItem({
      listId,
      text: 'Delete me',
      completed: false,
      priority: 'none',
      position: 0,
    });
    await deleteTodoItem(item.id);
    expect(await getTodoItems(listId)).toHaveLength(0);
  });
});

// ── reorderTodoItems ──────────────────────────────────────────────────────────

describe('reorderTodoItems', () => {
  it('updates item positions based on ordered id array', async () => {
    const list = await saveTodoList({ name: 'L', icon: '📋', position: 0 });
    const a = await saveTodoItem({ listId: list.id, text: 'A', completed: false, priority: 'none', position: 0 });
    const b = await saveTodoItem({ listId: list.id, text: 'B', completed: false, priority: 'none', position: 1 });
    const c = await saveTodoItem({ listId: list.id, text: 'C', completed: false, priority: 'none', position: 2 });

    // Reorder: C, A, B
    await reorderTodoItems(list.id, [c.id, a.id, b.id]);

    const items = await getTodoItems(list.id);
    expect(items[0].text).toBe('C');
    expect(items[1].text).toBe('A');
    expect(items[2].text).toBe('B');
  });
});
