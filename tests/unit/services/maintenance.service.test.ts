import { describe, it, expect, vi, beforeEach } from 'vitest';

const { purgeSessions, purgePrompts, purgeFolders, purgeSubs, purgeTemplates, purgeNewTab, getAllSessions, markDeleted } = vi.hoisted(() => ({
  getAllSessions: vi.fn(),
  markDeleted: vi.fn().mockResolvedValue(true),
  purgeSessions: vi.fn().mockResolvedValue(1),
  purgePrompts: vi.fn().mockResolvedValue(2),
  purgeFolders: vi.fn().mockResolvedValue(0),
  purgeSubs: vi.fn().mockResolvedValue(1),
  purgeTemplates: vi.fn().mockResolvedValue(0),
  purgeNewTab: vi.fn().mockResolvedValue(3),
}));

vi.mock('@core/storage/storage-factory', () => ({
  getSessionRepository: () => ({ purgeDeleted: purgeSessions, getAll: getAllSessions, markDeleted }),
}));
vi.mock('@core/storage/prompt-storage', () => ({
  getPromptRepository: () => ({ purgeDeleted: purgePrompts }),
  getPromptFolderRepository: () => ({ purgeDeleted: purgeFolders }),
}));
vi.mock('@core/storage/subscription-storage', () => ({
  getSubscriptionRepository: () => ({ purgeDeleted: purgeSubs }),
}));
vi.mock('@core/storage/tab-group-template-storage', () => ({
  TabGroupTemplateStorage: { purgeDeleted: purgeTemplates },
}));
vi.mock('@core/storage/newtab-soft-delete', () => ({
  purgeNewTabTombstones: purgeNewTab,
}));

import { purgeOldTombstones, deleteSessionsOlderThan } from '@core/services/maintenance.service';

describe('purgeOldTombstones', () => {
  beforeEach(() => vi.clearAllMocks());

  it('purges every store with a cutoff 90 days before now and returns the total', async () => {
    const now = Date.parse('2026-06-01T00:00:00.000Z');
    const total = await purgeOldTombstones(now);

    const cutoff = '2026-03-03T00:00:00.000Z';
    for (const purge of [purgeSessions, purgePrompts, purgeFolders, purgeSubs, purgeTemplates, purgeNewTab]) {
      expect(purge).toHaveBeenCalledWith(cutoff);
    }
    expect(total).toBe(7);
  });
});

describe('deleteSessionsOlderThan', () => {
  beforeEach(() => vi.clearAllMocks());

  const now = Date.parse('2026-06-01T00:00:00.000Z');
  const old = '2026-04-01T00:00:00.000Z'; // 61 days before `now`
  const recent = '2026-05-25T00:00:00.000Z';

  function session(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id, createdAt: old, updatedAt: old,
      isPinned: false, isLocked: false, isStarred: false, isAutoSave: false,
      ...overrides,
    };
  }

  it('soft-deletes sessions older than the limit and keeps pinned, locked, starred and recent ones', async () => {
    getAllSessions.mockResolvedValue([
      session('old'),
      session('old-auto-save', { isAutoSave: true }),
      session('pinned', { isPinned: true }),
      session('locked', { isLocked: true }),
      session('starred', { isStarred: true }),
      session('recently-updated', { updatedAt: recent }),
    ]);

    const deleted = await deleteSessionsOlderThan(30, now);

    expect(deleted).toBe(2);
    expect(markDeleted.mock.calls.map(([id]) => id)).toEqual(['old', 'old-auto-save']);
  });
});
