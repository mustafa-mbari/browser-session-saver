-- ============================================================
-- 017: Enable Row Level Security on the `plans` table.
-- Plans are static reference data; all authenticated users may
-- read them (required for billing/checkout pages and RPCs).
-- Only service-role / admin operations may write to this table.
-- ============================================================

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated or anonymous user to read plans
CREATE POLICY "plans_select_public"
  ON public.plans
  FOR SELECT
  USING (true);
