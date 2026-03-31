-- Migration 022: fix infinite recursion in profiles RLS
--
-- Problem: "admins_read_profiles" queries public.profiles inside itself.
-- When any user touches the profiles table, PostgreSQL evaluates all policies,
-- the admin policy fires a sub-SELECT on profiles, which re-evaluates policies,
-- causing infinite recursion → every UPDATE (e.g. saving display_name) fails.
--
-- Fix: replace the recursive subquery with a SECURITY DEFINER function that
-- reads profiles as the table owner, bypassing RLS entirely.

-- 1. Create a SECURITY DEFINER helper to safely check admin status.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. Drop the recursive admin policy and recreate it using the helper.
DROP POLICY IF EXISTS "admins_read_profiles" ON public.profiles;

CREATE POLICY "admins_read_profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- 3. Tighten users_own_profile to be explicit about WITH CHECK (safe re-create).
DROP POLICY IF EXISTS "users_own_profile" ON public.profiles;

CREATE POLICY "users_own_profile"
  ON public.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
