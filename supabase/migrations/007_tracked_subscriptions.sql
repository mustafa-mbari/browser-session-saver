-- ============================================================
-- 007: Synced Tracked Subscriptions (financial)
-- Named "tracked_subscriptions" to avoid confusion with billing plans.
-- Mirrors the extension's chrome.storage.local 'subscriptions' key.
-- ============================================================

CREATE TABLE public.tracked_subscriptions (
  id                TEXT PRIMARY KEY,  -- Extension-generated UUID
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  logo              TEXT,
  url               TEXT,
  email             TEXT,
  category          TEXT NOT NULL,
  price             NUMERIC(10,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'USD',
  billing_cycle     TEXT NOT NULL,
  -- billing_cycle: 'monthly' | 'yearly' | 'weekly' | 'custom'
  next_billing_date DATE NOT NULL,
  payment_method    TEXT,
  status            TEXT NOT NULL DEFAULT 'active',
  -- status: 'active' | 'trial' | 'canceling' | 'paused' | 'canceled'
  reminder          INTEGER NOT NULL DEFAULT 3,  -- days before renewal
  notes             TEXT,
  tags              TEXT[] DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracked_subs_user
  ON public.tracked_subscriptions(user_id);

CREATE INDEX idx_tracked_subs_billing
  ON public.tracked_subscriptions(user_id, next_billing_date);

ALTER TABLE public.tracked_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_tracked_subs"
  ON public.tracked_subscriptions FOR ALL
  USING (auth.uid() = user_id);
