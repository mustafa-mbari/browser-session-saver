import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBRepository } from '@core/storage/indexeddb-repository';

interface Row {
  id: string;
  createdAt: string;
  updatedAt: string;
  isAutoSave: boolean;
  deletedAt?: string | null;
}

function makeRepo(onChange?: () => void) {
  return new IndexedDBRepository<Row>({
    onChange,
    dbName: 'test-db',
    dbVersion: 1,
    storeName: 'rows',
    outOfLineKeys: true,
    onUpgrade: (db) => {
      const store = db.createObjectStore('rows');
      store.createIndex('isAutoSave', 'isAutoSave', { unique: false });
      store.createIndex('createdAt', 'createdAt', { unique: false });
    },
  });
}

function row(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isAutoSave: false,
    ...overrides,
  };
}

let repo: ReturnType<typeof makeRepo>;

beforeEach(async () => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  repo = makeRepo();
  await repo.importMany([
    row('live-auto', { isAutoSave: true }),
    row('dead-auto', { isAutoSave: true, deletedAt: '2026-02-01T00:00:00.000Z' }),
    row('live-manual'),
    row('dead-manual', { deletedAt: '2026-02-01T00:00:00.000Z' }),
  ]);
});

describe('IndexedDBRepository tombstones', () => {
  it('getByIndex with a boolean value skips soft-deleted rows', async () => {
    const result = await repo.getByIndex('isAutoSave', true);
    expect(result.map((r) => r.id)).toEqual(['live-auto']);
  });

  it('getByIndex with an index key skips soft-deleted rows', async () => {
    const result = await repo.getByIndex('createdAt', '2026-01-01T00:00:00.000Z');
    expect(result.map((r) => r.id).sort()).toEqual(['live-auto', 'live-manual']);
  });

  it('count excludes soft-deleted rows', async () => {
    expect(await repo.count()).toBe(2);
  });

  it('purgeDeleted removes only tombstones older than the cutoff', async () => {
    await repo.markDeleted('live-manual'); // deleted now — newer than the cutoff
    const purged = await repo.purgeDeleted('2026-03-01T00:00:00.000Z');
    expect(purged).toBe(2);

    const remaining = await repo.getAllWithOptions({ includeDeleted: true });
    expect(remaining.map((r) => r.id).sort()).toEqual(['live-auto', 'live-manual']);
  });
});

describe('IndexedDBRepository onChange', () => {
  it('reports every kind of write', async () => {
    const onChange = vi.fn();
    const watched = makeRepo(onChange);

    await watched.save(row('a'));
    await watched.update('a', { isAutoSave: true });
    await watched.markDeleted('a');
    await watched.importMany([row('b')]);
    await watched.delete('b');
    expect(onChange).toHaveBeenCalledTimes(5);
  });

  it('does not report reads', async () => {
    const onChange = vi.fn();
    const watched = makeRepo(onChange);

    await watched.getAll();
    await watched.getById('live-auto');
    await watched.count();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('IndexedDBRepository updatedAt stamping', () => {
  it('save() and update() stamp updatedAt; importMany() keeps the given value', async () => {
    await repo.save(row('stamped'));
    const saved = await repo.getById('stamped');
    expect(saved!.updatedAt > '2026-01-01T00:00:00.000Z').toBe(true);

    await repo.importMany([row('imported')]);
    expect((await repo.getById('imported'))!.updatedAt).toBe('2026-01-01T00:00:00.000Z');

    const before = saved!.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await repo.update('stamped', { isAutoSave: true });
    expect(updated!.updatedAt > before).toBe(true);
  });
});
