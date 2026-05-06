-- Populate Stripe price IDs for each plan.
-- After creating your products/prices in the Stripe Dashboard, replace the
-- placeholder values below with the real price IDs (price_xxxxxxxxxxxxxxxx).
--
-- Pro: two recurring prices (monthly + yearly)
-- Lifetime: one one-time payment price (stripe_price_monthly holds the one-time price ID)

UPDATE public.plans
SET
  stripe_price_monthly = 'REPLACE_WITH_STRIPE_PRICE_ID_PRO_MONTHLY',
  stripe_price_yearly  = 'REPLACE_WITH_STRIPE_PRICE_ID_PRO_YEARLY'
WHERE id = 'pro';

UPDATE public.plans
SET
  stripe_price_monthly = 'REPLACE_WITH_STRIPE_PRICE_ID_LIFETIME'
WHERE id = 'lifetime';
