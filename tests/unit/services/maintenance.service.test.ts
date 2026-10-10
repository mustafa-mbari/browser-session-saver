import { describe, it, expect, vi, beforeEach } from 'vitest';

const { purgeSessions, purgePrompts, purgeFolders, purgeSubs, purgeTemplates, purgeNewTab } = vi.hoisted(() => ({
  purgeSessions: vi.fn().mockResolvedValue(1),
  purgePrompts: vi.fn().mockResolvedValue(2),
  purgeFolders: vi.fn().mockResolvedValue(0),
  purgeSubs: vi.fn().mockResolvedValue(1),
  purgeTemplates: vi.fn().mockResolvedValue(0),
  purgeNewTab: vi.fn().mockResolvedValue(3),
}));

vi.mock('@core/storage/storage-factory', () => ({
  getSessionRepository: () => ({ purgeDeleted: purgeSessions }),
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

import { purgeOldTombstones } from '@core/services/maintenance.service';

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
