/**
 * sync.service.ts — Barrel re-export for the sync layer.
 *
 * Phase 1: the legacy `./sync/sync-orchestrator` has been replaced by the new
 * SyncEngine under `@core/sync/`. This barrel preserves the existing import
 * path for every external caller.
 *
 *   - `syncAll`, `pullAll`, `getSyncStatus`, `getUserQuota`, `pushSession`,
 *     `deleteRemoteSession` → routed through the new engine via the public-api
 *     facade.
 *   - `syncDashboard` / `pullDashboard` → still live on the Supabase RPC path,
 *     extracted to a dedicated module since they are layout-blob traffic and
 *     not entity sync.
 *   - Types are re-exported unchanged.
 */

export {
  getSyncStatus,
  syncAll,
  pushSession,
  deleteRemoteSession,
  pullAll,
  getUserQuota,
} from '@core/sync/public-api';

export {
  syncDashboard,
  pullDashboard,
} from '@core/sync/dashboard-sync';

export type {
  UserQuota,
  SyncUsage,
  SyncStatus,
  SyncResult,
  PullResult,
  DashboardSyncResult,
} from './sync/types';
