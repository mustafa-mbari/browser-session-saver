import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useSidePanelStore } from '@sidepanel/stores/sidepanel.store';

// Reset to initial state before each test (Zustand singletons persist across tests)
const initialState = {
  currentView: 'home' as const,
  navigationStack: ['home' as const],
  selectedSessionId: null,
  activeFilter: 'all' as const,
  sortBy: 'date' as const,
  sortDirection: 'desc' as const,
  focusSearch: null,
  selectedSessionIds: new Set<string>(),
  isSelectionMode: false,
  activeHomeTab: 'session' as const,
};

beforeEach(() => {
  act(() => { useSidePanelStore.setState(initialState); });
});

describe('sidepanel.store — navigateTo', () => {
  it('pushes view onto navigation stack', () => {
    act(() => { useSidePanelStore.getState().navigateTo('settings'); });
    const { currentView, navigationStack } = useSidePanelStore.getState();
    expect(currentView).toBe('settings');
    expect(navigationStack).toContain('settings');
  });

  it('stores sessionId when navigating to session-detail', () => {
    act(() => { useSidePanelStore.getState().navigateTo('session-detail', 'abc123'); });
    expect(useSidePanelStore.getState().selectedSessionId).toBe('abc123');
  });

  it('does not push duplicate view when already on that view', () => {
    const initialLen = useSidePanelStore.getState().navigationStack.length;
    act(() => { useSidePanelStore.getState().navigateTo('home'); });
    expect(useSidePanelStore.getState().navigationStack.length).toBe(initialLen);
  });
});

describe('sidepanel.store — goBack', () => {
  it('pops the last view from the stack', () => {
    act(() => { useSidePanelStore.getState().navigateTo('settings'); });
    act(() => { useSidePanelStore.getState().goBack(); });
    expect(useSidePanelStore.getState().currentView).toBe('home');
  });

  it('clears selectedSessionId when going back to home', () => {
    act(() => { useSidePanelStore.getState().navigateTo('session-detail', 'abc'); });
    act(() => { useSidePanelStore.getState().goBack(); });
    expect(useSidePanelStore.getState().selectedSessionId).toBeNull();
  });

  it('goBack at root stays on home', () => {
    act(() => { useSidePanelStore.getState().goBack(); });
    expect(useSidePanelStore.getState().currentView).toBe('home');
    expect(useSidePanelStore.getState().navigationStack).toEqual(['home']);
  });

  it('multi-level navigation and back works correctly', () => {
    act(() => { useSidePanelStore.getState().navigateTo('settings'); });
    act(() => { useSidePanelStore.getState().navigateTo('import-export'); });
    act(() => { useSidePanelStore.getState().goBack(); });
    expect(useSidePanelStore.getState().currentView).toBe('settings');
    act(() => { useSidePanelStore.getState().goBack(); });
    expect(useSidePanelStore.getState().currentView).toBe('home');
  });
});

describe('sidepanel.store — setFilter / setSort', () => {
  it('setFilter updates activeFilter', () => {
    act(() => { useSidePanelStore.getState().setFilter('starred'); });
    expect(useSidePanelStore.getState().activeFilter).toBe('starred');
  });

  it('setSort updates sortBy and sets desc by default', () => {
    act(() => { useSidePanelStore.getState().setSort('name'); });
    const { sortBy, sortDirection } = useSidePanelStore.getState();
    expect(sortBy).toBe('name');
    expect(sortDirection).toBe('desc');
  });

  it('setSort toggles asc↔desc when called with same field', () => {
    act(() => { useSidePanelStore.setState({ sortBy: 'date', sortDirection: 'desc' }); });
    act(() => { useSidePanelStore.getState().setSort('date'); });
    expect(useSidePanelStore.getState().sortDirection).toBe('asc');
    act(() => { useSidePanelStore.getState().setSort('date'); });
    expect(useSidePanelStore.getState().sortDirection).toBe('desc');
  });
});

describe('sidepanel.store — toggleSelection / clearSelection', () => {
  it('toggleSelection adds id to selectedSessionIds', () => {
    act(() => { useSidePanelStore.getState().toggleSelection('id1'); });
    expect(useSidePanelStore.getState().selectedSessionIds.has('id1')).toBe(true);
    expect(useSidePanelStore.getState().isSelectionMode).toBe(true);
  });

  it('toggleSelection removes id when already selected', () => {
    act(() => { useSidePanelStore.getState().toggleSelection('id1'); });
    act(() => { useSidePanelStore.getState().toggleSelection('id1'); });
    expect(useSidePanelStore.getState().selectedSessionIds.has('id1')).toBe(false);
    expect(useSidePanelStore.getState().isSelectionMode).toBe(false);
  });

  it('clearSelection empties the set and sets isSelectionMode=false', () => {
    act(() => { useSidePanelStore.getState().toggleSelection('id1'); });
    act(() => { useSidePanelStore.getState().toggleSelection('id2'); });
    act(() => { useSidePanelStore.getState().clearSelection(); });
    expect(useSidePanelStore.getState().selectedSessionIds.size).toBe(0);
    expect(useSidePanelStore.getState().isSelectionMode).toBe(false);
  });
});

describe('sidepanel.store — setActiveHomeTab', () => {
  it('updates activeHomeTab', () => {
    act(() => { useSidePanelStore.getState().setActiveHomeTab('tab-group'); });
    expect(useSidePanelStore.getState().activeHomeTab).toBe('tab-group');
  });
});
