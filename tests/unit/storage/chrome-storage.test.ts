import { describe, it, expect, beforeEach } from 'vitest';
import { ChromeStorageAdapter } from '@core/storage/chrome-storage';

describe('ChromeStorageAdapter', () => {
  let adapter: ChromeStorageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ChromeStorageAdapter();
  });

  // ── get ──────────────────────────────────────────────────────────────────

  it('get returns null when key is absent', async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValueOnce({});
    const result = await adapter.get('missing');
    expect(result).toBeNull();
  });

  it('get returns the stored value', async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValueOnce({ myKey: { data: 42 } });
    const result = await adapter.get<{ data: number }>('myKey');
    expect(result).toEqual({ data: 42 });
  });

  it('get calls chrome.storage.local.get with the correct key', async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValueOnce({});
    await adapter.get('testKey');
    expect(chrome.storage.local.get).toHaveBeenCalledWith('testKey');
  });

  // ── set ──────────────────────────────────────────────────────────────────

  it('set calls chrome.storage.local.set with correct payload', async () => {
    await adapter.set('k', { x: 1 });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ k: { x: 1 } });
  });

  it('set resolves without throwing', async () => {
    await expect(adapter.set('k', 'value')).resolves.toBeUndefined();
  });

  // ── remove ───────────────────────────────────────────────────────────────

  it('remove calls chrome.storage.local.remove with the key', async () => {
    await adapter.remove('oldKey');
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('oldKey');
  });

  // ── getAll ───────────────────────────────────────────────────────────────

  it('getAll returns all stored data', async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValueOnce({ a: 1, b: 2 });
    const result = await adapter.getAll();
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('getAll calls chrome.storage.local.get with null', async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValueOnce({});
    await adapter.getAll();
    expect(chrome.storage.local.get).toHaveBeenCalledWith(null);
  });

  // ── clear ────────────────────────────────────────────────────────────────

  it('clear calls chrome.storage.local.clear', async () => {
    await adapter.clear();
    expect(chrome.storage.local.clear).toHaveBeenCalled();
  });

  // ── getUsedBytes ─────────────────────────────────────────────────────────

  it('getUsedBytes returns value from getBytesInUse', async () => {
    vi.mocked(chrome.storage.local.getBytesInUse).mockResolvedValueOnce(1024);
    const bytes = await adapter.getUsedBytes();
    expect(bytes).toBe(1024);
    expect(chrome.storage.local.getBytesInUse).toHaveBeenCalledWith(null);
  });

  // ── count ────────────────────────────────────────────────────────────────

  it('count returns number of keys in storage', async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValueOnce({ a: 1, b: 2, c: 3 });
    const count = await adapter.count();
    expect(count).toBe(3);
  });

  it('count returns 0 for empty storage', async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValueOnce({});
    const count = await adapter.count();
    expect(count).toBe(0);
  });
});
