/**
 * sync/url-filter.ts — URL filtering and deduplication utilities.
 *
 * Extracted from sync.service.ts to be reusable by individual
 * SyncAdapter instances and the orchestrator.
 */

import type { Session } from '@core/types/session.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';
import type { BookmarkEntry } from '@core/types/newtab.types';

/**
 * Returns true if the URL should NOT be synced to the cloud.
 * Excludes file:// URLs, localhost, and loopback addresses.
 */
export function isExcludedUrl(url: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('file://') ||
    /^https?:\/\/localhost[:/]/i.test(url) ||
    /^https?:\/\/127\.0\.0\.1[:/]/i.test(url)
  );
}

/**
 * Collects all unique, non-excluded URLs across sessions, tab group templates,
 * and bookmark entries. Used to enforce the global total_tabs_limit.
 */
export function collectAllSyncableUrls(
  sessions: Session[],
  tabGroups: TabGroupTemplate[],
  bmEntries: BookmarkEntry[],
): Set<string> {
  const urls = new Set<string>();
  for (const s of sessions) for (const t of s.tabs) if (!isExcludedUrl(t.url)) urls.add(t.url);
  for (const g of tabGroups) for (const t of g.tabs) if (!isExcludedUrl(t.url)) urls.add(t.url);
  for (const e of bmEntries) if (!isExcludedUrl(e.url)) urls.add(e.url);
  return urls;
}
