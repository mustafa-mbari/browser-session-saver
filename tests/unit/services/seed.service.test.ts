import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { seedDefaultData } from '@core/services/seed.service';
import { newtabDB } from '@core/storage/newtab-storage';

describe('seedDefaultData', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
    (newtabDB as any).dbPromise = null;
  });

  it('returns mainBoard, bookmarksBoard, and todoList', async () => {
    const result = await seedDefaultData();
    expect(result.mainBoard).toBeDefined();
    expect(result.bookmarksBoard).toBeDefined();
    expect(result.todoList).toBeDefined();
  });

  it('mainBoard has name Main with 2 categories', async () => {
    const { mainBoard } = await seedDefaultData();
    expect(mainBoard.name).toBe('Main');
    expect(mainBoard.categoryIds).toHaveLength(2);
  });

  it('bookmarksBoard has name Bookmarks with no categories', async () => {
    const { bookmarksBoard } = await seedDefaultData();
    expect(bookmarksBoard.name).toBe('Bookmarks');
    expect(bookmarksBoard.categoryIds).toHaveLength(0);
  });

  it('todoList has name My Tasks', async () => {
    const { todoList } = await seedDefaultData();
    expect(todoList.name).toBe('My Tasks');
  });

  it('persists 2 boards to the DB', async () => {
    await seedDefaultData();
    const boards = await newtabDB.getAll('boards');
    expect(boards.length).toBe(2);
  });

  it('persists 2 bookmark categories to the DB', async () => {
    await seedDefaultData();
    const cats = await newtabDB.getAll('bookmarkCategories');
    expect(cats.length).toBe(2);
  });

  it('persists 3 default quick links to the DB', async () => {
    await seedDefaultData();
    const links = await newtabDB.getAll('quickLinks');
    expect(links.length).toBe(3);
  });

  it('assigns unique ids to all objects', async () => {
    const { mainBoard, bookmarksBoard, todoList } = await seedDefaultData();
    expect(mainBoard.id).not.toBe(bookmarksBoard.id);
    expect(mainBoard.id).not.toBe(todoList.id);
    expect(bookmarksBoard.id).not.toBe(todoList.id);
  });
});
