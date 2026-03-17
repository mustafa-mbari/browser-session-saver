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

export async function restoreTabGroups(
  tabGroups: TabGroup[],
  tabs: Tab[],
  windowId: number,
): Promise<Map<number, number>> {
  const groupIdMap = new Map<number, number>();

  for (const group of tabGroups) {
    const groupTabs = tabs
      .filter((t) => t.groupId === group.id)
      .sort((a, b) => a.index - b.index);
    if (groupTabs.length === 0) continue;

    const tabIds: number[] = [];
    for (const tab of groupTabs) {
      const created = await chrome.tabs.create({
        url: tab.url,
        windowId,
        pinned: tab.pinned,
        active: false,
      });
      if (created.id) tabIds.push(created.id);
    }

    if (tabIds.length > 0) {
      const newGroupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
      await chrome.tabGroups.update(newGroupId, {
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
      });
      groupIdMap.set(group.id, newGroupId);
    }
  }

  return groupIdMap;
}
