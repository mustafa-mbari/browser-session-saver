import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBAdapter } from '@core/storage/indexeddb';

describe('IndexedDBAdapter', () => {
  let adapter: IndexedDBAdapter;

  beforeEach(() => {
    // Fresh in-memory IndexedDB for each test — no cross-test pollution
    (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
    adapter = new IndexedDBAdapter();
  });

  // ── get / set round-trip ────────────────────────────────────────────────

  it('returns null for a key that has never been set', async () => {
    const result = await adapter.get('missing');
    expect(result).toBeNull();
  });

  it('set and get round-trips a value', async () => {
    const value = { id: '1', name: 'Test Session', tabs: [] };
    await adapter.set('s1', value);
    const result = await adapter.get<typeof value>('s1');
    expect(result).toEqual(value);
  });

  it('overwriting a key replaces the value', async () => {
    await adapter.set('k1', { v: 'first' });
    await adapter.set('k1', { v: 'second' });
    const result = await adapter.get<{ v: string }>('k1');
    expect(result?.v).toBe('second');
  });

  // ── remove ───────────────────────────────────────────────────────────────

  it('remove deletes the key so subsequent get returns null', async () => {
    await adapter.set('toDelete', { x: 1 });
    await adapter.remove('toDelete');
    expect(await adapter.get('toDelete')).toBeNull();
  });

  it('remove on a non-existent key does not throw', async () => {
    await expect(adapter.remove('no-such-key')).resolves.toBeUndefined();
  });

  // ── getAll ───────────────────────────────────────────────────────────────

  it('getAll returns empty object when store is empty', async () => {
    const result = await adapter.getAll();
    expect(result).toEqual({});
  });

  it('getAll returns all set key-value pairs', async () => {
    await adapter.set('a', { n: 1 });
    await adapter.set('b', { n: 2 });
    const result = await adapter.getAll();
    expect(result['a']).toEqual({ n: 1 });
    expect(result['b']).toEqual({ n: 2 });
    expect(Object.keys(result)).toHaveLength(2);
  });

  // ── clear ────────────────────────────────────────────────────────────────

  it('clear empties the store', async () => {
    await adapter.set('x', 1);
    await adapter.set('y', 2);
    await adapter.clear();
    const result = await adapter.getAll();
    expect(Object.keys(result)).toHaveLength(0);
  });

  // ── count ────────────────────────────────────────────────────────────────

  it('count returns 0 on empty store', async () => {
    expect(await adapter.count()).toBe(0);
  });

  it('count reflects number of stored items', async () => {
    await adapter.set('a', 1);
    await adapter.set('b', 2);
    await adapter.set('c', 3);
    expect(await adapter.count()).toBe(3);
  });

  it('count decrements after remove', async () => {
    await adapter.set('a', 1);
    await adapter.set('b', 2);
    await adapter.remove('a');
    expect(await adapter.count()).toBe(1);
  });

  // ── getByIndex — boolean regression ─────────────────────────────────────

  it('getByIndex("isAutoSave", true) returns only auto-save records', async () => {
    await adapter.set('manual', { id: 'm', name: 'Manual', isAutoSave: false });
    await adapter.set('auto1', { id: 'a1', name: 'Auto 1', isAutoSave: true });
    await adapter.set('auto2', { id: 'a2', name: 'Auto 2', isAutoSave: true });

    const result = await adapter.getByIndex<{ id: string; isAutoSave: boolean }>('isAutoSave', true);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.isAutoSave === true)).toBe(true);
  });

  it('getByIndex("isAutoSave", false) returns only non-auto-save records', async () => {
    await adapter.set('manual', { id: 'm', name: 'Manual', isAutoSave: false });
    await adapter.set('auto1', { id: 'a1', name: 'Auto 1', isAutoSave: true });

    const result = await adapter.getByIndex<{ id: string; isAutoSave: boolean }>('isAutoSave', false);
    expect(result).toHaveLength(1);
    expect(result[0].isAutoSave).toBe(false);
  });

  it('getByIndex boolean respects optional limit', async () => {
    await adapter.set('a1', { isAutoSave: true });
    await adapter.set('a2', { isAutoSave: true });
    await adapter.set('a3', { isAutoSave: true });

    const result = await adapter.getByIndex('isAutoSave', true, 2);
    expect(result).toHaveLength(2);
  });

  // ── getByIndex — non-boolean (IDB index path) ────────────────────────────

  it('getByIndex("createdAt", date) returns matching records via IDB index', async () => {
    const date = '2026-01-01T00:00:00.000Z';
    await adapter.set('s1', { createdAt: date, name: 'session 1' });
    await adapter.set('s2', { createdAt: '2026-02-01T00:00:00.000Z', name: 'session 2' });

    const result = await adapter.getByIndex<{ name: string }>('createdAt', date);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('session 1');
  });

  // ── getUsedBytes ─────────────────────────────────────────────────────────

  it('getUsedBytes returns a non-negative number', async () => {
    const bytes = await adapter.getUsedBytes();
    expect(typeof bytes).toBe('number');
    expect(bytes).toBeGreaterThanOrEqual(0);
  });
});
