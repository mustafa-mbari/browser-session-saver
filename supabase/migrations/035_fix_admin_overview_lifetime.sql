-- Migration 035: Fix get_admin_overview() — rename max_users → lifetime_users,
-- count plan_id = 'lifetime' (renamed from 'max' in migration 030).

DROP FUNCTION IF EXISTS public.get_admin_overview();

CREATE FUNCTION public.get_admin_overview()
RETURNS TABLE (
  total_users      BIGINT,
  free_users       BIGINT,
  pro_users        BIGINT,
  lifetime_users   BIGINT,
  total_sessions   BIGINT,
  total_prompts    BIGINT,
  total_tab_groups BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM profiles),
    (SELECT COUNT(*) FROM user_plans WHERE plan_id = 'free'     AND status = 'active'),
    (SELECT COUNT(*) FROM user_plans WHERE plan_id = 'pro'      AND status = 'active'),
    (SELECT COUNT(*) FROM user_plans WHERE plan_id = 'lifetime' AND status = 'active'),
    (SELECT COUNT(*) FROM sessions),
    (SELECT COUNT(*) FROM prompts),
    (SELECT COUNT(*) FROM tab_group_templates);
$$;
