-- ============================================================
-- 016: get_user_usage() — add synced_tab_groups
-- DROPs and recreates the function (return-type change).
-- ============================================================

DROP FUNCTION IF EXISTS public.get_user_usage(UUID);

CREATE FUNCTION public.get_user_usage(p_user_id UUID)
RETURNS TABLE (
  synced_sessions   BIGINT,
  synced_prompts    BIGINT,
  synced_folders    BIGINT,
  synced_subs       BIGINT,
  synced_bm_folders BIGINT,
  synced_tabs       BIGINT,
  synced_tab_groups BIGINT
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
    (SELECT COUNT(*) FROM public.tab_group_templates    WHERE user_id = p_user_id);
$$;
