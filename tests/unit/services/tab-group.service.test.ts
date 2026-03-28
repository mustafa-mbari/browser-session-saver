import { describe, it, expect } from 'vitest';
import { captureTabGroups } from '@core/services/tab-group.service';

const makeTab = (overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab => ({
  id: 1,
  index: 0,
  pinned: false,
  highlighted: false,
  windowId: 1,
  active: false,
  incognito: false,
  selected: false,
  discarded: false,
  autoDiscardable: true,
  groupId: -1,
  ...overrides,
});

const makeGroup = (overrides: Partial<chrome.tabGroups.TabGroup> = {}): chrome.tabGroups.TabGroup => ({
  id: 10,
  title: 'Group A',
  color: 'blue' as chrome.tabGroups.ColorEnum,
  collapsed: false,
  windowId: 1,
  ...overrides,
});

describe('captureTabGroups', () => {
  it('returns empty arrays for empty inputs', () => {
    const result = captureTabGroups([], []);
    expect(result.tabs).toHaveLength(0);
    expect(result.tabGroups).toHaveLength(0);
  });

  it('maps a single ungrouped tab correctly', () => {
    const tab = makeTab({ id: 5, url: 'https://example.com', title: 'Example', index: 0, pinned: true, active: true, groupId: -1 });
    const { tabs, tabGroups } = captureTabGroups([tab], []);
    expect(tabs).toHaveLength(1);
    expect(tabGroups).toHaveLength(0);
    expect(tabs[0].url).toBe('https://example.com');
    expect(tabs[0].title).toBe('Example');
    expect(tabs[0].pinned).toBe(true);
    expect(tabs[0].active).toBe(true);
    expect(tabs[0].groupId).toBe(-1);
    expect(tabs[0].id).toBe('5');
  });

  it('associates tabs with their group and populates tabIds', () => {
    const group = makeGroup({ id: 10, title: 'Work', color: 'blue' as chrome.tabGroups.ColorEnum });
    const tab1 = makeTab({ id: 1, groupId: 10 });
    const tab2 = makeTab({ id: 2, groupId: 10 });
    const tab3 = makeTab({ id: 3, groupId: -1 });

    const { tabs, tabGroups } = captureTabGroups([tab1, tab2, tab3], [group]);
    expect(tabGroups).toHaveLength(1);
    expect(tabGroups[0].title).toBe('Work');
    expect(tabGroups[0].color).toBe('blue');
    expect(tabGroups[0].tabIds).toEqual(['1', '2']);
    expect(tabs[2].groupId).toBe(-1);
  });

  it('handles multiple groups correctly', () => {
    const g1 = makeGroup({ id: 10 });
    const g2 = makeGroup({ id: 20, title: 'Personal', color: 'red' as chrome.tabGroups.ColorEnum });
    const tabs = [
      makeTab({ id: 1, groupId: 10 }),
      makeTab({ id: 2, groupId: 20 }),
      makeTab({ id: 3, groupId: 20 }),
    ];
    const { tabGroups } = captureTabGroups(tabs, [g1, g2]);
    expect(tabGroups[0].tabIds).toEqual(['1']);
    expect(tabGroups[1].tabIds).toEqual(['2', '3']);
  });

  it('defaults missing tab fields to safe values', () => {
    const tab = makeTab({ id: undefined, url: undefined, title: undefined, favIconUrl: undefined, pinned: undefined, active: undefined, groupId: undefined });
    const { tabs } = captureTabGroups([tab], []);
    expect(tabs[0].url).toBe('');
    expect(tabs[0].title).toBe('');
    expect(tabs[0].favIconUrl).toBe('');
    expect(tabs[0].pinned).toBe(false);
    expect(tabs[0].active).toBe(false);
    expect(tabs[0].groupId).toBe(-1);
    expect(typeof tabs[0].id).toBe('string');
  });

  it('defaults missing group title to empty string', () => {
    const group = makeGroup({ title: undefined });
    const { tabGroups } = captureTabGroups([], [group]);
    expect(tabGroups[0].title).toBe('');
  });

  it('sets scrollPosition to {x:0, y:0} for all tabs', () => {
    const { tabs } = captureTabGroups([makeTab()], []);
    expect(tabs[0].scrollPosition).toEqual({ x: 0, y: 0 });
  });
});
