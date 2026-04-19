-- Migration 035: Fix get_admin_overview() — rename max_users → lifetime_users,
-- count plan_id = 'lifetime' (renamed from 'max' in migration 030).

DROP FUNCTION IF EXISTS public.get_admin_overview();

-- sessions, prompts, tab_group_templates were dropped in migration 031 (sync removal).
-- Only user counts remain.
CREATE FUNCTION public.get_admin_overview()
RETURNS TABLE (
  total_users    BIGINT,
  free_users     BIGINT,
  pro_users      BIGINT,
  lifetime_users BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM profiles),
    (SELECT COUNT(*) FROM user_plans WHERE plan_id = 'free'     AND status = 'active'),
    (SELECT COUNT(*) FROM user_plans WHERE plan_id = 'pro'      AND status = 'active'),
    (SELECT COUNT(*) FROM user_plans WHERE plan_id = 'lifetime' AND status = 'active');
$$;
