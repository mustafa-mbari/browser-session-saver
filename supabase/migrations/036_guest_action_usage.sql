-- Migration 036: Guest action usage tracking
-- Enables unauthenticated (guest) users to have their action counts stored in Supabase,
-- so counts can be merged into a real user record on sign-up/sign-in.

-- ── guest_action_usage table ──────────────────────────────────────────────────
-- guest_id is a client-generated UUID stored in chrome.storage.local.
-- No FK to auth.users — guests have no account.
CREATE TABLE IF NOT EXISTS guest_action_usage (
  guest_id        UUID        PRIMARY KEY,
  daily_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  daily_count     INTEGER     NOT NULL DEFAULT 0 CHECK (daily_count >= 0),
  monthly_month   VARCHAR(7)  NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM'),
  monthly_count   INTEGER     NOT NULL DEFAULT 0 CHECK (monthly_count >= 0),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: guests have no JWT, so zero direct table access. All writes go through
-- SECURITY DEFINER RPCs; all reads go through the service-role Edge Function.
ALTER TABLE guest_action_usage ENABLE ROW LEVEL SECURITY;

-- ── RPC: upsert_guest_action_usage ───────────────────────────────────────────
-- Called fire-and-forget from the extension after each action by a guest.
-- SECURITY DEFINER so the anon role (no JWT) can call it without a table policy.
-- Mirrors the logic of upsert_action_usage() for signed-in users.
CREATE OR REPLACE FUNCTION upsert_guest_action_usage(
  p_guest_id      UUID,
  p_daily_date    DATE,
  p_monthly_month VARCHAR(7)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO guest_action_usage (
    guest_id, daily_date, daily_count, monthly_month, monthly_count, updated_at
  )
  VALUES (
    p_guest_id, p_daily_date, 1, p_monthly_month, 1, NOW()
  )
  ON CONFLICT (guest_id) DO UPDATE SET
    daily_date  = p_daily_date,
    daily_count = CASE
      WHEN guest_action_usage.daily_date = p_daily_date
        THEN guest_action_usage.daily_count + 1
      ELSE 1
    END,
    monthly_month  = p_monthly_month,
    monthly_count  = CASE
      WHEN guest_action_usage.monthly_month = p_monthly_month
        THEN guest_action_usage.monthly_count + 1
      ELSE 1
    END,
    updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_guest_action_usage(UUID, DATE, VARCHAR) TO anon;

-- ── RPC: get_guest_limits ─────────────────────────────────────────────────────
-- Called at extension startup to fetch dynamic guest limits from the plans table.
-- Falls back gracefully when the plans row does not exist.
CREATE OR REPLACE FUNCTION get_guest_limits()
RETURNS TABLE(daily_action_limit INT, monthly_action_limit INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT daily_action_limit, monthly_action_limit
  FROM plans
  WHERE id = 'guest'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_guest_limits() TO anon;
