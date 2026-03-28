import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@core/storage/newtab-storage', () => ({ newtabDB: {} }));

const { mockBuildStyle, mockGetUrl } = vi.hoisted(() => ({
  mockBuildStyle: vi.fn(),
  mockGetUrl: vi.fn(),
}));

vi.mock('@core/services/wallpaper.service', () => ({
  buildBackgroundStyle: mockBuildStyle,
  getUserWallpaperUrl: mockGetUrl,
}));

import { useWallpaper } from '@newtab/hooks/useWallpaper';
import type { NewTabSettings } from '@core/types/newtab.types';
import { DEFAULT_NEWTAB_SETTINGS } from '@core/types/newtab.types';

function makeSettings(overrides: Partial<NewTabSettings> = {}): NewTabSettings {
  return { ...DEFAULT_NEWTAB_SETTINGS, ...overrides };
}

describe('useWallpaper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildStyle.mockReturnValue({ background: 'linear-gradient(#000, #fff)' });
  });

  it('returns base style for gradient background type', () => {
    const settings = makeSettings({ backgroundType: 'gradient' });

    const { result } = renderHook(() => useWallpaper(settings));

    expect(result.current.backgroundStyle).toEqual({ background: 'linear-gradient(#000, #fff)' });
    expect(mockGetUrl).not.toHaveBeenCalled();
  });

  it('returns base style for none/default background type', () => {
    const settings = makeSettings({ backgroundType: 'none' });

    const { result } = renderHook(() => useWallpaper(settings));

    expect(result.current.backgroundStyle).toEqual({ background: 'linear-gradient(#000, #fff)' });
  });

  it('uses chrome.runtime.getURL for bundled background', () => {
    const settings = makeSettings({
      backgroundType: 'bundled',
      backgroundBundledPath: 'assets/bg1.jpg',
    });

    const { result } = renderHook(() => useWallpaper(settings));

    expect(result.current.backgroundStyle.backgroundImage).toBe(
      `url(chrome-extension://mock-id/assets/bg1.jpg)`,
    );
  });

  it('calls getUserWallpaperUrl and returns object URL for image type', async () => {
    mockGetUrl.mockResolvedValueOnce('blob:mock-url');

    const settings = makeSettings({
      backgroundType: 'image',
      backgroundImageId: 'img-001',
    });

    const { result } = renderHook(() => useWallpaper(settings));

    await act(async () => { await Promise.resolve(); });

    expect(mockGetUrl).toHaveBeenCalled();
    expect(result.current.backgroundStyle.backgroundImage).toBe('url(blob:mock-url)');
  });

  it('revokes object URLs on unmount', async () => {
    mockGetUrl.mockResolvedValueOnce('blob:mock-url');

    const settings = makeSettings({
      backgroundType: 'image',
      backgroundImageId: 'img-001',
    });

    const { unmount } = renderHook(() => useWallpaper(settings));

    await act(async () => { await Promise.resolve(); });

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
