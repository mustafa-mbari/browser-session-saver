import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { NewTabDB } from '@core/storage/newtab-storage';

let db: NewTabDB;

beforeEach(() => {
  // Provide a completely fresh IndexedDB environment for every test
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  db = new NewTabDB();
});

describe('NewTabDB', () => {
  // ---------------------------------------------------------------------------
  describe('put / get / getAll', () => {
    it('getAll returns an empty array when the store has no records', async () => {
      const result = await db.getAll<{ id: string }>('boards');
      expect(result).toEqual([]);
    });

    it('get returns null for a missing key', async () => {
      expect(await db.get('boards', 'nonexistent')).toBeNull();
    });

    it('put then get round-trips the full record', async () => {
      const board = { id: 'b1', title: 'My Board', order: 0 };
      await db.put('boards', board);
      const result = await db.get<typeof board>('boards', 'b1');
      expect(result).toEqual(board);
    });

    it('getAll returns all stored records', async () => {
      await db.put('boards', { id: 'b1', title: 'A' });
      await db.put('boards', { id: 'b2', title: 'B' });
      const result = await db.getAll<{ id: string; title: string }>('boards');
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id).sort()).toEqual(['b1', 'b2']);
    });

    it('put overwrites an existing record with the same id', async () => {
      await db.put('boards', { id: 'b1', title: 'Original' });
      await db.put('boards', { id: 'b1', title: 'Updated' });
      const result = await db.get<{ id: string; title: string }>('boards', 'b1');
      expect(result?.title).toBe('Updated');
    });

    it('todoLists store operates independently from boards', async () => {
      await db.put('boards', { id: 'x', title: 'Board' });
      await db.put('todoLists', { id: 'x', title: 'List' });
      const boards = await db.getAll('boards');
      const lists = await db.getAll('todoLists');
      expect(boards).toHaveLength(1);
      expect(lists).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe('delete', () => {
    it('removes a record so get returns null', async () => {
      await db.put('boards', { id: 'b1', title: 'A' });
      await db.delete('boards', 'b1');
      expect(await db.get('boards', 'b1')).toBeNull();
    });

    it('does not throw when deleting a non-existent id', async () => {
      await expect(db.delete('boards', 'ghost')).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  describe('getAllByIndex', () => {
    it('returns only records matching the indexed field', async () => {
      await db.put('bookmarkCategories', { id: 'c1', boardId: 'board-A', title: 'Cat 1' });
      await db.put('bookmarkCategories', { id: 'c2', boardId: 'board-A', title: 'Cat 2' });
      await db.put('bookmarkCategories', { id: 'c3', boardId: 'board-B', title: 'Cat 3' });

      const result = await db.getAllByIndex<{ id: string }>(
        'bookmarkCategories',
        'boardId',
        'board-A',
      );
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id).sort()).toEqual(['c1', 'c2']);
    });

    it('returns an empty array when no records match the index value', async () => {
      const result = await db.getAllByIndex('bookmarkCategories', 'boardId', 'no-match');
      expect(result).toEqual([]);
    });

    it('todoItems index by listId works', async () => {
      await db.put('todoItems', { id: 'i1', listId: 'l1', text: 'Buy milk' });
      await db.put('todoItems', { id: 'i2', listId: 'l2', text: 'Call bank' });

      const result = await db.getAllByIndex<{ id: string }>('todoItems', 'listId', 'l1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('i1');
    });
  });

  // ---------------------------------------------------------------------------
  describe('putBlob / getBlob / deleteBlob', () => {
    it('stores and retrieves a blob by id', async () => {
      const blob = new Blob(['hello'], { type: 'text/plain' });
      await db.putBlob('wp1', blob);
      const result = await db.getBlob('wp1');
      expect(result).not.toBeNull();
    });

    it('getBlob returns null for a missing id', async () => {
      expect(await db.getBlob('nope')).toBeNull();
    });

    it('deleteBlob removes the stored blob', async () => {
      const blob = new Blob(['data'], { type: 'image/png' });
      await db.putBlob('wp1', blob);
      await db.deleteBlob('wp1');
      expect(await db.getBlob('wp1')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  describe('clearAll', () => {
    it('empties every object store', async () => {
      await db.put('boards', { id: 'b1', title: 'Board' });
      await db.put('todoLists', { id: 'l1', title: 'List' });
      await db.put('quickLinks', { id: 'q1', url: 'https://a.com' });
      await db.put('bookmarkCategories', { id: 'c1', boardId: 'b1', title: 'Cat' });

      await db.clearAll();

      expect(await db.getAll('boards')).toHaveLength(0);
      expect(await db.getAll('todoLists')).toHaveLength(0);
      expect(await db.getAll('quickLinks')).toHaveLength(0);
      expect(await db.getAll('bookmarkCategories')).toHaveLength(0);
    });
  });
});
