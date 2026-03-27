-- ============================================================
-- 011: Quota Helper Functions
-- Server-side functions for quota checking and usage counting.
-- Called from API routes and web app server components.
-- ============================================================

-- ----------------------------------------------------------------
-- get_user_quota(user_id)
-- Returns the active plan's quota limits for a user.
-- NULL values in limit columns = unlimited.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_quota(p_user_id UUID)
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
  subs_monthly_add         INTEGER
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
    p.subs_monthly_add
  FROM public.user_plans up
  JOIN public.plans p ON p.id = up.plan_id
  WHERE up.user_id = p_user_id
    AND up.status = 'active'
  LIMIT 1;
$$;

-- ----------------------------------------------------------------
-- get_user_usage(user_id)
-- Returns current synced counts for a user (for dashboard display).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_usage(p_user_id UUID)
RETURNS TABLE (
  synced_sessions   BIGINT,
  synced_prompts    BIGINT,
  synced_folders    BIGINT,
  synced_subs       BIGINT,
  synced_bm_folders BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.sessions           WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.prompts            WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.prompt_folders     WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.tracked_subscriptions WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.bookmark_folders   WHERE user_id = p_user_id);
$$;

-- ----------------------------------------------------------------
-- can_add_tracked_subscription(user_id)
-- Returns TRUE if a Free-plan user is still within their monthly budget.
-- Always returns TRUE for Pro/Max users.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_add_tracked_subscription(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id          TEXT;
  v_initial_grant    INTEGER;
  v_monthly_add      INTEGER;
  v_current_count    INTEGER;
  v_year_month       TEXT;
  v_additions_used   INTEGER;
BEGIN
  -- Get the user's plan
  SELECT up.plan_id, pl.subs_initial_grant, pl.subs_monthly_add
    INTO v_plan_id, v_initial_grant, v_monthly_add
    FROM public.user_plans up
    JOIN public.plans pl ON pl.id = up.plan_id
   WHERE up.user_id = p_user_id AND up.status = 'active'
   LIMIT 1;

  -- Non-free plans: always allowed
  IF v_plan_id != 'free' THEN
    RETURN TRUE;
  END IF;

  -- Count current tracked subs
  SELECT COUNT(*) INTO v_current_count
    FROM public.tracked_subscriptions
   WHERE user_id = p_user_id;

  -- Still within initial grant
  IF v_current_count < v_initial_grant THEN
    RETURN TRUE;
  END IF;

  -- Check monthly addition budget
  v_year_month := TO_CHAR(NOW(), 'YYYY-MM');
  SELECT COALESCE(additions_used, 0) INTO v_additions_used
    FROM public.subscription_monthly_budget
   WHERE user_id = p_user_id AND year_month = v_year_month;

  RETURN (v_additions_used < v_monthly_add);
END;
$$;

-- ----------------------------------------------------------------
-- Admin overview helper
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_overview()
RETURNS TABLE (
  total_users    BIGINT,
  free_users     BIGINT,
  pro_users      BIGINT,
  max_users      BIGINT,
  total_sessions BIGINT,
  total_prompts  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.profiles),
    (SELECT COUNT(*) FROM public.user_plans WHERE plan_id = 'free'  AND status = 'active'),
    (SELECT COUNT(*) FROM public.user_plans WHERE plan_id = 'pro'   AND status = 'active'),
    (SELECT COUNT(*) FROM public.user_plans WHERE plan_id = 'max'   AND status = 'active'),
    (SELECT COUNT(*) FROM public.sessions),
    (SELECT COUNT(*) FROM public.prompts);
$$;
