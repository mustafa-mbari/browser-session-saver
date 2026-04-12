import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordDeletion,
  recordDeletions,
  getDeletions,
  clearDeletions,
  clearAllDeletions,
} from '@core/storage/deletion-log';

// ── In-memory chrome.storage.local mock ─────────────────────────────────────
// deletion-log.ts uses the Promise-based API (no callback argument).

let store: Record<string, unknown> = {};

beforeEach(() => {
  store = {};
  vi.clearAllMocks();
  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string) => Promise.resolve({ [key]: store[key] }),
  );
  (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
    (items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve();
    },
  );
});

// ── recordDeletion ────────────────────────────────────────────────────────────

describe('recordDeletion', () => {
  it('appends one id to the entity queue', async () => {
    await recordDeletion('sessions', 'id-1');
    expect(await getDeletions('sessions')).toEqual(['id-1']);
  });

  it('deduplicates: same id recorded twice is stored once', async () => {
    await recordDeletion('sessions', 'id-1');
    await recordDeletion('sessions', 'id-1');
    expect(await getDeletions('sessions')).toEqual(['id-1']);
  });

  it('ignores an empty id string', async () => {
    await recordDeletion('sessions', '');
    expect(await getDeletions('sessions')).toEqual([]);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('accumulates multiple distinct ids', async () => {
    await recordDeletion('sessions', 'a');
    await recordDeletion('sessions', 'b');
    expect(await getDeletions('sessions')).toEqual(expect.arrayContaining(['a', 'b']));
    expect(await getDeletions('sessions')).toHaveLength(2);
  });
});

// ── recordDeletions ───────────────────────────────────────────────────────────

describe('recordDeletions', () => {
  it('bulk-appends multiple ids in one write', async () => {
    await recordDeletions('prompts', ['p-1', 'p-2', 'p-3']);
    const result = await getDeletions('prompts');
    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining(['p-1', 'p-2', 'p-3']));
  });

  it('deduplicates new ids against the existing queue', async () => {
    await recordDeletion('prompts', 'p-1');
    await recordDeletions('prompts', ['p-1', 'p-2']);
    expect(await getDeletions('prompts')).toHaveLength(2);
  });

  it('no-ops without writing to storage when ids array is empty', async () => {
    await recordDeletions('sessions', []);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});

// ── getDeletions ──────────────────────────────────────────────────────────────

describe('getDeletions', () => {
  it('returns [] for an entity with no log', async () => {
    expect(await getDeletions('sessions')).toEqual([]);
  });

  it('returns the ids recorded via recordDeletion', async () => {
    await recordDeletion('todo_items', 'item-42');
    expect(await getDeletions('todo_items')).toEqual(['item-42']);
  });
});

// ── clearDeletions ────────────────────────────────────────────────────────────

describe('clearDeletions', () => {
  it('removes only the specified ids, leaving others intact', async () => {
    await recordDeletions('sessions', ['a', 'b', 'c']);
    await clearDeletions('sessions', ['b']);
    const remaining = await getDeletions('sessions');
    expect(remaining).toContain('a');
    expect(remaining).toContain('c');
    expect(remaining).not.toContain('b');
  });

  it('removes the entity key entirely when all ids are cleared', async () => {
    await recordDeletion('sessions', 'solo');
    await clearDeletions('sessions', ['solo']);
    expect(await getDeletions('sessions')).toEqual([]);
  });

  it('no-ops without touching storage when ids array is empty', async () => {
    await recordDeletion('sessions', 'x');
    const callsBefore = (chrome.storage.local.set as ReturnType<typeof vi.fn>).mock.calls.length;
    await clearDeletions('sessions', []);
    const callsAfter = (chrome.storage.local.set as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
    // Original id is still present
    expect(await getDeletions('sessions')).toEqual(['x']);
  });

  it('no-ops gracefully when entity key is absent', async () => {
    await expect(clearDeletions('sessions', ['nonexistent'])).resolves.toBeUndefined();
    expect(await getDeletions('sessions')).toEqual([]);
  });
});

// ── clearAllDeletions ─────────────────────────────────────────────────────────

describe('clearAllDeletions', () => {
  it('wipes every entity queue from storage', async () => {
    await recordDeletion('sessions', 's-1');
    await recordDeletion('prompts', 'p-1');
    await recordDeletion('todo_items', 't-1');
    await clearAllDeletions();
    expect(await getDeletions('sessions')).toEqual([]);
    expect(await getDeletions('prompts')).toEqual([]);
    expect(await getDeletions('todo_items')).toEqual([]);
  });
});

// ── Cross-entity isolation ────────────────────────────────────────────────────

describe('cross-entity isolation', () => {
  it('recording in one entity does not affect another', async () => {
    await recordDeletion('sessions', 's-1');
    expect(await getDeletions('prompts')).toEqual([]);
  });

  it('clearing one entity does not affect another', async () => {
    await recordDeletion('sessions', 's-1');
    await recordDeletion('prompts', 'p-1');
    await clearDeletions('sessions', ['s-1']);
    expect(await getDeletions('prompts')).toEqual(['p-1']);
  });
});
