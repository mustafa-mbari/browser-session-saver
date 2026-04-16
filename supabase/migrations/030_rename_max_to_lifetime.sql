-- Migration 030: Rename 'max' plan to 'lifetime'
-- The 'max' plan ID is renamed to 'lifetime' to better reflect that it is a
-- one-time purchase rather than a subscription tier.

-- ── Add new 'lifetime' row ────────────────────────────────────────────────────
-- Copy the 'max' plan row under the new ID, using the actual column names from migration 002.
INSERT INTO plans (
  id, name,
  price_monthly, price_yearly, stripe_price_monthly, stripe_price_yearly,
  sync_enabled,
  sessions_synced_limit, tabs_per_session_limit,
  folders_synced_limit, entries_per_folder_limit,
  prompts_access_limit, prompts_create_limit,
  notes_limit, todos_limit,
  subs_synced_limit, subs_initial_grant, subs_monthly_add,
  sort_order, is_active,
  daily_action_limit, monthly_action_limit
)
SELECT
  'lifetime', name,
  price_monthly, price_yearly, stripe_price_monthly, stripe_price_yearly,
  sync_enabled,
  sessions_synced_limit, tabs_per_session_limit,
  folders_synced_limit, entries_per_folder_limit,
  prompts_access_limit, prompts_create_limit,
  notes_limit, todos_limit,
  subs_synced_limit, subs_initial_grant, subs_monthly_add,
  sort_order, is_active,
  daily_action_limit, monthly_action_limit
FROM plans
WHERE id = 'max'
ON CONFLICT (id) DO NOTHING;

-- ── Migrate user_plans references ────────────────────────────────────────────
UPDATE user_plans SET plan_id = 'lifetime' WHERE plan_id = 'max';

-- ── Remove old 'max' row ──────────────────────────────────────────────────────
DELETE FROM plans WHERE id = 'max';
