import { describe, it, expect, beforeEach } from 'vitest';
import { ChromeLocalArrayRepository } from '@core/storage/chrome-local-array-repository';

interface TestEntity {
  id: string;
  createdAt: string;
  name: string;
}

describe('ChromeLocalArrayRepository', () => {
  const KEY = 'test_entities';
  let repo: ChromeLocalArrayRepository<TestEntity>;
  let stored: TestEntity[];

  beforeEach(() => {
    vi.clearAllMocks();
    stored = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.storage.local.get as any).mockImplementation((_key: string, cb: (r: Record<string, unknown>) => void) => {
      cb({ [KEY]: [...stored] });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.storage.local.set as any).mockImplementation((items: Record<string, unknown>, cb: () => void) => {
      stored = items[KEY] as TestEntity[];
      cb();
    });

    repo = new ChromeLocalArrayRepository<TestEntity>(KEY);
  });

  const entity = (id: string, name: string): TestEntity => ({
    id,
    createdAt: '2024-01-01T00:00:00Z',
    name,
  });

  // ── getAll ──────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns empty array when no data', async () => {
      expect(await repo.getAll()).toEqual([]);
    });

    it('returns stored entities', async () => {
      stored = [entity('1', 'Alice'), entity('2', 'Bob')];
      const result = await repo.getAll();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
    });
  });

  // ── getById ─────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns null when entity not found', async () => {
      expect(await repo.getById('nonexistent')).toBeNull();
    });

    it('returns the entity when found', async () => {
      stored = [entity('1', 'Alice')];
      const result = await repo.getById('1');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Alice');
    });
  });

  // ── save ────────────────────────────────────────────────────────────────

  describe('save', () => {
    it('inserts a new entity', async () => {
      await repo.save(entity('1', 'Alice'));
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Alice');
    });

    it('updates an existing entity by id', async () => {
      stored = [entity('1', 'Alice')];
      await repo.save(entity('1', 'Updated'));
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Updated');
    });
  });

  // ── update ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('returns null when entity not found', async () => {
      const result = await repo.update('nonexistent', { name: 'New' });
      expect(result).toBeNull();
    });

    it('merges updates into existing entity', async () => {
      stored = [entity('1', 'Alice')];
      const result = await repo.update('1', { name: 'Updated' });
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Updated');
      expect(stored[0].name).toBe('Updated');
    });
  });

  // ── delete ──────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('returns false when entity not found', async () => {
      expect(await repo.delete('nonexistent')).toBe(false);
    });

    it('removes entity and returns true', async () => {
      stored = [entity('1', 'Alice'), entity('2', 'Bob')];
      const result = await repo.delete('1');
      expect(result).toBe(true);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('2');
    });
  });

  // ── count ───────────────────────────────────────────────────────────────

  describe('count', () => {
    it('returns 0 for empty store', async () => {
      expect(await repo.count()).toBe(0);
    });

    it('returns correct count', async () => {
      stored = [entity('1', 'A'), entity('2', 'B'), entity('3', 'C')];
      expect(await repo.count()).toBe(3);
    });
  });

  // ── importMany ──────────────────────────────────────────────────────────

  describe('importMany', () => {
    it('merges by id — overwrites existing, adds new', async () => {
      stored = [entity('1', 'Alice')];
      await repo.importMany([entity('1', 'Updated'), entity('2', 'Bob')]);
      expect(stored).toHaveLength(2);
      expect(stored.find((e) => e.id === '1')!.name).toBe('Updated');
      expect(stored.find((e) => e.id === '2')!.name).toBe('Bob');
    });
  });

  // ── replaceAll ──────────────────────────────────────────────────────────

  describe('replaceAll', () => {
    it('replaces entire dataset', async () => {
      stored = [entity('1', 'Alice'), entity('2', 'Bob')];
      await repo.replaceAll([entity('3', 'Charlie')]);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('3');
    });
  });
});
