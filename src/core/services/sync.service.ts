/**
 * sync.service.ts — Barrel re-export for the sync layer.
 *
 * All orchestration logic has been moved to ./sync/sync-orchestrator.ts.
 * All type definitions live in ./sync/types.ts.
 *
 * This file exists solely to preserve the `@core/services/sync.service` import
 * path that all consumers already use.
 */

// ─── Functions ──────────────────────────────────────────────────────────────

export {
  getSyncStatus,
  syncAll,
  pushSession,
  deleteRemoteSession,
  syncDashboard,
  pullDashboard,
  pullAll,
  getUserQuota,
} from './sync/sync-orchestrator';

// ─── Types ──────────────────────────────────────────────────────────────────

export type {
  UserQuota,
  SyncUsage,
  SyncStatus,
  SyncResult,
  PullResult,
  DashboardSyncResult,
} from './sync/types';
