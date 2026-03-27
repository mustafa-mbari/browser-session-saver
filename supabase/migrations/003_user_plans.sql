-- ============================================================
-- 003: User Plans (billing state per user)
-- Tracks which plan each user is on and when it expires.
-- Also tracks the monthly subscription addition budget for Free users.
-- ============================================================

CREATE TABLE public.user_plans (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id                TEXT NOT NULL REFERENCES public.plans(id),
  status                 TEXT NOT NULL DEFAULT 'active',
  -- status: 'active' | 'canceled' | 'past_due' | 'trialing'
  billing_cycle          TEXT,
  -- billing_cycle: 'monthly' | 'yearly' | NULL (free plan)
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  trial_ends_at          TIMESTAMPTZ,
  canceled_at            TIMESTAMPTZ,
  source                 TEXT NOT NULL DEFAULT 'default',
  -- source: 'stripe' | 'promo' | 'admin_manual' | 'default'
  stripe_subscription_id TEXT,
  stripe_customer_id     TEXT,
  promo_code             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id) -- one active plan per user
);

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_plan"
  ON public.user_plans FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "admins_read_all_plans"
  ON public.user_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "admins_update_plans"
  ON public.user_plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ----------------------------------------------------------------
-- Monthly subscription budget (Free plan quota enforcement)
-- Each row tracks how many tracked subscriptions a user added
-- in a given calendar month (format: 'YYYY-MM').
-- ----------------------------------------------------------------
CREATE TABLE public.subscription_monthly_budget (
  user_id        UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year_month     TEXT    NOT NULL, -- e.g. '2026-03'
  additions_used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year_month)
);

ALTER TABLE public.subscription_monthly_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_budget"
  ON public.subscription_monthly_budget FOR ALL
  USING (auth.uid() = user_id);
