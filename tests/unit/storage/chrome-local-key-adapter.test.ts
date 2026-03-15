import { describe, it, expect, beforeEach } from 'vitest';
import { ChromeLocalKeyAdapter } from '@core/storage/chrome-local-key-adapter';

type Item = { id: string; value: string };

describe('ChromeLocalKeyAdapter', () => {
  const KEY = 'test_items';
  let adapter: ChromeLocalKeyAdapter<Item>;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ChromeLocalKeyAdapter<Item>(KEY);
  });

  // ── getAll ───────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns an empty array when the key does not exist', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chrome.storage.local.get as any).mockImplementation((_key: string, cb: (r: Record<string, unknown>) => void) => {
        cb({});
      });

      const result = await adapter.getAll();
      expect(result).toEqual([]);
    });

    it('returns the stored array when the key exists', async () => {
      const stored: Item[] = [{ id: '1', value: 'a' }, { id: '2', value: 'b' }];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chrome.storage.local.get as any).mockImplementation((_key: string, cb: (r: Record<string, unknown>) => void) => {
        cb({ [KEY]: stored });
      });

      const result = await adapter.getAll();
      expect(result).toEqual(stored);
    });

    it('passes the correct key to chrome.storage.local.get', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chrome.storage.local.get as any).mockImplementation((key: string, cb: (r: Record<string, unknown>) => void) => {
        cb({ [key]: [] });
      });

      await adapter.getAll();
      expect(chrome.storage.local.get).toHaveBeenCalledWith(KEY, expect.any(Function));
    });
  });

  // ── setAll ───────────────────────────────────────────────────────────────

  describe('setAll', () => {
    it('writes items to storage under the correct key', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chrome.storage.local.set as any).mockImplementation((_items: unknown, cb: () => void) => {
        cb();
      });

      const items: Item[] = [{ id: 'x', value: 'foo' }];
      await adapter.setAll(items);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ [KEY]: items }, expect.any(Function));
    });

    it('resolves after the callback fires', async () => {
      let callbackCalled = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chrome.storage.local.set as any).mockImplementation((_items: unknown, cb: () => void) => {
        callbackCalled = true;
        cb();
      });

      await adapter.setAll([]);
      expect(callbackCalled).toBe(true);
    });

    it('round-trips data — setAll then getAll returns same items', async () => {
      let stored: unknown;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chrome.storage.local.set as any).mockImplementation((items: Record<string, unknown>, cb: () => void) => {
        stored = items[KEY];
        cb();
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chrome.storage.local.get as any).mockImplementation((_key: string, cb: (r: Record<string, unknown>) => void) => {
        cb({ [KEY]: stored });
      });

      const items: Item[] = [{ id: '1', value: 'round-trip' }];
      await adapter.setAll(items);
      const result = await adapter.getAll();
      expect(result).toEqual(items);
    });
  });
});
