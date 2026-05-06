-- Update plan display prices to EUR
UPDATE public.plans SET price_monthly = 2.99,  price_yearly = 24.99 WHERE id = 'pro';
UPDATE public.plans SET price_monthly = 59.99, price_yearly = 0     WHERE id = 'lifetime';
