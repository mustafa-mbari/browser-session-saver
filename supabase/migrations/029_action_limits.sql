-- Migration 029: Action-based limits
-- Replaces per-entity quota system with daily/monthly action limits per plan tier.

-- ── Add action limit columns to plans ────────────────────────────────────────
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS daily_action_limit   INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS monthly_action_limit INTEGER NOT NULL DEFAULT 30;

-- ── Seed per-tier limits ──────────────────────────────────────────────────────
-- Note: 'free' plan (default) already has the column defaults (6/30)
UPDATE plans SET daily_action_limit = 3,  monthly_action_limit = 20  WHERE id = 'free';
UPDATE plans SET daily_action_limit = 50, monthly_action_limit = 500 WHERE id = 'pro';
-- 'max' plan (to be renamed 'lifetime' in migration 030)
UPDATE plans SET daily_action_limit = 90, monthly_action_limit = 900 WHERE id = 'max';

-- ── user_action_usage table ───────────────────────────────────────────────────
-- Tracks action counts for signed-in users. Single row per user, updated in place.
CREATE TABLE IF NOT EXISTS user_action_usage (
  user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  daily_count     INTEGER     NOT NULL DEFAULT 0,
  monthly_month   VARCHAR(7)  NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM'),
  monthly_count   INTEGER     NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_action_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_usage" ON user_action_usage
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for admin queries that filter by date/month
CREATE INDEX idx_user_action_usage_daily   ON user_action_usage(daily_date);
CREATE INDEX idx_user_action_usage_monthly ON user_action_usage(monthly_month);

-- ── RPC: upsert_action_usage ─────────────────────────────────────────────────
-- Called fire-and-forget from the extension after each successful mutation.
-- Resets daily/monthly count automatically when the date/month rolls over.
CREATE OR REPLACE FUNCTION upsert_action_usage(
  p_user_id       UUID,
  p_daily_date    DATE,
  p_monthly_month VARCHAR(7)
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_action_usage (user_id, daily_date, daily_count, monthly_month, monthly_count, updated_at)
  VALUES (p_user_id, p_daily_date, 1, p_monthly_month, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    -- Reset daily count if date rolled over, otherwise increment
    daily_date  = p_daily_date,
    daily_count = CASE
      WHEN user_action_usage.daily_date = p_daily_date THEN user_action_usage.daily_count + 1
      ELSE 1
    END,
    -- Reset monthly count if month rolled over, otherwise increment
    monthly_month  = p_monthly_month,
    monthly_count  = CASE
      WHEN user_action_usage.monthly_month = p_monthly_month THEN user_action_usage.monthly_count + 1
      ELSE 1
    END,
    updated_at = NOW();
END;
$$;

-- ── RPC: get_user_plan_tier ───────────────────────────────────────────────────
-- Returns the active plan tier + action limits for the extension to cache on sign-in.
CREATE OR REPLACE FUNCTION get_user_plan_tier(p_user_id UUID)
RETURNS TABLE(tier TEXT, daily_action_limit INT, monthly_action_limit INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT p.id::TEXT, p.daily_action_limit, p.monthly_action_limit
  FROM user_plans up
  JOIN plans p ON p.id = up.plan_id
  WHERE up.user_id = p_user_id
    AND up.status = 'active'
  LIMIT 1;
END;
$$;
