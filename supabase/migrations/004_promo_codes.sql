-- ============================================================
-- 004: Promo Codes
-- Admin-created codes that grant users a specific plan.
-- ============================================================

CREATE TABLE public.promo_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  plan_id     TEXT NOT NULL REFERENCES public.plans(id),
  max_uses    INTEGER,          -- NULL = unlimited
  used_count  INTEGER NOT NULL DEFAULT 0,
  valid_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,      -- NULL = never expires
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track who redeemed which code (prevents double-redemption)
CREATE TABLE public.promo_redemptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id),
  user_id       UUID NOT NULL REFERENCES public.profiles(id),
  redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (promo_code_id, user_id)
);

ALTER TABLE public.promo_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage promo codes
CREATE POLICY "admins_manage_promos"
  ON public.promo_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Users can read active codes (for redemption UI)
CREATE POLICY "users_read_active_promos"
  ON public.promo_codes FOR SELECT
  USING (is_active = TRUE);

-- Users can redeem codes (insert their own row)
CREATE POLICY "users_redeem_promos"
  ON public.promo_redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own redemptions
CREATE POLICY "users_own_redemptions"
  ON public.promo_redemptions FOR SELECT
  USING (auth.uid() = user_id);
