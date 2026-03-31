-- Migration 023: atomic view count increment for shared_prompts
--
-- Replaces the read-modify-write pattern (race condition) with an atomic
-- UPDATE … RETURNING so concurrent views are counted correctly.
-- Returns the new view_count after increment.

CREATE OR REPLACE FUNCTION public.increment_shared_prompt_views(p_id uuid)
RETURNS integer
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shared_prompts
  SET view_count = view_count + 1
  WHERE id = p_id
  RETURNING view_count;
$$;
