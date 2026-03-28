-- ============================================================
-- 014: Usage & Overview — Tab Counts
-- - get_user_usage(): adds synced_tabs (unique non-excluded URLs
--   across sessions + tab_group_templates + bookmark_entries).
-- - get_admin_overview(): adds total_tab_groups.
-- Both functions are DROPped first because their return-type
-- signatures changed.
-- ============================================================

-- ----------------------------------------------------------------
-- get_user_usage(): add synced_tabs
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_usage(UUID);

CREATE FUNCTION public.get_user_usage(p_user_id UUID)
RETURNS TABLE (
  synced_sessions   BIGINT,
  synced_prompts    BIGINT,
  synced_folders    BIGINT,
  synced_subs       BIGINT,
  synced_bm_folders BIGINT,
  synced_tabs       BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)  FROM public.sessions               WHERE user_id = p_user_id),
    (SELECT COUNT(*)  FROM public.prompts                WHERE user_id = p_user_id),
    (SELECT COUNT(*)  FROM public.prompt_folders         WHERE user_id = p_user_id),
    (SELECT COUNT(*)  FROM public.tracked_subscriptions  WHERE user_id = p_user_id),
    (SELECT COUNT(*)  FROM public.bookmark_folders       WHERE user_id = p_user_id),
    -- Unique non-excluded URLs across sessions + tab group templates + bookmark entries.
    -- UNION deduplicates, so COUNT(*) gives the correct distinct total.
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
    );
$$;

-- ----------------------------------------------------------------
-- get_admin_overview(): add total_tab_groups
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_admin_overview();

CREATE FUNCTION public.get_admin_overview()
RETURNS TABLE (
  total_users    BIGINT,
  free_users     BIGINT,
  pro_users      BIGINT,
  max_users      BIGINT,
  total_sessions BIGINT,
  total_prompts  BIGINT,
  total_tab_groups BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.profiles),
    (SELECT COUNT(*) FROM public.user_plans WHERE plan_id = 'free' AND status = 'active'),
    (SELECT COUNT(*) FROM public.user_plans WHERE plan_id = 'pro'  AND status = 'active'),
    (SELECT COUNT(*) FROM public.user_plans WHERE plan_id = 'max'  AND status = 'active'),
    (SELECT COUNT(*) FROM public.sessions),
    (SELECT COUNT(*) FROM public.prompts),
    (SELECT COUNT(*) FROM public.tab_group_templates);
$$;
