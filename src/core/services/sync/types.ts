/**
 * sync/types.ts — Shared type definitions for the sync layer.
 *
 * These were previously embedded in sync.service.ts. Extracted here so that
 * sync adapters, the orchestrator, and UI components can import them cleanly.
 */

export interface UserQuota {
  plan_id: string;
  plan_name: string;
  sessions_synced_limit: number | null;
  tabs_per_session_limit: number | null;
  folders_synced_limit: number | null;
  entries_per_folder_limit: number | null;
  prompts_access_limit: number | null;
  prompts_create_limit: number | null;
  subs_synced_limit: number | null;
  total_tabs_limit: number | null;
  tab_groups_synced_limit: number | null;
  todos_synced_limit: number | null;
  dashboard_syncs_limit: number | null;
  quick_links_synced_limit: number | null;
  sync_enabled: boolean;
}

export interface SyncUsage {
  sessions: number;
  prompts: number;
  subs: number;
  tabs: number;
  folders: number;
  tabGroups: number;
  todos: number;
  quickLinks: number;
}

export interface DashboardSyncResult {
  success: boolean;
  syncsUsedThisMonth: number;
  syncsLimit: number;
  config?: string;
  error?: string;
}

export interface SyncStatus {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  lastSyncAt: string | null;
  isSyncing: boolean;
  quota: UserQuota | null;
  usage: SyncUsage | null;
  error: string | null;
}

export interface SyncResult {
  success: boolean;
  synced: SyncUsage;
  error?: string;
}

export interface PullResult {
  success: boolean;
  pulled: {
    sessions: number;
    prompts: number;
    subs: number;
    tabGroups: number;
    folders: number;
    todos: number;
    quickLinks: number;
  };
  error?: string;
}

/** Configuration for the SyncAdapter generic push/pull/reconcile. */
export interface SyncAdapterConfig<T> {
  /** Supabase table name (e.g. 'sessions', 'tracked_subscriptions'). */
  tableName: string;

  /** Column(s) used for upsert conflict resolution (default: 'id'). */
  conflictColumn?: string;

  /**
   * Sort field for quota enforcement.
   * Items are sorted descending by this field; only the top N are synced.
   */
  quotaSortField?: string;

  /**
   * Optional transform applied to each entity before mapping to a row.
   * Useful for filtering excluded URLs, stripping internal fields, etc.
   */
  preSyncTransform?: (entity: T) => T;
}
