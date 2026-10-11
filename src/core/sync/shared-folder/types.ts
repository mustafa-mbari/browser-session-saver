import type { Session } from '@core/types/session.types';
import type { Settings } from '@core/types/settings.types';
import type { Prompt, PromptFolder, PromptCategory, PromptTag } from '@core/types/prompt.types';
import type { Subscription, CustomCategory } from '@core/types/subscription.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';
import type {
  Board,
  BookmarkCategory,
  BookmarkEntry,
  NewTabSettings,
  QuickLink,
  TodoItem,
  TodoList,
} from '@core/types/newtab.types';

export const SHARED_FILE_FORMAT = 'browser-hub-shared';
export const SHARED_FILE_SCHEMA = 1;

/** A list stored as a whole (its items have no timestamps): the newest version wins. */
export interface SharedList<T> {
  updatedAt: string;
  items: T[];
}

/** Settings merged per field: each field carries the time it last changed. */
export interface SharedSettings<T> {
  values: Partial<T>;
  fieldUpdatedAt: Record<string, string>;
}

/** Everything one browser shares. Modules the browser does not share are absent. */
export interface SharedData {
  sessions?: Session[];
  prompts?: Prompt[];
  promptFolders?: PromptFolder[];
  promptCategories?: SharedList<PromptCategory>;
  promptTags?: SharedList<PromptTag>;
  subscriptions?: Subscription[];
  subscriptionCategories?: SharedList<CustomCategory>;
  tabGroupTemplates?: TabGroupTemplate[];
  boards?: Board[];
  bookmarkCategories?: BookmarkCategory[];
  bookmarkEntries?: BookmarkEntry[];
  quickLinks?: QuickLink[];
  todoLists?: TodoList[];
  todoItems?: TodoItem[];
  settings?: SharedSettings<Settings>;
  newtabSettings?: SharedSettings<NewTabSettings>;
}

/** The file one browser writes into the shared folder. */
export interface SharedFile {
  format: typeof SHARED_FILE_FORMAT;
  schema: number;
  instance: { id: string; label: string };
  writtenAt: string;
  data: SharedData;
}

/** Record modules (merged record by record). */
export const RECORD_KEYS = [
  'sessions',
  'prompts',
  'promptFolders',
  'subscriptions',
  'tabGroupTemplates',
  'boards',
  'bookmarkCategories',
  'bookmarkEntries',
  'quickLinks',
  'todoLists',
  'todoItems',
] as const;
export type RecordKey = (typeof RECORD_KEYS)[number];

export const LIST_KEYS = ['promptCategories', 'promptTags', 'subscriptionCategories'] as const;
export type ListKey = (typeof LIST_KEYS)[number];

export const SETTINGS_KEYS = ['settings', 'newtabSettings'] as const;
export type SettingsKey = (typeof SETTINGS_KEYS)[number];

/** Start-tab settings that stay per browser even when settings are shared. */
export const PER_BROWSER_NEWTAB_FIELDS: readonly (keyof NewTabSettings)[] = [
  'enabled',
  'activeBoardId',
  'sidebarCollapsed',
  'zenMode',
  // The whole background: uploaded wallpapers exist only in the browser that
  // stored them, so a shared "image" background would be blank elsewhere.
  'backgroundType',
  'backgroundColor',
  'backgroundGradientStops',
  'backgroundGradientAngle',
  'backgroundImageId',
  'backgroundBundledPath',
  'backgroundBlur',
  'backgroundDimming',
  'backgroundSaturation',
  'backgroundBrightness',
  'backgroundVignette',
  'dailyRotation',
];
