import { describe, it, expect } from 'vitest';
import { isExcludedUrl, collectAllSyncableUrls } from '@core/services/sync/url-filter';
import type { Session } from '@core/types/session.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';
import type { BookmarkEntry } from '@core/types/newtab.types';

describe('isExcludedUrl', () => {
  it('excludes empty string', () => {
    expect(isExcludedUrl('')).toBe(true);
  });

  it('excludes file:// URLs', () => {
    expect(isExcludedUrl('file:///home/user/doc.html')).toBe(true);
  });

  it('excludes localhost URLs', () => {
    expect(isExcludedUrl('http://localhost:3000/app')).toBe(true);
    expect(isExcludedUrl('https://localhost/api')).toBe(true);
  });

  it('excludes loopback URLs', () => {
    expect(isExcludedUrl('http://127.0.0.1:8080/')).toBe(true);
    expect(isExcludedUrl('https://127.0.0.1/api')).toBe(true);
  });

  it('allows normal URLs', () => {
    expect(isExcludedUrl('https://example.com')).toBe(false);
    expect(isExcludedUrl('https://google.com/search')).toBe(false);
  });

  it('allows chrome extension URLs', () => {
    expect(isExcludedUrl('chrome-extension://abc123/popup.html')).toBe(false);
  });
});

describe('collectAllSyncableUrls', () => {
  const makeSession = (urls: string[]): Session => ({
    id: 'sess-1',
    name: 'Test',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    tabs: urls.map((url, i) => ({
      id: `tab-${i}`,
      url,
      title: '',
      favIconUrl: '',
      index: i,
      pinned: false,
      groupId: -1,
      active: false,
      scrollPosition: { x: 0, y: 0 },
    })),
    tabGroups: [],
    windowId: 1,
    tags: [],
    isPinned: false,
    isStarred: false,
    isLocked: false,
    isAutoSave: false,
    autoSaveTrigger: 'manual',
    notes: '',
    tabCount: urls.length,
    version: '1',
  });

  const makeTabGroup = (urls: string[]): TabGroupTemplate => ({
    key: 'group-1',
    title: 'Test Group',
    color: 'blue',
    tabs: urls.map((url) => ({ url, title: '', favIconUrl: '' })),
    savedAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  });

  const makeBookmarkEntry = (url: string): BookmarkEntry => ({
    id: `bm-${url}`,
    categoryId: 'cat-1',
    title: '',
    url,
    favIconUrl: '',
    addedAt: '2024-01-01T00:00:00Z',
    isNative: false,
  });

  it('collects unique URLs from all sources', () => {
    const sessions = [makeSession(['https://a.com', 'https://b.com'])];
    const tabGroups = [makeTabGroup(['https://b.com', 'https://c.com'])];
    const entries = [makeBookmarkEntry('https://c.com'), makeBookmarkEntry('https://d.com')];

    const urls = collectAllSyncableUrls(sessions, tabGroups, entries);
    expect(urls.size).toBe(4);
    expect(urls.has('https://a.com')).toBe(true);
    expect(urls.has('https://d.com')).toBe(true);
  });

  it('excludes localhost and file URLs', () => {
    const sessions = [makeSession(['https://a.com', 'http://localhost:3000'])];
    const tabGroups = [makeTabGroup(['file:///home/test.html'])];
    const entries = [makeBookmarkEntry('http://127.0.0.1:8080')];

    const urls = collectAllSyncableUrls(sessions, tabGroups, entries);
    expect(urls.size).toBe(1);
    expect(urls.has('https://a.com')).toBe(true);
  });

  it('deduplicates URLs across sources', () => {
    const url = 'https://shared.com';
    const sessions = [makeSession([url])];
    const tabGroups = [makeTabGroup([url])];
    const entries = [makeBookmarkEntry(url)];

    const urls = collectAllSyncableUrls(sessions, tabGroups, entries);
    expect(urls.size).toBe(1);
  });

  it('returns empty set for empty inputs', () => {
    const urls = collectAllSyncableUrls([], [], []);
    expect(urls.size).toBe(0);
  });
});
