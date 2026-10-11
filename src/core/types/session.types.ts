export type ChromeGroupColor =
  | 'grey'
  | 'blue'
  | 'red'
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'cyan'
  | 'orange';

export type AutoSaveTrigger =
  | 'timer'
  | 'shutdown'
  | 'sleep'
  | 'battery'
  | 'network'
  | 'window_close'
  | 'manual';

export interface ScrollPosition {
  x: number;
  y: number;
}

export interface Tab {
  id: string;
  url: string;
  title: string;
  favIconUrl: string;
  index: number;
  pinned: boolean;
  groupId: number;
  active: boolean;
  scrollPosition: ScrollPosition;
}

export interface TabGroup {
  id: number;
  title: string;
  color: ChromeGroupColor;
  collapsed: boolean;
  tabIds: string[];
}

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tabs: Tab[];
  tabGroups: TabGroup[];
  windowId: number;
  tags: string[];
  isPinned: boolean;
  isStarred: boolean;
  isLocked: boolean;
  isAutoSave: boolean;
  autoSaveTrigger: AutoSaveTrigger;
  notes: string;
  tabCount: number;
  version: string;
  /** Auto-saves only: the browser (BrowserInstance.id) that keeps this entry up to date. */
  sourceInstanceId?: string;
  /** Auto-saves only: that browser's label, e.g. "Edge". */
  sourceLabel?: string;
  deletedAt?: string | null;
  dirty?: boolean;
  lastSyncedAt?: string | null;
}
