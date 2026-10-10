import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { newtabDB } from '@core/storage/newtab-storage';
import { purgeNewTabTombstones, softDeleteNewTab } from '@core/storage/newtab-soft-delete';

beforeEach(() => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  (newtabDB as unknown as { dbPromise: unknown }).dbPromise = null;
});

describe('purgeNewTabTombstones', () => {
  it('hard-deletes tombstones older than the cutoff across stores and keeps the rest', async () => {
    const old = '2026-01-01T00:00:00.000Z';
    await newtabDB.put('quickLinks', { id: 'ql-old', deletedAt: old });
    await newtabDB.put('quickLinks', { id: 'ql-live' });
    await newtabDB.put('todoItems', { id: 'todo-old', listId: 'l1', deletedAt: old });
    await newtabDB.put('bookmarkEntries', { id: 'entry-live', categoryId: 'c1' });
    await newtabDB.put('bookmarkEntries', { id: 'entry-recent', categoryId: 'c1' });
    await softDeleteNewTab('bookmarkEntries', 'entry-recent'); // deleted now

    const purged = await purgeNewTabTombstones('2026-02-01T00:00:00.000Z');

    expect(purged).toBe(2);
    expect(await newtabDB.get('quickLinks', 'ql-old')).toBeNull();
    expect(await newtabDB.get('todoItems', 'todo-old')).toBeNull();
    expect(await newtabDB.get('quickLinks', 'ql-live')).not.toBeNull();
    expect(await newtabDB.get('bookmarkEntries', 'entry-recent')).not.toBeNull();
  });
});
