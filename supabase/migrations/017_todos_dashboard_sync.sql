-- ============================================================
-- 017: Todo Sync + Dashboard Config Sync
-- - Adds todos_synced_limit and dashboard_syncs_limit to plans.
-- - Creates todo_lists, todo_items, dashboard_configs,
--   dashboard_sync_log tables with RLS.
-- - Updates get_user_quota() to expose new limit columns.
-- - Updates get_user_usage() to expose synced_todos and
--   dashboard_syncs_this_month.
-- - Creates sync_dashboard_config() RPC (atomic push + limit check).
-- ============================================================

-- ─── Plan quota columns ──────────────────────────────────────────────────────

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS todos_synced_limit INTEGER;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS dashboard_syncs_limit INTEGER;

UPDATE public.plans SET todos_synced_limit = 0,   dashboard_syncs_limit = 0  WHERE id = 'free';
UPDATE public.plans SET todos_synced_limit = 100,  dashboard_syncs_limit = 5  WHERE id = 'pro';
UPDATE public.plans SET todos_synced_limit = 300,  dashboard_syncs_limit = 20 WHERE id = 'max';

-- ─── Todo tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.todo_lists (
  id          TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT '',
  icon        TEXT,
  position    INTEGER     NOT NULL DEFAULT 0,
  created_at  TEXT        NOT NULL DEFAULT '',
  PRIMARY KEY (id, user_id)
);

ALTER TABLE public.todo_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own todo lists"
  ON public.todo_lists
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.todo_items (
  id           TEXT        NOT NULL,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id      TEXT        NOT NULL,
  text         TEXT        NOT NULL DEFAULT '',
  completed    BOOLEAN     NOT NULL DEFAULT FALSE,
  priority     TEXT        NOT NULL DEFAULT 'none',
  due_date     TEXT,
  position     INTEGER     NOT NULL DEFAULT 0,
  created_at   TEXT        NOT NULL DEFAULT '',
  completed_at TEXT,
  PRIMARY KEY (id, user_id)
);

ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own todo items"
  ON public.todo_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Dashboard snapshot tables ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dashboard_configs (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  config     JSONB       NOT NULL,
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dashboard config"
  ON public.dashboard_configs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.dashboard_sync_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.dashboard_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own dashboard sync log"
  ON public.dashboard_sync_log
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── get_user_quota() — add todos_synced_limit, dashboard_syncs_limit ────────

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
  tab_groups_synced_limit  INTEGER,
  todos_synced_limit       INTEGER,
  dashboard_syncs_limit    INTEGER
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
    p.tab_groups_synced_limit,
    p.todos_synced_limit,
    p.dashboard_syncs_limit
  FROM public.user_plans up
  JOIN public.plans p ON p.id = up.plan_id
  WHERE up.user_id = p_user_id
    AND up.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_quota(UUID) TO authenticated;

-- ─── get_user_usage() — add synced_todos, dashboard_syncs_this_month ─────────

DROP FUNCTION IF EXISTS public.get_user_usage(UUID);

CREATE FUNCTION public.get_user_usage(p_user_id UUID)
RETURNS TABLE (
  synced_sessions              BIGINT,
  synced_prompts               BIGINT,
  synced_folders               BIGINT,
  synced_subs                  BIGINT,
  synced_bm_folders            BIGINT,
  synced_tabs                  BIGINT,
  synced_tab_groups            BIGINT,
  synced_todos                 BIGINT,
  dashboard_syncs_this_month   BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.sessions               WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.prompts                WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.prompt_folders         WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.tracked_subscriptions  WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.bookmark_folders       WHERE user_id = p_user_id),
    (
      SELECT COUNT(*) FROM (
        SELECT t->>'url' AS url
          FROM public.sessions, jsonb_array_elements(tabs) t
         WHERE user_id = p_user_id
           AND t->>'url' NOT LIKE 'file://%'
           AND t->>'url' !~ '^https?://localhost[:/]'
           AND t->>'url' !~ '^https?://127\.0\.0\.1[:/]'
        UNION
        SELECT t->>'url' AS url
          FROM public.tab_group_templates, jsonb_array_elements(tabs) t
         WHERE user_id = p_user_id
           AND t->>'url' NOT LIKE 'file://%'
           AND t->>'url' !~ '^https?://localhost[:/]'
           AND t->>'url' !~ '^https?://127\.0\.0\.1[:/]'
        UNION
        SELECT url
          FROM public.bookmark_entries
         WHERE user_id = p_user_id
           AND url NOT LIKE 'file://%'
           AND url !~ '^https?://localhost[:/]'
           AND url !~ '^https?://127\.0\.0\.1[:/]'
      ) unique_urls
    ),
    (SELECT COUNT(*) FROM public.tab_group_templates    WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM public.todo_items             WHERE user_id = p_user_id),
    (
      SELECT COUNT(*)
        FROM public.dashboard_sync_log
       WHERE user_id   = p_user_id
         AND date_trunc('month', synced_at) = date_trunc('month', NOW())
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_usage(UUID) TO authenticated;

-- ─── sync_dashboard_config() — atomic push with monthly limit check ───────────

CREATE OR REPLACE FUNCTION public.sync_dashboard_config(
  p_user_id UUID,
  p_config  JSONB
)
RETURNS TABLE (
  success    BOOLEAN,
  syncs_used INTEGER,
  syncs_limit INTEGER,
  error      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit      INTEGER;
  v_used       INTEGER;
BEGIN
  -- Fetch the user's dashboard_syncs_limit from their active plan
  SELECT p.dashboard_syncs_limit
    INTO v_limit
    FROM public.user_plans up
    JOIN public.plans p ON p.id = up.plan_id
   WHERE up.user_id = p_user_id
     AND up.status  = 'active'
   LIMIT 1;

  -- Default to 0 if no active plan found
  IF v_limit IS NULL THEN
    v_limit := 0;
  END IF;

  -- Count syncs already used this calendar month
  SELECT COUNT(*)::INTEGER
    INTO v_used
    FROM public.dashboard_sync_log
   WHERE user_id   = p_user_id
     AND date_trunc('month', synced_at) = date_trunc('month', NOW());

  -- Enforce monthly limit (0 = feature disabled)
  IF v_limit = 0 OR v_used >= v_limit THEN
    RETURN QUERY SELECT
      FALSE,
      v_used,
      v_limit,
      CASE
        WHEN v_limit = 0 THEN 'Dashboard sync is not available on your current plan. Upgrade to Pro or Max.'
        ELSE 'Monthly dashboard sync limit reached (' || v_limit || '/month). Resets on the 1st.'
      END;
    RETURN;
  END IF;

  -- Upsert the dashboard config
  INSERT INTO public.dashboard_configs (user_id, config, synced_at)
    VALUES (p_user_id, p_config, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET config    = EXCLUDED.config,
          synced_at = EXCLUDED.synced_at;

  -- Log this sync for monthly counting
  INSERT INTO public.dashboard_sync_log (user_id) VALUES (p_user_id);

  RETURN QUERY SELECT TRUE, v_used + 1, v_limit, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_dashboard_config(UUID, JSONB) TO authenticated;
