-- Per-user action limit overrides (admin-set; take precedence over plan defaults)
CREATE TABLE IF NOT EXISTS user_action_overrides (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_action_limit    INTEGER CHECK (daily_action_limit > 0),
  monthly_action_limit  INTEGER CHECK (monthly_action_limit > 0),
  reason                TEXT,
  set_by                UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_action_overrides ENABLE ROW LEVEL SECURITY;

-- Only admins (profiles.role = 'admin') can read or write overrides
CREATE POLICY "Admin full access to user_action_overrides"
  ON user_action_overrides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Update get_user_plan_tier() to prefer per-user overrides over plan defaults
CREATE OR REPLACE FUNCTION get_user_plan_tier(p_user_id UUID)
RETURNS TABLE(tier TEXT, daily_action_limit INT, monthly_action_limit INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
