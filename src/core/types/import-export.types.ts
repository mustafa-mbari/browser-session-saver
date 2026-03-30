import type { Session } from './session.types';
import type { Settings } from './settings.types';
import type { Prompt, PromptFolder, PromptCategory, PromptTag } from './prompt.types';
import type { Subscription, CustomCategory } from './subscription.types';
import type { TabGroupTemplate } from './tab-group.types';
import type { DashboardExportEnvelope } from '@core/services/newtab-export.service';

// ── Module keys ────────────────────────────────────────────────────────────────

export type BackupModule =
  | 'sessions'
  | 'settings'
  | 'prompts'
  | 'subscriptions'
  | 'tabGroupTemplates'
  | 'dashboard';

export type ModuleSelection = Record<BackupModule, boolean>;

export const ALL_MODULES_SELECTED: ModuleSelection = {
  sessions: true,
  settings: true,
  prompts: true,
  subscriptions: true,
  tabGroupTemplates: true,
  dashboard: true,
};

export const NO_MODULES_SELECTED: ModuleSelection = {
  sessions: false,
  settings: false,
  prompts: false,
  subscriptions: false,
  tabGroupTemplates: false,
  dashboard: false,
};

// ── Full Backup envelope v2.0.0 ────────────────────────────────────────────────

export const FULL_BACKUP_VERSION = '2.0.0' as const;
export const FULL_BACKUP_SOURCE = 'browser-hub-full-backup' as const;

export interface FullBackupCounts {
  sessions: number;
  prompts: number;
  promptFolders: number;
  promptCategories: number;
  promptTags: number;
  subscriptions: number;
  subscriptionCategories: number;
  tabGroupTemplates: number;
  dashboardBoards: number;
  dashboardCategories: number;
  dashboardEntries: number;
  dashboardQuickLinks: number;
  dashboardTodoLists: number;
  dashboardTodoItems: number;
}

export const EMPTY_COUNTS: FullBackupCounts = {
  sessions: 0,
  prompts: 0,
  promptFolders: 0,
  promptCategories: 0,
  promptTags: 0,
  subscriptions: 0,
  subscriptionCategories: 0,
  tabGroupTemplates: 0,
  dashboardBoards: 0,
  dashboardCategories: 0,
  dashboardEntries: 0,
  dashboardQuickLinks: 0,
  dashboardTodoLists: 0,
  dashboardTodoItems: 0,
};

export interface FullBackupEnvelope {
  version: typeof FULL_BACKUP_VERSION;
  exportedAt: string;
  source: typeof FULL_BACKUP_SOURCE;
  counts: FullBackupCounts;
  // optional sections — only present when that module was selected for export
  sessions?: Session[];
  settings?: Settings;
  prompts?: Prompt[];
  promptFolders?: PromptFolder[];
  promptCategories?: PromptCategory[];
  promptTags?: PromptTag[];
  subscriptions?: Subscription[];
  subscriptionCategories?: CustomCategory[];
  tabGroupTemplates?: TabGroupTemplate[];
  dashboard?: DashboardExportEnvelope;
}

// ── Import mode ────────────────────────────────────────────────────────────────

export type ImportMode = 'merge' | 'replace';

// ── Import preview (synchronous, no storage writes) ───────────────────────────

export interface ImportPreview {
  /** Format detected from the parsed file. */
  fileType: 'full-backup-v2' | 'dashboard-v1' | 'sessions-v1' | 'unknown';
  /** ISO timestamp from the file's exportedAt field, if present. */
  exportedAt?: string;
  /** Which modules are actually present in this file. */
  availableModules: BackupModule[];
  counts: FullBackupCounts;
  warnings: string[];
  errors: string[];
}

// ── Import execution result ────────────────────────────────────────────────────

export interface FullImportResult {
  success: boolean;
  importedCounts: Partial<FullBackupCounts>;
  skippedModules: BackupModule[];
  errors: string[];
}

// ── Supplementary export formats ──────────────────────────────────────────────

export type SupplementaryFormat = 'subscriptions-csv' | 'prompts-markdown' | 'todos-csv';

// ── UI tab state ───────────────────────────────────────────────────────────────

export type ImportExportTab = 'export' | 'import' | 'cloud';
