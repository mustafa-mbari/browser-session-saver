/**
 * dashboard-sync.ts — Cloud backup/restore for the newtab dashboard config.
 *
 * The dashboard layout JSON lives under `dashboard_configs` on Supabase and
 * is push/pulled via the `sync_dashboard_config` RPC (which also enforces the
 * `dashboard_syncs_limit` quota server-side). This is orthogonal to the
 * entity-sync engine — layout is a single blob, not a per-record stream.
 */

import { supabase } from '@core/supabase/client';
import type { DashboardSyncResult } from '@core/services/sync/types';

export async function syncDashboard(
  config: string,
  userId: string,
): Promise<DashboardSyncResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(config);
  } catch {
    return {
      success: false,
      syncsUsedThisMonth: 0,
      syncsLimit: 0,
      error: 'Invalid dashboard JSON',
    };
  }

  const { data, error } = await supabase.rpc('sync_dashboard_config', {
    p_user_id: userId,
    p_config: parsed,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    return {
      success: false,
      syncsUsedThisMonth: 0,
      syncsLimit: 0,
      error: error?.message ?? 'Dashboard sync failed',
    };
  }

  return {
    success: row.success as boolean,
    syncsUsedThisMonth: row.syncs_used as number,
    syncsLimit: row.syncs_limit as number,
    error: row.error ?? undefined,
  };
}

export async function pullDashboard(userId: string): Promise<DashboardSyncResult> {
  const { data, error } = await supabase
    .from('dashboard_configs')
    .select('config')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return {
      success: false,
      syncsUsedThisMonth: 0,
      syncsLimit: 0,
      error: error?.code === 'PGRST116'
        ? 'No dashboard backup found in the cloud.'
        : (error?.message ?? 'Failed to fetch dashboard'),
    };
  }

  return {
    success: true,
    syncsUsedThisMonth: 0,
    syncsLimit: 0,
    config: JSON.stringify(data.config),
  };
}
