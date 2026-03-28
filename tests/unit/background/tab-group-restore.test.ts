import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock TabGroupTemplateStorage before importing the module
const { mockGetAll } = vi.hoisted(() => ({ mockGetAll: vi.fn() }));

vi.mock('@core/storage/tab-group-template-storage', () => ({
  TabGroupTemplateStorage: { getAll: mockGetAll },
}));

import { restoreTabGroupNamesOnStartup } from '@background/tab-group-restore';
import type { TabGroupTemplate } from '@core/types/tab-group.types';

function makeTemplate(overrides: Partial<TabGroupTemplate> = {}): TabGroupTemplate {
  return {
    key: 'work-blue',
    title: 'Work',
    color: 'blue',
    tabs: [
      { url: 'https://github.com/foo', title: 'GitHub', favIconUrl: '' },
      { url: 'https://notion.so/workspace', title: 'Notion', favIconUrl: '' },
    ],
    savedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('restoreTabGroupNamesOnStartup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper: run async code that includes the 3s startup delay
  async function runRestore() {
    const promise = restoreTabGroupNamesOnStartup();
    vi.advanceTimersByTime(3000);
    await promise;
  }

  // ── No-op paths ───────────────────────────────────────────────────────────

  it('does nothing when there are no live tab groups', async () => {
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);
    vi.mocked(chrome.tabs.query).mockResolvedValue([]);
    mockGetAll.mockResolvedValue([makeTemplate()]);

    await runRestore();
    expect(chrome.tabGroups.update).not.toHaveBeenCalled();
  });

  it('does nothing when there are no saved templates', async () => {
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([
      { id: 1, title: '', color: 'blue', collapsed: false, windowId: 1 } as chrome.tabGroups.TabGroup,
    ]);
    vi.mocked(chrome.tabs.query).mockResolvedValue([]);
    mockGetAll.mockResolvedValue([]);

    await runRestore();
    expect(chrome.tabGroups.update).not.toHaveBeenCalled();
  });

  it('does nothing when all groups already have names', async () => {
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([
      { id: 1, title: 'Work', color: 'blue', collapsed: false, windowId: 1 } as chrome.tabGroups.TabGroup,
    ]);
    vi.mocked(chrome.tabs.query).mockResolvedValue([]);
    mockGetAll.mockResolvedValue([makeTemplate()]);

    await runRestore();
    expect(chrome.tabGroups.update).not.toHaveBeenCalled();
  });

  // ── Matching and restoring ────────────────────────────────────────────────

  it('restores name and color to unnamed group with matching URLs', async () => {
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([
      { id: 42, title: '', color: 'grey', collapsed: false, windowId: 1 } as chrome.tabGroups.TabGroup,
    ]);
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 101, groupId: 42, url: 'https://github.com/foo', title: 'GitHub' } as chrome.tabs.Tab,
      { id: 102, groupId: 42, url: 'https://notion.so/workspace', title: 'Notion' } as chrome.tabs.Tab,
    ]);
    vi.mocked(chrome.tabGroups.update).mockResolvedValue({} as chrome.tabGroups.TabGroup);
    mockGetAll.mockResolvedValue([makeTemplate()]);

    await runRestore();

    expect(chrome.tabGroups.update).toHaveBeenCalledWith(42, { title: 'Work', color: 'blue' });
  });

  it('does NOT match when URL overlap is below 40% threshold', async () => {
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([
      { id: 42, title: '', color: 'grey', collapsed: false, windowId: 1 } as chrome.tabGroups.TabGroup,
    ]);
    // Only 1 out of 5 URLs match → 20% Jaccard → below threshold
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 101, groupId: 42, url: 'https://github.com/foo', title: 'GitHub' } as chrome.tabs.Tab,
      { id: 102, groupId: 42, url: 'https://twitter.com', title: 'Twitter' } as chrome.tabs.Tab,
      { id: 103, groupId: 42, url: 'https://reddit.com', title: 'Reddit' } as chrome.tabs.Tab,
      { id: 104, groupId: 42, url: 'https://youtube.com', title: 'YouTube' } as chrome.tabs.Tab,
    ]);
    mockGetAll.mockResolvedValue([makeTemplate()]); // template has 2 URLs: github + notion

    await runRestore();

    // 1 intersection / 5 union = 0.2 < 0.4 threshold — no update
    expect(chrome.tabGroups.update).not.toHaveBeenCalled();
  });

  it('skips templates with empty or Unnamed title', async () => {
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([
      { id: 1, title: '', color: 'grey', collapsed: false, windowId: 1 } as chrome.tabGroups.TabGroup,
    ]);
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 101, groupId: 1, url: 'https://github.com/foo', title: 'G' } as chrome.tabs.Tab,
      { id: 102, groupId: 1, url: 'https://notion.so/workspace', title: 'N' } as chrome.tabs.Tab,
    ]);
    mockGetAll.mockResolvedValue([
      makeTemplate({ title: 'Unnamed' }),
      makeTemplate({ title: '', key: 'empty-blue' }),
    ]);

    await runRestore();
    expect(chrome.tabGroups.update).not.toHaveBeenCalled();
  });

  it('greedy matching — each template assigned to at most one group', async () => {
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([
      { id: 1, title: '', color: 'grey', collapsed: false, windowId: 1 } as chrome.tabGroups.TabGroup,
      { id: 2, title: '', color: 'grey', collapsed: false, windowId: 1 } as chrome.tabGroups.TabGroup,
    ]);
    // Both groups have the same URLs → same template should only be applied to one
    const tabs = [
      { id: 1, groupId: 1, url: 'https://github.com/foo' } as chrome.tabs.Tab,
      { id: 2, groupId: 1, url: 'https://notion.so/workspace' } as chrome.tabs.Tab,
      { id: 3, groupId: 2, url: 'https://github.com/foo' } as chrome.tabs.Tab,
      { id: 4, groupId: 2, url: 'https://notion.so/workspace' } as chrome.tabs.Tab,
    ];
    vi.mocked(chrome.tabs.query).mockResolvedValue(tabs);
    vi.mocked(chrome.tabGroups.update).mockResolvedValue({} as chrome.tabGroups.TabGroup);
    mockGetAll.mockResolvedValue([makeTemplate()]);

    await runRestore();
    // Template 'Work' can only be used once
    expect(chrome.tabGroups.update).toHaveBeenCalledOnce();
  });

  // ── Startup delay ─────────────────────────────────────────────────────────

  it('waits 3 seconds before querying tab groups', async () => {
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);
    vi.mocked(chrome.tabs.query).mockResolvedValue([]);
    mockGetAll.mockResolvedValue([]);

    const promise = restoreTabGroupNamesOnStartup();

    // Before advancing time — chrome.tabGroups.query should not be called yet
    expect(chrome.tabGroups.query).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3000);
    await promise;

    expect(chrome.tabGroups.query).toHaveBeenCalled();
  });
});
