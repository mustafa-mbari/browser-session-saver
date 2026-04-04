import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveSession,
  getAllSessions,
  getSession,
  updateSession,
  deleteSession,
  checkDuplicate,
  upsertAutoSaveSession,
} from '@core/services/session.service';
import type { Tab, TabGroup } from '@core/types/session.types';

// ---------------------------------------------------------------------------
// Shared in-memory stores — hoisted so vi.mock factory can reference them
// ---------------------------------------------------------------------------
const { store, settingsStore } = vi.hoisted(() => ({
  store: {} as Record<string, unknown>,
  settingsStore: {} as Record<string, unknown>,
}));

vi.mock('@core/storage/storage-factory', () => {
  const mockRepo = {
    getById: vi.fn((id: string) => Promise.resolve(store[id] ?? null)),
    save: vi.fn((entity: { id: string }) => {
      store[entity.id] = entity;
      return Promise.resolve(undefined);
    }),
    delete: vi.fn((id: string) => {
      const existed = id in store;
      delete store[id];
      return Promise.resolve(existed);
    }),
    getAll: vi.fn(() => Promise.resolve(Object.values(store))),
    count: vi.fn(() => Promise.resolve(Object.keys(store).length)),
    update: vi.fn((id: string, updates: Record<string, unknown>) => {
      if (!store[id]) return Promise.resolve(null);
      store[id] = { ...(store[id] as object), ...updates };
      return Promise.resolve(store[id]);
    }),
    getByIndex: vi.fn((indexName: string, value: unknown) => {
      return Promise.resolve(
        Object.values(store).filter(
          (item) => (item as Record<string, unknown>)[indexName] === value,
        ),
      );
    }),
    importMany: vi.fn((entities: { id: string }[]) => {
      for (const e of entities) store[e.id] = e;
      return Promise.resolve(undefined);
    }),
    replaceAll: vi.fn((entities: { id: string }[]) => {
      for (const k of Object.keys(store)) delete store[k];
      for (const e of entities) store[e.id] = e;
      return Promise.resolve(undefined);
    }),
  };
  const mockSettingsStorage = {
    get: vi.fn((key: string) => Promise.resolve(settingsStore[key] ?? null)),
    set: vi.fn((key: string, val: unknown) => {
      settingsStore[key] = val;
      return Promise.resolve(undefined);
    }),
  };
  return {
    getSessionRepository: vi.fn(() => mockRepo),
    getSettingsStorage: vi.fn(() => mockSettingsStorage),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const NO_TABS: Tab[] = [];
const NO_GROUPS: TabGroup[] = [];

function makeTab(url: string): Tab {
  return {
    id: url,
    url,
    title: url,
    favIconUrl: '',
    index: 0,
    pinned: false,
    groupId: -1,
    active: false,
    scrollPosition: { x: 0, y: 0 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('session.service', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    for (const k of Object.keys(settingsStore)) delete settingsStore[k];
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  describe('saveSession', () => {
    it('creates a session with sensible defaults', async () => {
      const session = await saveSession([makeTab('https://a.com')], NO_GROUPS);
      expect(session.id).toBeTruthy();
      expect(session.tabCount).toBe(1);
      expect(session.isAutoSave).toBe(false);
      expect(session.isPinned).toBe(false);
      expect(session.isLocked).toBe(false);
      expect(session.isStarred).toBe(false);
      expect(session.tags).toEqual([]);
      expect(session.notes).toBe('');
    });

    it('uses the provided name', async () => {
      const session = await saveSession(NO_TABS, NO_GROUPS, { name: 'My Session' });
      expect(session.name).toBe('My Session');
    });

    it('generates an auto-save name when isAutoSave=true', async () => {
      const session = await saveSession(NO_TABS, NO_GROUPS, {
        isAutoSave: true,
        autoSaveTrigger: 'timer',
      });
      expect(session.name).toMatch(/\[Auto/);
      expect(session.isAutoSave).toBe(true);
    });

    it('persists the session to the store', async () => {
      const session = await saveSession([makeTab('https://b.com')], NO_GROUPS);
      expect(store[session.id]).toBeDefined();
    });

    it('honours isPinned and isLocked options', async () => {
      const session = await saveSession(NO_TABS, NO_GROUPS, { isPinned: true, isLocked: true });
      expect(session.isPinned).toBe(true);
      expect(session.isLocked).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('getAllSessions', () => {
    it('returns empty array when no sessions exist', async () => {
      expect(await getAllSessions()).toHaveLength(0);
    });

    it('returns sessions sorted by createdAt desc by default', async () => {
      await saveSession(NO_TABS, NO_GROUPS, { name: 'Old' });
      vi.advanceTimersByTime(1000);
      await saveSession(NO_TABS, NO_GROUPS, { name: 'New' });

      const sessions = await getAllSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].name).toBe('New');
      expect(sessions[1].name).toBe('Old');
    });

    it('filters by isAutoSave', async () => {
      await saveSession(NO_TABS, NO_GROUPS, { isAutoSave: false });
      await saveSession(NO_TABS, NO_GROUPS, { isAutoSave: true });

      const autoSaves = await getAllSessions({ isAutoSave: true });
      expect(autoSaves).toHaveLength(1);
      expect(autoSaves[0].isAutoSave).toBe(true);
    });

    it('filters by isPinned', async () => {
      await saveSession(NO_TABS, NO_GROUPS, { isPinned: false });
      await saveSession(NO_TABS, NO_GROUPS, { isPinned: true });

      const pinned = await getAllSessions({ isPinned: true });
      expect(pinned).toHaveLength(1);
      expect(pinned[0].isPinned).toBe(true);
    });

    it('filters by tags', async () => {
      const s1 = await saveSession(NO_TABS, NO_GROUPS);
      await updateSession(s1.id, { tags: ['work'] });
      await saveSession(NO_TABS, NO_GROUPS); // no tags

      const result = await getAllSessions({ tags: ['work'] });
      expect(result).toHaveLength(1);
    });

    it('respects the limit parameter', async () => {
      await saveSession(NO_TABS, NO_GROUPS);
      await saveSession(NO_TABS, NO_GROUPS);
      await saveSession(NO_TABS, NO_GROUPS);

      const sessions = await getAllSessions(undefined, undefined, 2);
      expect(sessions).toHaveLength(2);
    });

    it('sorts by name asc', async () => {
      await saveSession(NO_TABS, NO_GROUPS, { name: 'Charlie' });
      await saveSession(NO_TABS, NO_GROUPS, { name: 'Alice' });
      await saveSession(NO_TABS, NO_GROUPS, { name: 'Bob' });

      const sessions = await getAllSessions(undefined, { field: 'name', direction: 'asc' });
      expect(sessions.map((s) => s.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('sorts by tabCount desc', async () => {
      await saveSession([makeTab('https://a.com')], NO_GROUPS, { name: 'One' });
      await saveSession(
        [makeTab('https://a.com'), makeTab('https://b.com'), makeTab('https://c.com')],
        NO_GROUPS,
        { name: 'Three' },
      );
      await saveSession([makeTab('https://a.com'), makeTab('https://b.com')], NO_GROUPS, {
        name: 'Two',
      });

      const sessions = await getAllSessions(undefined, { field: 'tabCount', direction: 'desc' });
      expect(sessions[0].name).toBe('Three');
      expect(sessions[2].name).toBe('One');
    });

    it('filters by dateFrom / dateTo', async () => {
      await saveSession(NO_TABS, NO_GROUPS, { name: 'Jan 1' });
      vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));
      await saveSession(NO_TABS, NO_GROUPS, { name: 'Jun 1' });

      const result = await getAllSessions({ dateFrom: '2026-04-01T00:00:00.000Z' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Jun 1');
    });
  });

  // -------------------------------------------------------------------------
  describe('getSession', () => {
    it('returns null for an unknown id', async () => {
      expect(await getSession('unknown')).toBeNull();
    });

    it('returns the session when found', async () => {
      const saved = await saveSession(NO_TABS, NO_GROUPS, { name: 'Found It' });
      const result = await getSession(saved.id);
      expect(result?.name).toBe('Found It');
    });
  });

  // -------------------------------------------------------------------------
  describe('updateSession', () => {
    it('returns null for an unknown id', async () => {
      expect(await updateSession('unknown', { name: 'X' })).toBeNull();
    });

    it('updates specified fields and refreshes updatedAt', async () => {
      const original = await saveSession(NO_TABS, NO_GROUPS, { name: 'Before' });
      vi.advanceTimersByTime(500);
      const updated = await updateSession(original.id, { name: 'After', tags: ['tag1'] });

      expect(updated?.name).toBe('After');
      expect(updated?.tags).toEqual(['tag1']);
      expect(updated?.id).toBe(original.id);
      expect(updated?.updatedAt).not.toBe(original.updatedAt);
    });

    it('does not change unrelated fields', async () => {
      const original = await saveSession([makeTab('https://a.com')], NO_GROUPS, {
        isPinned: true,
      });
      const updated = await updateSession(original.id, { name: 'Renamed' });

      expect(updated?.isPinned).toBe(true);
      expect(updated?.tabCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('deleteSession', () => {
    it('returns false for an unknown id', async () => {
      expect(await deleteSession('unknown')).toBe(false);
    });

    it('returns false and does not remove locked sessions', async () => {
      const session = await saveSession(NO_TABS, NO_GROUPS, { isLocked: true });
      expect(await deleteSession(session.id)).toBe(false);
      expect(store[session.id]).toBeDefined();
    });

    it('removes an unlocked session and returns true', async () => {
      const session = await saveSession(NO_TABS, NO_GROUPS);
      expect(await deleteSession(session.id)).toBe(true);
      expect(store[session.id]).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  describe('checkDuplicate', () => {
    it('returns false when no sessions exist', async () => {
      expect(await checkDuplicate(['https://a.com'])).toBe(false);
    });

    it('returns false when tab counts differ', async () => {
      await saveSession(
        [makeTab('https://a.com'), makeTab('https://b.com')],
        NO_GROUPS,
      );
      expect(await checkDuplicate(['https://a.com'])).toBe(false);
    });

    it('returns true when URLs match the latest session (order-independent)', async () => {
      await saveSession(
        [makeTab('https://a.com'), makeTab('https://b.com')],
        NO_GROUPS,
      );
      expect(await checkDuplicate(['https://b.com', 'https://a.com'])).toBe(true);
    });

    it('returns false when URLs differ', async () => {
      await saveSession([makeTab('https://a.com')], NO_GROUPS);
      expect(await checkDuplicate(['https://c.com'])).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('upsertAutoSaveSession', () => {
    it('creates a pinned, locked auto-save when none exists', async () => {
      const session = await upsertAutoSaveSession(
        [makeTab('https://a.com')],
        NO_GROUPS,
        { autoSaveTrigger: 'timer' },
        false,
      );
      expect(session.isAutoSave).toBe(true);
      expect(session.isPinned).toBe(true);
      expect(session.isLocked).toBe(true);
    });

    it('replaces tabs in existing auto-save (replace mode)', async () => {
      await upsertAutoSaveSession([makeTab('https://a.com')], NO_GROUPS, {}, false);
      vi.advanceTimersByTime(1000);
      const updated = await upsertAutoSaveSession(
        [makeTab('https://b.com')],
        NO_GROUPS,
        {},
        false,
      );

      expect(updated.tabs).toHaveLength(1);
      expect(updated.tabs[0].url).toBe('https://b.com');
    });

    it('merges new URLs into existing auto-save (merge mode)', async () => {
      await upsertAutoSaveSession([makeTab('https://a.com')], NO_GROUPS, {}, false);
      const merged = await upsertAutoSaveSession(
        [makeTab('https://a.com'), makeTab('https://b.com')],
        NO_GROUPS,
        {},
        true,
      );
      expect(merged.tabs).toHaveLength(2);
    });

    it('skips the write when nothing new in merge mode', async () => {
      const first = await upsertAutoSaveSession([makeTab('https://a.com')], NO_GROUPS, {}, false);
      const second = await upsertAutoSaveSession([makeTab('https://a.com')], NO_GROUPS, {}, true);

      // Nothing changed — existing object returned unchanged
      expect(second.id).toBe(first.id);
      expect(second.updatedAt).toBe(first.updatedAt);
    });
  });
});
