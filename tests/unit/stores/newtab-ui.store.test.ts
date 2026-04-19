import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';

// Mock the settings service so updateSettings doesn't hit chrome.storage
vi.mock('@core/services/newtab-settings.service', () => ({
  updateNewTabSettings: vi.fn().mockResolvedValue({}),
}));

import { useNewTabUIStore } from '@newtab/stores/newtab-ui.store';
import { DEFAULT_NEWTAB_SETTINGS } from '@core/types/newtab.types';
import { updateNewTabSettings } from '@core/services/newtab-settings.service';

const initialState = {
  settings: DEFAULT_NEWTAB_SETTINGS,
  layoutMode: DEFAULT_NEWTAB_SETTINGS.layoutMode,
  activeView: 'bookmarks' as const,
  searchQuery: '',
  isSettingsOpen: false,
  isWallpaperOpen: false,
  isKeyboardHelpOpen: false,
  isLoading: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  act(() => { useNewTabUIStore.setState(initialState); });
});

describe('newtab-ui.store', () => {
  // ── setSettings ────────────────────────────────────────────────────────────

  it('setSettings updates settings and syncs layoutMode', () => {
    const newSettings = { ...DEFAULT_NEWTAB_SETTINGS, layoutMode: 'focus' as const };
    act(() => { useNewTabUIStore.getState().setSettings(newSettings); });
    expect(useNewTabUIStore.getState().settings.layoutMode).toBe('focus');
    expect(useNewTabUIStore.getState().layoutMode).toBe('focus');
  });

  // ── updateSettings ─────────────────────────────────────────────────────────

  it('updateSettings merges partial settings into state', () => {
    act(() => { useNewTabUIStore.getState().updateSettings({ clockFormat: '24h' }); });
    expect(useNewTabUIStore.getState().settings.clockFormat).toBe('24h');
  });

  it('updateSettings calls updateNewTabSettings service', () => {
    act(() => { useNewTabUIStore.getState().updateSettings({ showClock: true }); });
    expect(updateNewTabSettings).toHaveBeenCalledWith({ showClock: true });
  });

  it('updateSettings with layoutMode syncs layoutMode state', () => {
    act(() => { useNewTabUIStore.getState().updateSettings({ layoutMode: 'minimal' }); });
    expect(useNewTabUIStore.getState().layoutMode).toBe('minimal');
  });

  // ── setActiveView ──────────────────────────────────────────────────────────

  it('setActiveView changes activeView', () => {
    act(() => { useNewTabUIStore.getState().setActiveView('sessions'); });
    expect(useNewTabUIStore.getState().activeView).toBe('sessions');
  });

  // ── setSearchQuery ─────────────────────────────────────────────────────────

  it('setSearchQuery updates searchQuery', () => {
    act(() => { useNewTabUIStore.getState().setSearchQuery('hello'); });
    expect(useNewTabUIStore.getState().searchQuery).toBe('hello');
  });

  // ── toggle booleans ────────────────────────────────────────────────────────

  it('toggleSettings flips isSettingsOpen', () => {
    expect(useNewTabUIStore.getState().isSettingsOpen).toBe(false);
    act(() => { useNewTabUIStore.getState().toggleSettings(); });
    expect(useNewTabUIStore.getState().isSettingsOpen).toBe(true);
    act(() => { useNewTabUIStore.getState().toggleSettings(); });
    expect(useNewTabUIStore.getState().isSettingsOpen).toBe(false);
  });

  it('toggleWallpaper flips isWallpaperOpen', () => {
    act(() => { useNewTabUIStore.getState().toggleWallpaper(); });
    expect(useNewTabUIStore.getState().isWallpaperOpen).toBe(true);
  });

  it('toggleKeyboardHelp flips isKeyboardHelpOpen', () => {
    act(() => { useNewTabUIStore.getState().toggleKeyboardHelp(); });
    expect(useNewTabUIStore.getState().isKeyboardHelpOpen).toBe(true);
  });

  // ── setLoading ─────────────────────────────────────────────────────────────

  it('setLoading updates isLoading', () => {
    act(() => { useNewTabUIStore.getState().setLoading(false); });
    expect(useNewTabUIStore.getState().isLoading).toBe(false);
  });

  it('setLayoutMode updates layoutMode directly', () => {
    act(() => { useNewTabUIStore.getState().setLayoutMode('dashboard'); });
    expect(useNewTabUIStore.getState().layoutMode).toBe('dashboard');
  });

  // ── updateSettings error handling (T-12) ────────────────────────────────────

  it('reverts store state when updateNewTabSettings persistence fails', async () => {
    vi.mocked(updateNewTabSettings).mockRejectedValueOnce(new Error('storage full'));
    const original = useNewTabUIStore.getState().settings.clockFormat;

    await act(async () => {
      await useNewTabUIStore.getState().updateSettings({ clockFormat: '24h' });
    });

    // After persistence failure, store must revert — not silently keep dirty state.
    // Currently: state is updated and never reverted → this FAILS before fix.
    expect(useNewTabUIStore.getState().settings.clockFormat).toBe(original);
  });

  it('keeps updated state when persistence succeeds', async () => {
    vi.mocked(updateNewTabSettings).mockResolvedValueOnce({} as never);

    await act(async () => {
      await useNewTabUIStore.getState().updateSettings({ clockFormat: '24h' });
    });

    expect(useNewTabUIStore.getState().settings.clockFormat).toBe('24h');
  });
});
