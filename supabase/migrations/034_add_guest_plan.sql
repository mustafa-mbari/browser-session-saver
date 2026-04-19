-- Migration 034: Add 'guest' plan row for unauthenticated users
-- Allows admin to view and edit guest action limits from the Quotas page.
-- The extension currently reads guest limits from its local PLAN_LIMITS constant;
-- a future extension update can call get_guest_limits() to use these DB values instead.

INSERT INTO plans (
  id, name,
  price_monthly, price_yearly,
  sync_enabled,
  sessions_synced_limit, tabs_per_session_limit,
  folders_synced_limit, entries_per_folder_limit,
  prompts_access_limit, prompts_create_limit,
  notes_limit, todos_limit,
  subs_synced_limit, subs_initial_grant, subs_monthly_add,
  daily_action_limit, monthly_action_limit,
  sort_order, is_active
) VALUES (
  'guest', 'Guest (no account)',
  0, 0,
  FALSE,
  0, 10,
  0, 0,
  0, 0,
  0, 0,
  0, 0, 0,
  3, 20,   -- matches PLAN_LIMITS.guest in limits.types.ts
  -1, TRUE
)
ON CONFLICT (id) DO NOTHING;
