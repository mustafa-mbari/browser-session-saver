import { create } from 'zustand';
import {
  DEFAULT_NEWTAB_SETTINGS,
  type Board,
  type BookmarkCategory,
  type BookmarkEntry,
  type LayoutMode,
  type NewTabSettings,
  type QuickLink,
  type TodoItem,
  type TodoList,
} from '@core/types/newtab.types';

export type NewTabView =
  | 'quick-links'
  | 'frequent'
  | 'tabs'
  | 'activity'
  | 'bookmarks'
  | 'sessions'
  | 'auto-saves'
  | 'tab-groups'
  | 'import-export';

interface NewTabState {
  settings: NewTabSettings;
  layoutMode: LayoutMode;
  activeView: NewTabView;
  boards: Board[];
  categories: BookmarkCategory[];
  entries: BookmarkEntry[];
  quickLinks: QuickLink[];
  todoLists: TodoList[];
  todoItems: TodoItem[];
  searchQuery: string;
  isSettingsOpen: boolean;
  isWallpaperOpen: boolean;
  isKeyboardHelpOpen: boolean;
  isLoading: boolean;

  setSettings: (s: NewTabSettings) => void;
  updateSettings: (partial: Partial<NewTabSettings>) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setActiveView: (view: NewTabView) => void;
  setBoards: (boards: Board[]) => void;
  setCategories: (cats: BookmarkCategory[]) => void;
  setEntries: (entries: BookmarkEntry[]) => void;
  setQuickLinks: (links: QuickLink[]) => void;
  setTodoLists: (lists: TodoList[]) => void;
  setTodoItems: (items: TodoItem[]) => void;
  setSearchQuery: (q: string) => void;
  toggleSettings: () => void;
  toggleWallpaper: () => void;
  toggleKeyboardHelp: () => void;
  setLoading: (v: boolean) => void;
}

export const useNewTabStore = create<NewTabState>((set) => ({
  settings: DEFAULT_NEWTAB_SETTINGS,
  layoutMode: DEFAULT_NEWTAB_SETTINGS.layoutMode,
  activeView: 'bookmarks',
  boards: [],
  categories: [],
  entries: [],
  quickLinks: [],
  todoLists: [],
  todoItems: [],
  searchQuery: '',
  isSettingsOpen: false,
  isWallpaperOpen: false,
  isKeyboardHelpOpen: false,
  isLoading: true,

  setSettings: (s) => set({ settings: s, layoutMode: s.layoutMode }),
  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
      layoutMode: partial.layoutMode ?? state.layoutMode,
    })),
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  setActiveView: (view) => set({ activeView: view }),
  setBoards: (boards) => set({ boards }),
  setCategories: (categories) => set({ categories }),
  setEntries: (entries) => set({ entries }),
  setQuickLinks: (quickLinks) => set({ quickLinks }),
  setTodoLists: (todoLists) => set({ todoLists }),
  setTodoItems: (todoItems) => set({ todoItems }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleSettings: () => set((s) => ({ isSettingsOpen: !s.isSettingsOpen })),
  toggleWallpaper: () => set((s) => ({ isWallpaperOpen: !s.isWallpaperOpen })),
  toggleKeyboardHelp: () => set((s) => ({ isKeyboardHelpOpen: !s.isKeyboardHelpOpen })),
  setLoading: (v) => set({ isLoading: v }),
}));
