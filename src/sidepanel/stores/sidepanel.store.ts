import { create } from 'zustand';

export type SidePanelView = 'home' | 'session-detail' | 'tab-groups' | 'settings' | 'import-export' | 'subscriptions' | 'prompts';
export type FilterType = 'all' | 'manual' | 'auto' | 'starred' | 'pinned';
export type SortField = 'date' | 'name' | 'tabs';
export type HomeTab = 'session' | 'tab' | 'tab-group' | 'folders' | 'prompts' | 'subscriptions';
export type NavBarTab = 'menu' | 'new-tab' | 'dynamic';

interface SidePanelState {
  currentView: SidePanelView;
  navigationStack: SidePanelView[];
  selectedSessionId: string | null;
  activeFilter: FilterType;
  sortBy: SortField;
  sortDirection: 'asc' | 'desc';
  focusSearch: (() => void) | null;
  selectedSessionIds: Set<string>;
  isSelectionMode: boolean;
  activeHomeTab: HomeTab;
  activeNavBarTab: NavBarTab;
  lastOpenedPage: HomeTab | null;

  navigateTo: (view: SidePanelView, sessionId?: string) => void;
  goBack: () => void;
  setFilter: (filter: FilterType) => void;
  setSort: (field: SortField) => void;
  selectSession: (id: string | null) => void;
  setFocusSearch: (fn: (() => void) | null) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  setActiveHomeTab: (tab: HomeTab) => void;
  setActiveNavBarTab: (tab: NavBarTab) => void;
  openPageFromMenu: (page: HomeTab) => void;
}

export const useSidePanelStore = create<SidePanelState>((set) => ({
  currentView: 'home',
  navigationStack: ['home'],
  selectedSessionId: null,
  activeFilter: 'all',
  sortBy: 'date',
  sortDirection: 'desc',
  focusSearch: null,
  selectedSessionIds: new Set<string>(),
  isSelectionMode: false,
  activeHomeTab: 'session',
  activeNavBarTab: 'menu',
  lastOpenedPage: null,

  navigateTo: (view, sessionId) =>
    set((state) => {
      if (state.currentView === view && !sessionId) return state;
      return {
        currentView: view,
        navigationStack: [...state.navigationStack, view],
        selectedSessionId: sessionId ?? state.selectedSessionId,
      };
    }),

  goBack: () =>
    set((state) => {
      // If on dynamic tab in home view, go back to menu
      if (state.currentView === 'home' && state.activeNavBarTab === 'dynamic') {
        return { activeNavBarTab: 'menu' };
      }
      const stack = [...state.navigationStack];
      stack.pop();
      const prev = stack[stack.length - 1] ?? 'home';
      return {
        currentView: prev,
        navigationStack: stack.length > 0 ? stack : ['home'],
        selectedSessionId: prev === 'home' ? null : state.selectedSessionId,
      };
    }),

  setFilter: (filter) => set({ activeFilter: filter }),

  setSort: (field) =>
    set((state) => ({
      sortBy: field,
      sortDirection: state.sortBy === field && state.sortDirection === 'desc' ? 'asc' : 'desc',
    })),

  selectSession: (id) => set({ selectedSessionId: id }),

  setFocusSearch: (fn) => set({ focusSearch: fn }),

  toggleSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedSessionIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return {
        selectedSessionIds: next,
        isSelectionMode: next.size > 0,
      };
    }),

  clearSelection: () => set({ selectedSessionIds: new Set<string>(), isSelectionMode: false }),

  setActiveHomeTab: (tab) => set({ activeHomeTab: tab }),

  setActiveNavBarTab: (tab) =>
    set((state) => {
      if (tab === 'new-tab') return state;
      if (tab === 'dynamic' && state.lastOpenedPage) {
        return {
          activeNavBarTab: 'dynamic',
          activeHomeTab: state.lastOpenedPage,
          currentView: 'home',
        };
      }
      if (tab === 'menu') {
        return { activeNavBarTab: 'menu', currentView: 'home' };
      }
      return state;
    }),

  openPageFromMenu: (page) =>
    set({
      activeNavBarTab: 'dynamic',
      activeHomeTab: page,
      lastOpenedPage: page,
      currentView: 'home',
    }),
}));
