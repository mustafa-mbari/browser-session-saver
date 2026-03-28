-- ============================================================
-- 015: Tab Group Templates Sync Limit
-- - Adds tab_groups_synced_limit to plans (Pro=50, Max=NULL/∞).
-- - Updates get_user_quota() to expose tab_groups_synced_limit.
-- ============================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS tab_groups_synced_limit INTEGER;

UPDATE public.plans SET tab_groups_synced_limit = 0   WHERE id = 'free';
UPDATE public.plans SET tab_groups_synced_limit = 50  WHERE id = 'pro';
UPDATE public.plans SET tab_groups_synced_limit = 150 WHERE id = 'max';

-- Must DROP first because the return-type signature changes.
DROP FUNCTION IF EXISTS public.get_user_quota(UUID);

CREATE FUNCTION public.get_user_quota(p_user_id UUID)
RETURNS TABLE (
  plan_id                  TEXT,
  plan_name                TEXT,
  sync_enabled             BOOLEAN,
  sessions_synced_limit    INTEGER,
  tabs_per_session_limit   INTEGER,
  folders_synced_limit     INTEGER,
  entries_per_folder_limit INTEGER,
  prompts_access_limit     INTEGER,
  prompts_create_limit     INTEGER,
  notes_limit              INTEGER,
  todos_limit              INTEGER,
  subs_synced_limit        INTEGER,
  subs_initial_grant       INTEGER,
  subs_monthly_add         INTEGER,
  total_tabs_limit         INTEGER,
  tab_groups_synced_limit  INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.sync_enabled,
    p.sessions_synced_limit,
    p.tabs_per_session_limit,
    p.folders_synced_limit,
    p.entries_per_folder_limit,
    p.prompts_access_limit,
    p.prompts_create_limit,
    p.notes_limit,
    p.todos_limit,
    p.subs_synced_limit,
    p.subs_initial_grant,
    p.subs_monthly_add,
    p.total_tabs_limit,
    p.tab_groups_synced_limit
  FROM public.user_plans up
  JOIN public.plans p ON p.id = up.plan_id
  WHERE up.user_id = p_user_id
    AND up.status = 'active'
  LIMIT 1;
$$;
