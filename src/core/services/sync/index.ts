// Sync layer barrel export

// ─── Orchestrator (public API) ──────────────────────────────────────────────

export {
  getSyncStatus,
  syncAll,
  pushSession,
  deleteRemoteSession,
  syncDashboard,
  pullDashboard,
  pullAll,
  getUserQuota,
} from './sync-orchestrator';

// ─── Infrastructure ─────────────────────────────────────────────────────────

export { SyncAdapter } from './sync-adapter';
export type { SyncRowMapper } from './sync-adapter';
export { enforceQuota } from './quota';
export type { QuotaConfig } from './quota';
export { isExcludedUrl, collectAllSyncableUrls } from './url-filter';

// ─── Types ──────────────────────────────────────────────────────────────────

export type {
  UserQuota,
  SyncUsage,
  SyncStatus,
  SyncResult,
  PullResult,
  DashboardSyncResult,
  SyncAdapterConfig,
} from './types';

// ─── Row mappers ────────────────────────────────────────────────────────────

export {
  sessionMapper,
  promptMapper,
  promptFolderMapper,
  subscriptionMapper,
  tabGroupTemplateMapper,
  tabGroupTemplateRawMapper,
  bookmarkCategoryMapper,
  bookmarkCategoryFromRowWithContext,
  bookmarkEntryMapper,
  bookmarkEntryFromRowWithContext,
  todoListMapper,
  todoItemMapper,
} from './row-mappers';
