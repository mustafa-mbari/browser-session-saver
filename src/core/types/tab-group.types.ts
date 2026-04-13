import type { ChromeGroupColor } from './session.types';

export interface TabGroupTemplateTab {
  url: string;
  title: string;
  favIconUrl: string;
}

/**
 * A tab group persisted by the extension.
 * Auto-saved when live groups are detected; stays saved until the user
 * explicitly deletes it from the Tab Groups panel.
 */
export interface TabGroupTemplate {
  /** Deduplication key: `${title}-${color}` */
  key: string;
  title: string;
  color: ChromeGroupColor;
  tabs: TabGroupTemplateTab[];
  savedAt: string;
  updatedAt: string;
  /** True when explicitly saved by the user via the Bookmark button — syncs across devices. */
  pinned?: boolean;
  deletedAt?: string | null;
  dirty?: boolean;
  lastSyncedAt?: string | null;
}
