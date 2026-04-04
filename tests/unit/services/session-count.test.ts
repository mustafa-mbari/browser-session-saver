import { describe, it, expect, vi } from 'vitest';
import { countSessions } from '@core/services/session.service';

// Mock storage-factory so countSessions never touches real IndexedDB
vi.mock('@core/storage/storage-factory', () => {
  const mockRepo = {
    getById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(false),
    getAll: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(42),
    getByIndex: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(null),
    importMany: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue(undefined),
  };
  return {
    getSessionRepository: vi.fn(() => mockRepo),
    getSettingsStorage: vi.fn(() => ({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('countSessions', () => {
  it('delegates to repo.count() and returns the result', async () => {
    const count = await countSessions();
    expect(count).toBe(42);
  });

  it('calls getSessionRepository once per invocation', async () => {
    const { getSessionRepository } = await import('@core/storage/storage-factory');
    vi.mocked(getSessionRepository).mockClear();

    await countSessions();
    expect(getSessionRepository).toHaveBeenCalledTimes(1);
  });
});
