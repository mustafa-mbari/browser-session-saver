import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerEventListeners } from '@background/event-listeners';
import type { Session } from '@core/types/session.types';
import type { Settings } from '@core/types/settings.types';
import { importFromJSON } from '@core/services/import.service';
import { ActionLimitError } from '@core/services/limits/limit-guard';

// ---------------------------------------------------------------------------
// Mock: session service
// ---------------------------------------------------------------------------
const mockGetAllSessions = vi.fn();
const mockGetSession = vi.fn();
const mockSaveSession = vi.fn();
const mockDeleteSession = vi.fn();
const mockUpdateSession = vi.fn();
const mockCheckDuplicate = vi.fn();

vi.mock('@core/services/session.service', () => ({
  getAllSessions: (...args: unknown[]) => mockGetAllSessions(...args),
  getSession: (...args: unknown[]) => mockGetSession(...args),
  saveSession: (...args: unknown[]) => mockSaveSession(...args),
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
  checkDuplicate: (...args: unknown[]) => mockCheckDuplicate(...args),
}));

// ---------------------------------------------------------------------------
// Mock: storage-factory (settings + session storage)
// ---------------------------------------------------------------------------
const { settingsStore } = vi.hoisted(() => ({
  settingsStore: {} as Record<string, unknown>,
}));

vi.mock('@core/storage/storage-factory', () => {
  const mockSettingsStorage = {
    get: vi.fn((key: string) => Promise.resolve(settingsStore[key] ?? null)),
    set: vi.fn((key: string, val: unknown) => {
      settingsStore[key] = val;
      return Promise.resolve(undefined);
    }),
  };
  const mockSessionRepo = {
    getById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(false),
    getAll: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    getByIndex: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(null),
    importMany: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue(undefined),
  };
  return {
    getSettingsStorage: vi.fn(() => mockSettingsStorage),
    getSessionRepository: vi.fn(() => mockSessionRepo),
  };
});

// ---------------------------------------------------------------------------
// Mock: tab-group, export, import services
// ---------------------------------------------------------------------------
vi.mock('@core/services/tab-group.service', () => ({
  captureTabGroups: vi.fn().mockReturnValue({ tabs: [], tabGroups: [] }),
  restoreTabGroups: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@core/services/export.service', () => ({
  exportAsJSON: vi.fn().mockReturnValue('[]'),
  exportAsHTML: vi.fn().mockReturnValue('<html>'),
  exportAsMarkdown: vi.fn().mockReturnValue('# S'),
  exportAsCSV: vi.fn().mockReturnValue('id,name'),
  exportAsText: vi.fn().mockReturnValue(''),
}));

vi.mock('@core/services/import.service', () => ({
  importFromJSON: vi.fn().mockReturnValue({ sessions: [], errors: [] }),
  importFromHTML: vi.fn().mockReturnValue({ sessions: [], errors: [] }),
  importFromURLList: vi.fn().mockReturnValue({ sessions: [], errors: [] }),
}));

// ---------------------------------------------------------------------------
// Mock: limit-guard (prevent real chrome.storage calls from action-tracker)
// ---------------------------------------------------------------------------
const { mockGuardAction } = vi.hoisted(() => ({ mockGuardAction: vi.fn() }));

vi.mock('@core/services/limits/limit-guard', () => {
  class ActionLimitError extends Error {
    status: unknown;
    constructor(status: unknown) {
      super('Action limit reached');
      this.name = 'ActionLimitError';
      this.status = status;
    }
  }
  return {
    guardAction: mockGuardAction,
    trackAction: vi.fn().mockResolvedValue(undefined),
    ActionLimitError,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTab(url: string, id = url) {
  return {
    id,
    url,
    title: url,
    favIconUrl: '',
    index: 0,
    pinned: false as const,
    groupId: -1 as const,
    active: false as const,
    scrollPosition: { x: 0, y: 0 },
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    name: 'Test Session',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    tabs: [],
    tabGroups: [],
    windowId: 1,
    tags: [],
    isPinned: false,
    isStarred: false,
    isLocked: false,
    isAutoSave: false,
    autoSaveTrigger: 'manual',
    notes: '',
    tabCount: 0,
    version: '1.0.0',
    ...overrides,
  };
}

/** Dispatch a message through the registered onMessage listener. */
function dispatch(message: object): Promise<Record<string, unknown>> {
  const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls.at(-1)![0];
  return new Promise((resolve) => listener(message, {}, resolve));
}

// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(settingsStore)) delete settingsStore[k];

  // Default: guardAction allows (no throw). Individual tests can override with mockRejectedValueOnce.
  mockGuardAction.mockResolvedValue(undefined);

  // Register fresh listener each test (chrome.runtime.onMessage is cleared above)
  registerEventListeners();
});

// ---------------------------------------------------------------------------
describe('handleMessage', () => {
  // ── GET_SESSIONS ──────────────────────────────────────────────────────────
  describe('GET_SESSIONS', () => {
    it('returns sessions array and totalCount', async () => {
      const sessions = [makeSession({ id: 's1' }), makeSession({ id: 's2' })];
      mockGetAllSessions.mockResolvedValue(sessions);

      const res = await dispatch({ action: 'GET_SESSIONS', payload: {} });
      expect(res.success).toBe(true);
      const data = res.data as { sessions: unknown[]; totalCount: number };
      expect(data.totalCount).toBe(2);
      expect(data.sessions).toHaveLength(2);
    });

    it('applies pagination: limit and offset slice the result', async () => {
      const sessions = Array.from({ length: 10 }, (_, i) => makeSession({ id: `s${i}` }));
      mockGetAllSessions.mockResolvedValue(sessions);

      const res = await dispatch({ action: 'GET_SESSIONS', payload: { limit: 3, offset: 2 } });
      const data = res.data as { sessions: unknown[]; totalCount: number };
      expect(data.totalCount).toBe(10);
      expect(data.sessions).toHaveLength(3);
    });
  });

  // ── DELETE_SESSION ────────────────────────────────────────────────────────
  describe('DELETE_SESSION', () => {
    it('returns success: true when the session is deleted', async () => {
      mockDeleteSession.mockResolvedValue(true);
      const res = await dispatch({ action: 'DELETE_SESSION', payload: { sessionId: 'abc' } });
      expect(res.success).toBe(true);
    });

    it('returns success: false when the session is locked or not found', async () => {
      mockDeleteSession.mockResolvedValue(false);
      const res = await dispatch({ action: 'DELETE_SESSION', payload: { sessionId: 'abc' } });
      expect(res.success).toBe(false);
      expect(typeof res.error).toBe('string');
    });
  });

  // ── UPDATE_SESSION ────────────────────────────────────────────────────────
  describe('UPDATE_SESSION', () => {
    it('returns the updated session on success', async () => {
      const updated = makeSession({ name: 'Renamed' });
      mockUpdateSession.mockResolvedValue(updated);

      const res = await dispatch({
        action: 'UPDATE_SESSION',
        payload: { sessionId: 's1', updates: { name: 'Renamed' } },
      });
      expect(res.success).toBe(true);
      expect((res.data as Session).name).toBe('Renamed');
    });

    it('returns success: false when the session is not found', async () => {
      mockUpdateSession.mockResolvedValue(null);
      const res = await dispatch({
        action: 'UPDATE_SESSION',
        payload: { sessionId: 'ghost', updates: { name: 'X' } },
      });
      expect(res.success).toBe(false);
    });
  });

  // ── GET_SETTINGS ──────────────────────────────────────────────────────────
  describe('GET_SETTINGS', () => {
    it('returns default settings when nothing is stored', async () => {
      const res = await dispatch({ action: 'GET_SETTINGS', payload: {} });
      expect(res.success).toBe(true);
      const data = res.data as Settings;
      expect(typeof data.enableAutoSave).toBe('boolean');
      expect(typeof data.saveInterval).toBe('number');
    });
  });

  // ── UPDATE_SETTINGS ───────────────────────────────────────────────────────
  describe('UPDATE_SETTINGS', () => {
    it('merges partial updates and returns the full updated settings', async () => {
      const res = await dispatch({
        action: 'UPDATE_SETTINGS',
        payload: { enableAutoSave: false, saveInterval: 30 },
      });
      expect(res.success).toBe(true);
      const data = res.data as Settings;
      expect(data.enableAutoSave).toBe(false);
      expect(data.saveInterval).toBe(30);
    });
  });

  // ── AUTO_SAVE_STATUS ──────────────────────────────────────────────────────
  describe('AUTO_SAVE_STATUS', () => {
    it('returns isActive flag and lastAutoSave', async () => {
      const res = await dispatch({ action: 'AUTO_SAVE_STATUS', payload: {} });
      expect(res.success).toBe(true);
      const data = res.data as { isActive: boolean; lastAutoSave: string | null };
      expect(typeof data.isActive).toBe('boolean');
      expect('lastAutoSave' in data).toBe(true);
    });
  });

  // ── MERGE_SESSIONS ────────────────────────────────────────────────────────
  describe('MERGE_SESSIONS', () => {
    it('calls saveSession with deduplicated tabs from all source sessions', async () => {
      const tabA = makeTab('https://a.com', 't1');
      const tabB = makeTab('https://b.com', 't2');
      const s1 = makeSession({ id: 'A', tabs: [tabA, tabB] });
      const s2 = makeSession({ id: 'B', tabs: [tabB] }); // tabB is shared

      mockGetSession.mockImplementation((id: string) =>
        Promise.resolve(id === 'A' ? s1 : id === 'B' ? s2 : null),
      );
      mockSaveSession.mockResolvedValue(makeSession({ id: 'merged' }));

      const res = await dispatch({
        action: 'MERGE_SESSIONS',
        payload: { sessionIds: ['A', 'B'], targetName: 'Merged' },
      });

      expect(res.success).toBe(true);
      // tabB should only appear once in the merged result
      const calledTabs = mockSaveSession.mock.calls[0][0] as unknown[];
      expect(calledTabs).toHaveLength(2); // tabA + tabB (deduplicated)
    });

    it('returns failure when fewer than 2 source sessions are found', async () => {
      mockGetSession.mockResolvedValue(null);
      const res = await dispatch({
        action: 'MERGE_SESSIONS',
        payload: { sessionIds: ['A', 'B'], targetName: 'X' },
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/at least 2/i);
    });

    it('returns success: false when guardAction throws ActionLimitError', async () => {
      const s1 = makeSession({ id: 'A' });
      const s2 = makeSession({ id: 'B' });
      mockGetSession.mockImplementation((id: string) =>
        Promise.resolve(id === 'A' ? s1 : id === 'B' ? s2 : null),
      );
      mockGuardAction.mockRejectedValueOnce(new ActionLimitError({ tier: 'guest', dailyBlocked: true }));

      const res = await dispatch({
        action: 'MERGE_SESSIONS',
        payload: { sessionIds: ['A', 'B'], targetName: 'Merged' },
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Action limit reached');
    });
  });

  // ── DIFF_SESSIONS ─────────────────────────────────────────────────────────
  describe('DIFF_SESSIONS', () => {
    it('correctly computes added, removed, and unchanged tabs', async () => {
      const tabA = makeTab('https://a.com', 't1');
      const tabB = makeTab('https://b.com', 't2');
      const tabC = makeTab('https://c.com', 't3');

      // Session A has [tabA, tabB]; Session B has [tabB, tabC]
      mockGetSession.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'sA'
            ? makeSession({ tabs: [tabA, tabB] })
            : id === 'sB'
              ? makeSession({ tabs: [tabB, tabC] })
              : null,
        ),
      );

      const res = await dispatch({
        action: 'DIFF_SESSIONS',
        payload: { sessionIdA: 'sA', sessionIdB: 'sB' },
      });

      expect(res.success).toBe(true);
      const data = res.data as { added: unknown[]; removed: unknown[]; unchanged: unknown[] };
      expect(data.added).toHaveLength(1);    // tabC is new in B
      expect(data.removed).toHaveLength(1);  // tabA is gone in B
      expect(data.unchanged).toHaveLength(1); // tabB is in both
    });

    it('returns failure when either session is not found', async () => {
      mockGetSession.mockResolvedValue(null);
      const res = await dispatch({
        action: 'DIFF_SESSIONS',
        payload: { sessionIdA: 'x', sessionIdB: 'y' },
      });
      expect(res.success).toBe(false);
    });
  });

  // ── UNDELETE_SESSION ──────────────────────────────────────────────────────
  describe('UNDELETE_SESSION', () => {
    it('re-inserts the session and returns it', async () => {
      const session = makeSession({ id: 'restored' });
      const res = await dispatch({ action: 'UNDELETE_SESSION', payload: { session } });
      expect(res.success).toBe(true);
      expect((res.data as Session).id).toBe('restored');
    });

    it('returns success: false when guardAction throws ActionLimitError', async () => {
      const session = makeSession({ id: 'restored' });
      mockGuardAction.mockRejectedValueOnce(new ActionLimitError({ tier: 'guest', dailyBlocked: true }));

      const res = await dispatch({ action: 'UNDELETE_SESSION', payload: { session } });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Action limit reached');
    });
  });

  // ── IMPORT_SESSIONS ───────────────────────────────────────────────────────
  describe('IMPORT_SESSIONS', () => {
    it('returns success: false when guardAction throws ActionLimitError', async () => {
      // Return a valid session so the handler reaches guardAction (empty result exits early)
      vi.mocked(importFromJSON).mockReturnValueOnce({ sessions: [makeSession()], errors: [] });
      mockGuardAction.mockRejectedValueOnce(new ActionLimitError({ tier: 'guest', dailyBlocked: true }));

      const res = await dispatch({
        action: 'IMPORT_SESSIONS',
        payload: { data: '[]', source: 'json' },
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Action limit reached');
    });
  });

  // ── EXPORT_SESSIONS ───────────────────────────────────────────────────────
  describe('EXPORT_SESSIONS', () => {
    it('returns json export string for format=json', async () => {
      mockGetSession.mockResolvedValue(makeSession());
      const res = await dispatch({
        action: 'EXPORT_SESSIONS',
        payload: { sessionIds: ['s1'], format: 'json' },
      });
      expect(res.success).toBe(true);
      expect(typeof res.data).toBe('string');
    });
  });

  // ── UPDATE_SESSION_TABS ───────────────────────────────────────────────────
  describe('UPDATE_SESSION_TABS', () => {
    it('calls guardAction when the session exists', async () => {
      const session = makeSession({ id: 's1' });
      mockGetSession.mockResolvedValueOnce(session);
      // chrome.windows.getCurrent, chrome.tabs.query, chrome.tabGroups.query
      // all default to returning valid empty results (see setup.ts global mocks).

      await dispatch({ action: 'UPDATE_SESSION_TABS', payload: { sessionId: 's1' } });

      // handleUpdateSessionTabs currently has NO guardAction call → this FAILS before fix.
      expect(mockGuardAction).toHaveBeenCalledTimes(1);
    });

    it('returns success: false when guardAction throws ActionLimitError', async () => {
      const session = makeSession({ id: 's1' });
      mockGetSession.mockResolvedValueOnce(session);
      mockGuardAction.mockRejectedValueOnce(
        new ActionLimitError({ tier: 'guest', dailyBlocked: true }),
      );

      const res = await dispatch({
        action: 'UPDATE_SESSION_TABS',
        payload: { sessionId: 's1' },
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Action limit reached');
    });
  });

  // ── Unknown action ────────────────────────────────────────────────────────
  describe('unknown action', () => {
    it('returns success: false with an error for an unrecognised action', async () => {
      const res = await dispatch({ action: 'COMPLETELY_UNKNOWN_XYZ', payload: {} });
      expect(res.success).toBe(false);
      expect(typeof res.error).toBe('string');
    });
  });
});
