import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@core/services/newtab-settings.service', () => ({
  getNewTabSettings: vi.fn(),
  updateNewTabSettings: vi.fn(),
}));

import { useNewTabSettings } from '@newtab/hooks/useNewTabSettings';
import { useNewTabUIStore } from '@newtab/stores/newtab-ui.store';
import { DEFAULT_NEWTAB_SETTINGS } from '@core/types/newtab.types';
import { getNewTabSettings, updateNewTabSettings } from '@core/services/newtab-settings.service';

const LOADED_SETTINGS = { ...DEFAULT_NEWTAB_SETTINGS, clockFormat: '24h' as const };

describe('useNewTabSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    act(() => {
      useNewTabUIStore.setState({
        settings: DEFAULT_NEWTAB_SETTINGS,
        layoutMode: DEFAULT_NEWTAB_SETTINGS.layoutMode,
      });
    });
    vi.mocked(getNewTabSettings).mockResolvedValue(LOADED_SETTINGS);
    vi.mocked(updateNewTabSettings).mockResolvedValue(LOADED_SETTINGS);
  });

  it('starts with isLoading = true', () => {
    const { result } = renderHook(() => useNewTabSettings());
    expect(result.current.isLoading).toBe(true);
  });

  it('loads settings from service on mount and sets isLoading = false', async () => {
    const { result } = renderHook(() => useNewTabSettings());

    await act(async () => { await Promise.resolve(); });

    expect(getNewTabSettings).toHaveBeenCalledOnce();
    expect(result.current.settings.clockFormat).toBe('24h');
    expect(result.current.isLoading).toBe(false);
  });

  it('falls back to DEFAULT_NEWTAB_SETTINGS when service throws', async () => {
    vi.mocked(getNewTabSettings).mockRejectedValueOnce(new Error('storage unavailable'));

    const { result } = renderHook(() => useNewTabSettings());

    await act(async () => { await Promise.resolve(); });

    expect(result.current.settings).toEqual(DEFAULT_NEWTAB_SETTINGS);
    expect(result.current.isLoading).toBe(false);
  });

  it('updateSettings calls updateNewTabSettings and updates store', async () => {
    const updated = { ...LOADED_SETTINGS, showClock: false };
    vi.mocked(updateNewTabSettings).mockResolvedValueOnce(updated);

    const { result } = renderHook(() => useNewTabSettings());
    await act(async () => { await Promise.resolve(); }); // wait for load

    await act(async () => {
      await result.current.updateSettings({ showClock: false });
    });

    expect(updateNewTabSettings).toHaveBeenCalledWith({ showClock: false });
    expect(result.current.settings.showClock).toBe(false);
  });

  it('updates settings when chrome.storage.onChanged fires with newtab_settings key', async () => {
    const { result } = renderHook(() => useNewTabSettings());
    await act(async () => { await Promise.resolve(); });

    // Grab the onChanged listener registered by the hook
    const onChangedListener = vi.mocked(chrome.storage.local.onChanged.addListener).mock.calls[0]?.[0];
    expect(onChangedListener).toBeDefined();

    const newSettings = { ...DEFAULT_NEWTAB_SETTINGS, showClock: false };

    await act(async () => {
      onChangedListener(
        { newtab_settings: { newValue: newSettings, oldValue: DEFAULT_NEWTAB_SETTINGS } },
        'local',
      );
    });

    expect(result.current.settings.showClock).toBe(false);
  });

  it('removes onChanged listener on unmount', async () => {
    const { unmount } = renderHook(() => useNewTabSettings());
    await act(async () => { await Promise.resolve(); });

    unmount();

    expect(chrome.storage.local.onChanged.removeListener).toHaveBeenCalled();
  });
});
