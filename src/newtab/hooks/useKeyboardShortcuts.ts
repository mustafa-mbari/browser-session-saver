import { useEffect } from 'react';
import { useKeyboard } from '@shared/hooks/useKeyboard';
import { useNewTabStore } from '@newtab/stores/newtab.store';
import type { LayoutMode } from '@core/types/newtab.types';

const LAYOUT_CYCLE: LayoutMode[] = ['minimal', 'focus', 'dashboard'];

export function useKeyboardShortcuts(opts?: {
  focusSearchRef?: React.RefObject<HTMLInputElement | null>;
  focusTodoRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const store = useNewTabStore();

  useKeyboard({
    'Ctrl+Shift+L': () => {
      const idx = LAYOUT_CYCLE.indexOf(store.layoutMode);
      const next = LAYOUT_CYCLE[(idx + 1) % LAYOUT_CYCLE.length];
      store.setLayoutMode(next);
      void store.settings;
    },
    'Ctrl+Shift+D': () => {
      const next = store.settings.cardDensity === 'comfortable' ? 'compact' : 'comfortable';
      store.updateSettings({ cardDensity: next });
    },
    'Ctrl+B': () => {
      store.updateSettings({ sidebarCollapsed: !store.settings.sidebarCollapsed });
    },
    'Ctrl+,': () => {
      store.toggleSettings();
    },
    'Ctrl+Shift+T': () => {
      const themes = ['light', 'dark', 'system'] as const;
      const idx = themes.indexOf(store.settings.theme);
      const next = themes[(idx + 1) % themes.length];
      store.updateSettings({ theme: next });
    },
    'Ctrl+Shift+W': () => {
      store.toggleWallpaper();
    },
    'Escape': () => {
      if (store.isSettingsOpen) store.toggleSettings();
      else if (store.isWallpaperOpen) store.toggleWallpaper();
      else if (store.isKeyboardHelpOpen) store.toggleKeyboardHelp();
    },
  });

  // Board switching: Ctrl+1 through Ctrl+9
  useKeyboard(
    Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [
        `Ctrl+${i + 1}`,
        () => {
          const board = store.boards[i];
          if (board) store.updateSettings({ activeBoardId: board.id });
        },
      ]),
    ),
  );

  // Bare '/' and '?' keys need special handling (not supported by useKeyboard which requires modifiers)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === '/' || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault();
        opts?.focusSearchRef?.current?.focus();
      }
      if (e.key === 't' || e.key === 'T') {
        if (!e.ctrlKey) {
          opts?.focusTodoRef?.current?.focus();
        }
      }
      if (e.key === '?') {
        store.toggleKeyboardHelp();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [opts, store]);

  // Ctrl+K for search
  useKeyboard({
    'Ctrl+K': () => {
      opts?.focusSearchRef?.current?.focus();
    },
    'Ctrl+T': () => {
      opts?.focusTodoRef?.current?.focus();
    },
  });
}
