import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts } from '@newtab/hooks/useKeyboardShortcuts';
import { useNewTabUIStore } from '@newtab/stores/newtab-ui.store';
import { useNewTabDataStore } from '@newtab/stores/newtab-data.store';
import { DEFAULT_NEWTAB_SETTINGS } from '@core/types/newtab.types';

// Mock updateNewTabSettings to avoid actual storage writes
vi.mock('@core/services/newtab-settings.service', () => ({
  updateNewTabSettings: vi.fn().mockResolvedValue({}),
}));

function resetStores() {
  act(() => {
    useNewTabUIStore.setState({
      settings: { ...DEFAULT_NEWTAB_SETTINGS },
      layoutMode: DEFAULT_NEWTAB_SETTINGS.layoutMode,
      isSettingsOpen: false,
      isWallpaperOpen: false,
      isKeyboardHelpOpen: false,
      activeView: 'bookmarks',
      searchQuery: '',
      isLoading: false,
    });
    useNewTabDataStore.setState({
      boards: [],
      categories: [],
      entries: [],
      quickLinks: [],
      todoLists: [],
      todoItems: [],
    });
  });
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  // ── Layout cycle ────────────────────────────────────────────────────────────

  it('Ctrl+Shift+L cycles layout mode from dashboard → minimal', () => {
    // Default layoutMode is 'dashboard'. LAYOUT_CYCLE = [minimal, focus, dashboard]
    // idx = 2, next = (2+1) % 3 = 0 → 'minimal'
    renderHook(() => useKeyboardShortcuts());

    act(() => { fireEvent.keyDown(document, { key: 'l', ctrlKey: true, shiftKey: true }); });

    expect(useNewTabUIStore.getState().layoutMode).toBe('minimal');
  });

  // ── Wallpaper toggle ────────────────────────────────────────────────────────

  it('Ctrl+Shift+W toggles isWallpaperOpen', () => {
    renderHook(() => useKeyboardShortcuts());

    expect(useNewTabUIStore.getState().isWallpaperOpen).toBe(false);

    act(() => { fireEvent.keyDown(document, { key: 'w', ctrlKey: true, shiftKey: true }); });

    expect(useNewTabUIStore.getState().isWallpaperOpen).toBe(true);
  });

  // ── Density toggle ─────────────────────────────────────────────────────────

  it('Ctrl+Shift+D toggles cardDensity from comfortable to compact', () => {
    act(() => {
      useNewTabUIStore.setState({
        settings: { ...DEFAULT_NEWTAB_SETTINGS, cardDensity: 'comfortable' },
      });
    });

    renderHook(() => useKeyboardShortcuts());

    act(() => { fireEvent.keyDown(document, { key: 'd', ctrlKey: true, shiftKey: true }); });

    expect(useNewTabUIStore.getState().settings.cardDensity).toBe('compact');
  });

  // ── Board switching ────────────────────────────────────────────────────────

  it('Ctrl+1 switches to the first board', () => {
    act(() => {
      useNewTabDataStore.setState({
        boards: [
          { id: 'board-alpha', name: 'Alpha', categoryIds: [] },
          { id: 'board-beta', name: 'Beta', categoryIds: [] },
        ],
      });
    });

    renderHook(() => useKeyboardShortcuts());

    act(() => { fireEvent.keyDown(document, { key: '1', ctrlKey: true }); });

    expect(useNewTabUIStore.getState().settings.activeBoardId).toBe('board-alpha');
  });

  it('Ctrl+9 is a no-op when there are fewer than 9 boards', () => {
    act(() => {
      useNewTabDataStore.setState({
        boards: [{ id: 'board-alpha', name: 'Alpha', categoryIds: [] }],
      });
      useNewTabUIStore.setState({
        settings: { ...DEFAULT_NEWTAB_SETTINGS, activeBoardId: 'board-alpha' },
      });
    });

    renderHook(() => useKeyboardShortcuts());

    act(() => { fireEvent.keyDown(document, { key: '9', ctrlKey: true }); });

    // activeBoardId should remain unchanged
    expect(useNewTabUIStore.getState().settings.activeBoardId).toBe('board-alpha');
  });

  // ── Bare '?' key ────────────────────────────────────────────────────────────

  it('bare ? key toggles keyboard help', () => {
    renderHook(() => useKeyboardShortcuts());

    expect(useNewTabUIStore.getState().isKeyboardHelpOpen).toBe(false);

    // Dispatch on window (bare key handler uses window.addEventListener)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    });

    expect(useNewTabUIStore.getState().isKeyboardHelpOpen).toBe(true);
  });
});
