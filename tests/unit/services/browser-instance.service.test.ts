import { describe, it, expect, vi, beforeEach } from 'vitest';

let store: Record<string, unknown> = {};

async function freshModule() {
  vi.resetModules();
  return import('@core/services/browser-instance.service');
}

beforeEach(() => {
  store = {};
  vi.mocked(chrome.storage.local.get).mockImplementation((async (key: string) =>
    key in store ? { [key]: store[key] } : {}) as unknown as typeof chrome.storage.local.get);
  vi.mocked(chrome.storage.local.set).mockImplementation((async (items: Record<string, unknown>) => {
    Object.assign(store, items);
  }) as unknown as typeof chrome.storage.local.set);
});

describe('getBrowserInstance', () => {
  it('creates an identity once and keeps returning it', async () => {
    const { getBrowserInstance } = await freshModule();
    const first = await getBrowserInstance();
    const second = await getBrowserInstance();

    expect(first.id).toBeTruthy();
    expect(second).toEqual(first);
    expect(store.browser_instance).toEqual(first);
  });

  it('reuses the stored identity after a restart', async () => {
    store.browser_instance = { id: 'stored-id', label: 'Edge' };
    const { getBrowserInstance } = await freshModule();
    expect(await getBrowserInstance()).toEqual({ id: 'stored-id', label: 'Edge' });
  });

  it('renames without changing the id', async () => {
    store.browser_instance = { id: 'stored-id', label: 'Chrome' };
    const { getBrowserInstance, renameBrowserInstance } = await freshModule();

    await renameBrowserInstance('  Work laptop  ');

    expect(await getBrowserInstance()).toEqual({ id: 'stored-id', label: 'Work laptop' });
    expect(store.browser_instance).toEqual({ id: 'stored-id', label: 'Work laptop' });
  });
});

describe('detectBrowserName', () => {
  it('recognises browsers from client hints and the user agent', async () => {
    const { detectBrowserName } = await freshModule();
    const nav = (brands: string[], userAgent = '', extra = {}) =>
      ({ userAgentData: { brands: brands.map((brand) => ({ brand })) }, userAgent, ...extra }) as unknown as Navigator;

    expect(detectBrowserName(nav(['Chromium', 'Microsoft Edge']))).toBe('Edge');
    expect(detectBrowserName(nav(['Chromium', 'Google Chrome']))).toBe('Chrome');
    expect(detectBrowserName(nav(['Chromium'], '', { brave: {} }))).toBe('Brave');
    expect(detectBrowserName(nav([], 'Mozilla/5.0 Chrome/140.0 OPR/120.0'))).toBe('Opera');
    expect(detectBrowserName(nav([], 'Mozilla/5.0'))).toBe('Browser');
  });
});
