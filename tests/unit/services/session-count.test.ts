import { describe, it, expect, vi } from 'vitest';
import { countSessions } from '@core/services/session.service';

// Mock storage-factory so countSessions never touches real IndexedDB
vi.mock('@core/storage/storage-factory', () => {
  const mockStorage = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue({}),
    clear: vi.fn().mockResolvedValue(undefined),
    getUsedBytes: vi.fn().mockResolvedValue(0),
    count: vi.fn().mockResolvedValue(42),
  };
  return {
    getSessionStorage: vi.fn(() => mockStorage),
    getSettingsStorage: vi.fn(() => ({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('countSessions', () => {
  it('delegates to storage.count() and returns the result', async () => {
    const count = await countSessions();
    expect(count).toBe(42);
  });

  it('calls getSessionStorage once per invocation', async () => {
    const { getSessionStorage } = await import('@core/storage/storage-factory');
    vi.mocked(getSessionStorage).mockClear();

    await countSessions();
    expect(getSessionStorage).toHaveBeenCalledTimes(1);
  });
});
