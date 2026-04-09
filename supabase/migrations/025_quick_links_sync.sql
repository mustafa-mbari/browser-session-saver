-- ============================================================
-- 025: Quick Links Cloud Sync
-- - Adds quick_links_synced_limit to plans
--   (free = 0, pro/max = NULL = unlimited).
-- - Creates quick_links table with RLS.
-- - Updates get_user_quota() to expose quick_links_synced_limit.
-- - Updates get_user_usage() to expose synced_quick_links.
-- ============================================================

-- ─── Plan quota column ───────────────────────────────────────────────────────

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS quick_links_synced_limit INTEGER;

UPDATE public.plans SET quick_links_synced_limit = 0    WHERE id = 'free';
UPDATE public.plans SET quick_links_synced_limit = NULL WHERE id = 'pro';
UPDATE public.plans SET quick_links_synced_limit = NULL WHERE id = 'max';

-- ─── quick_links table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quick_links (
  id                TEXT     NOT NULL,
  user_id           UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT     NOT NULL DEFAULT '',
  url               TEXT     NOT NULL DEFAULT '',
  fav_icon_url      TEXT     NOT NULL DEFAULT '',
  position          INTEGER  NOT NULL DEFAULT 0,
  is_auto_generated BOOLEAN  NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id, user_id)
);

ALTER TABLE public.quick_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own quick links" ON public.quick_links;
CREATE POLICY "Users manage own quick links"
  ON public.quick_links
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS quick_links_user_id_idx ON public.quick_links (user_id);

-- ─── get_user_quota() — add quick_links_synced_limit ─────────────────────────

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
  dashboard_syncs_limit    INTEGER,
  quick_links_synced_limit INTEGER
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
    p.dashboard_syncs_limit,
    p.quick_links_synced_limit
  FROM public.user_plans up
  JOIN public.plans p ON p.id = up.plan_id
  WHERE up.user_id = p_user_id
    AND up.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_quota(UUID) TO authenticated;

-- ─── get_user_usage() — add synced_quick_links ───────────────────────────────

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
  dashboard_syncs_this_month   BIGINT,
  synced_quick_links           BIGINT
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
    ),
    (SELECT COUNT(*) FROM public.quick_links            WHERE user_id = p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_user_usage(UUID) TO authenticated;
