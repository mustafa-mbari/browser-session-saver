import type { TabGroup, ChromeGroupColor, Tab } from '@core/types/session.types';

export function captureTabGroups(
  chromeTabs: chrome.tabs.Tab[],
  chromeGroups: chrome.tabGroups.TabGroup[],
): { tabs: Tab[]; tabGroups: TabGroup[] } {
  const tabGroups: TabGroup[] = chromeGroups.map((group) => ({
    id: group.id,
    title: group.title ?? '',
    color: group.color as ChromeGroupColor,
    collapsed: group.collapsed,
    tabIds: [],
  }));

  const tabs: Tab[] = chromeTabs.map((tab) => {
    const tabId = String(tab.id ?? Math.random());
    const groupId = tab.groupId ?? -1;

    const group = tabGroups.find((g) => g.id === groupId);
    if (group) {
      group.tabIds.push(tabId);
    }

    return {
      id: tabId,
      url: tab.url ?? '',
      title: tab.title ?? '',
      favIconUrl: tab.favIconUrl ?? '',
      index: tab.index,
      pinned: tab.pinned ?? false,
      groupId,
      active: tab.active ?? false,
      scrollPosition: { x: 0, y: 0 },
    };
  });

  return { tabs, tabGroups };
}
