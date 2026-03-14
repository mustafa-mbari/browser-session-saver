import { create } from 'zustand';

export type DashboardPage = 'sessions' | 'auto-saves' | 'tab-groups' | 'import-export' | 'settings';

interface DashboardState {
  activePage: DashboardPage;
  selectedSessionIds: Set<string>;
  isSelectionMode: boolean;

  setPage: (page: DashboardPage) => void;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  activePage: 'sessions',
  selectedSessionIds: new Set(),
  isSelectionMode: false,

  setPage: (page) => set({ activePage: page, selectedSessionIds: new Set(), isSelectionMode: false }),

  toggleSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedSessionIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedSessionIds: next, isSelectionMode: next.size > 0 };
    }),

  selectAll: (ids) => set({ selectedSessionIds: new Set(ids), isSelectionMode: true }),

  clearSelection: () => set({ selectedSessionIds: new Set(), isSelectionMode: false }),
}));
