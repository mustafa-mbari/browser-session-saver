-- Populate Stripe price IDs for each plan.
-- After creating your products/prices in the Stripe Dashboard, replace the
-- placeholder values below with the real price IDs (price_xxxxxxxxxxxxxxxx).
--
-- Pro: two recurring prices (monthly + yearly)
-- Lifetime: one one-time payment price (stripe_price_monthly holds the one-time price ID)

UPDATE public.plans
SET
  stripe_price_monthly = 'price_1TU5rgRpxbCZpxSkVW0i9kan',
  stripe_price_yearly  = 'price_1TU5rgRpxbCZpxSkpaemmZgp'
WHERE id = 'pro';

UPDATE public.plans
SET
  stripe_price_monthly = 'price_1TU5tQRpxbCZpxSkyDpRQVND'
WHERE id = 'lifetime';
