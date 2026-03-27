import { create } from 'zustand';
import {
  DEFAULT_NEWTAB_SETTINGS,
  type LayoutMode,
  type NewTabSettings,
} from '@core/types/newtab.types';
import { updateNewTabSettings } from '@core/services/newtab-settings.service';

export type NewTabView =
  | 'bookmarks'
  | 'folder-explorer'
  | 'sessions'
  | 'auto-saves'
  | 'tab-groups'
  | 'import-export'
  | 'subscriptions'
  | 'prompts'
  | 'cloud-sync'
  | 'settings';

interface NewTabUIState {
  settings: NewTabSettings;
  layoutMode: LayoutMode;
  activeView: NewTabView;
  searchQuery: string;
  isSettingsOpen: boolean;
  isWallpaperOpen: boolean;
  isKeyboardHelpOpen: boolean;
  isLoading: boolean;

  setSettings: (s: NewTabSettings) => void;
  updateSettings: (partial: Partial<NewTabSettings>) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setActiveView: (view: NewTabView) => void;
  setSearchQuery: (q: string) => void;
  toggleSettings: () => void;
  toggleWallpaper: () => void;
  toggleKeyboardHelp: () => void;
  setLoading: (v: boolean) => void;
}

export const useNewTabUIStore = create<NewTabUIState>((set) => ({
  settings: DEFAULT_NEWTAB_SETTINGS,
  layoutMode: DEFAULT_NEWTAB_SETTINGS.layoutMode,
  activeView: 'bookmarks',
  searchQuery: '',
  isSettingsOpen: false,
  isWallpaperOpen: false,
  isKeyboardHelpOpen: false,
  isLoading: true,

  setSettings: (s) => set({ settings: s, layoutMode: s.layoutMode }),
  updateSettings: (partial) => {
    void updateNewTabSettings(partial);
    set((state) => ({
      settings: { ...state.settings, ...partial },
      layoutMode: partial.layoutMode ?? state.layoutMode,
    }));
  },
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  setActiveView: (view) => set({ activeView: view }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleSettings: () => set((s) => ({ isSettingsOpen: !s.isSettingsOpen })),
  toggleWallpaper: () => set((s) => ({ isWallpaperOpen: !s.isWallpaperOpen })),
  toggleKeyboardHelp: () => set((s) => ({ isKeyboardHelpOpen: !s.isKeyboardHelpOpen })),
  setLoading: (v) => set({ isLoading: v }),
}));
