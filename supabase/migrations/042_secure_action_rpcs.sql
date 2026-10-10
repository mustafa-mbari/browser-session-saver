-- Migration 042: Secure the action-usage RPCs
--
-- upsert_action_usage() and get_user_plan_tier() run as SECURITY DEFINER and
-- trusted their p_user_id argument, and both kept the default EXECUTE grants.
-- Anyone holding the public anon key could raise another user's usage counters
-- (which the extension pulls in on sign-in and enforces) or read any user's plan
-- tier. Both now act only on the caller's own id; the service role (admin tools,
-- Edge Functions) may still pass any id.
--
-- The usage RPCs also gain an optional p_count so one call can record a
-- multi-item action. Callers that omit it (released extension versions) keep
-- working: p_count defaults to 1.
--
-- Finally, users could UPDATE or DELETE their own user_action_usage row directly
-- (policy FOR ALL). Writes go through the RPC, so the policy becomes read-only.

-- ── upsert_action_usage ──────────────────────────────────────────────────────
-- Drop the 3-argument version first so a call without p_count is not ambiguous.
DROP FUNCTION IF EXISTS upsert_action_usage(UUID, DATE, VARCHAR);

CREATE FUNCTION upsert_action_usage(
  p_user_id       UUID,
  p_daily_date    DATE,
  p_monthly_month VARCHAR(7),
  p_count         INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 1000 THEN
    RAISE EXCEPTION 'invalid count' USING ERRCODE = '22023';
  END IF;

  INSERT INTO user_action_usage (user_id, daily_date, daily_count, monthly_month, monthly_count, updated_at)
  VALUES (p_user_id, p_daily_date, p_count, p_monthly_month, p_count, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    -- Reset daily count if date rolled over, otherwise increment
    daily_date  = p_daily_date,
    daily_count = CASE
      WHEN user_action_usage.daily_date = p_daily_date THEN user_action_usage.daily_count + p_count
      ELSE p_count
    END,
    -- Reset monthly count if month rolled over, otherwise increment
    monthly_month = p_monthly_month,
    monthly_count = CASE
      WHEN user_action_usage.monthly_month = p_monthly_month THEN user_action_usage.monthly_count + p_count
      ELSE p_count
    END,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION upsert_action_usage(UUID, DATE, VARCHAR, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION upsert_action_usage(UUID, DATE, VARCHAR, INTEGER) TO authenticated, service_role;

-- ── get_user_plan_tier ───────────────────────────────────────────────────────
-- Same body as migration 032 (per-user overrides win over plan defaults).
CREATE OR REPLACE FUNCTION get_user_plan_tier(p_user_id UUID)
RETURNS TABLE(tier TEXT, daily_action_limit INT, monthly_action_limit INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(up.plan_id, 'free')                                              AS tier,
    COALESCE(uao.daily_action_limit,   pl.daily_action_limit,   6)            AS daily_action_limit,
    COALESCE(uao.monthly_action_limit, pl.monthly_action_limit, 30)           AS monthly_action_limit
  FROM auth.users u
  LEFT JOIN user_plans           up  ON up.user_id  = u.id AND up.status = 'active'
  LEFT JOIN plans                pl  ON pl.id       = COALESCE(up.plan_id, 'free')
  LEFT JOIN user_action_overrides uao ON uao.user_id = u.id
  WHERE u.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION get_user_plan_tier(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_user_plan_tier(UUID) TO authenticated, service_role;

-- ── upsert_guest_action_usage ────────────────────────────────────────────────
-- Guests have no JWT; the unguessable guest UUID is the only key. Adds p_count.
DROP FUNCTION IF EXISTS upsert_guest_action_usage(UUID, DATE, VARCHAR);

CREATE FUNCTION upsert_guest_action_usage(
  p_guest_id      UUID,
  p_daily_date    DATE,
  p_monthly_month VARCHAR(7),
  p_count         INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_count IS NULL OR p_count < 1 OR p_count > 1000 THEN
    RAISE EXCEPTION 'invalid count' USING ERRCODE = '22023';
  END IF;

  INSERT INTO guest_action_usage (
    guest_id, daily_date, daily_count, monthly_month, monthly_count, updated_at
  )
  VALUES (
    p_guest_id, p_daily_date, p_count, p_monthly_month, p_count, NOW()
  )
  ON CONFLICT (guest_id) DO UPDATE SET
    daily_date  = p_daily_date,
    daily_count = CASE
      WHEN guest_action_usage.daily_date = p_daily_date
        THEN guest_action_usage.daily_count + p_count
      ELSE p_count
    END,
    monthly_month  = p_monthly_month,
    monthly_count  = CASE
      WHEN guest_action_usage.monthly_month = p_monthly_month
        THEN guest_action_usage.monthly_count + p_count
      ELSE p_count
    END,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION upsert_guest_action_usage(UUID, DATE, VARCHAR, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_guest_action_usage(UUID, DATE, VARCHAR, INTEGER) TO anon, authenticated, service_role;

-- ── user_action_usage: read-only for users ───────────────────────────────────
DROP POLICY IF EXISTS "users_own_usage" ON user_action_usage;
CREATE POLICY "users_read_own_usage" ON user_action_usage
  FOR SELECT USING (auth.uid() = user_id);
