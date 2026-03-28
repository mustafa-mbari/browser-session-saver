import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@shared/hooks/useTheme';

/** Helper: set chrome.storage.local.get to call callback with given data */
function mockStorageGet(data: Record<string, unknown>) {
  vi.mocked(chrome.storage.local.get).mockImplementation(
    ((...args: unknown[]) => {
      const callback = args[args.length - 1];
      if (typeof callback === 'function') callback(data);
    }) as typeof chrome.storage.local.get,
  );
}

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no stored settings
    mockStorageGet({});
    // Default matchMedia: non-dark system
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    });
  });

  afterEach(() => {
    // Clean up any dark class left by tests
    document.documentElement.classList.remove('dark');
  });

  it('defaults to system theme when no stored preference exists', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
  });

  it('loads dark theme from storage and adds dark class', async () => {
    mockStorageGet({ settings: { theme: 'dark' } });

    const { result } = renderHook(() => useTheme());

    await act(async () => { await Promise.resolve(); });

    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('loads light theme from storage and does not add dark class', async () => {
    mockStorageGet({ settings: { theme: 'light' } });

    renderHook(() => useTheme());

    await act(async () => { await Promise.resolve(); });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('system theme with dark matchMedia resolves to dark mode', async () => {
    // System theme (default) + dark OS preference
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    });

    const { result } = renderHook(() => useTheme());

    await act(async () => { await Promise.resolve(); });

    // theme is still 'system' but isDark is true
    expect(result.current.theme).toBe('system');
    expect(result.current.isDark).toBe(true);
  });

  it('updates theme when chrome.storage.onChanged fires', async () => {
    mockStorageGet({});

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');

    // Simulate a storage change from another extension page
    const onChangedListener = vi.mocked(chrome.storage.local.onChanged.addListener).mock.calls[0]?.[0];
    expect(onChangedListener).toBeDefined();

    await act(async () => {
      onChangedListener({ settings: { newValue: { theme: 'dark' }, oldValue: {} } }, 'local');
    });

    expect(result.current.theme).toBe('dark');
  });

  it('removes onChanged listener on unmount', () => {
    const { unmount } = renderHook(() => useTheme());

    unmount();

    expect(chrome.storage.local.onChanged.removeListener).toHaveBeenCalled();
  });
});
