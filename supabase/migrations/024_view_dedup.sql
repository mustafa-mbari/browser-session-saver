-- Migration 024: deduplicate shared prompt view counts by IP
--
-- Creates shared_prompt_views to track the last view time per (prompt, ip_hash).
-- Updates the increment RPC to only count a view if the same IP hasn't visited
-- in the last 10 minutes — prevents reload inflation.

CREATE TABLE IF NOT EXISTS public.shared_prompt_views (
  prompt_id  uuid        NOT NULL REFERENCES public.shared_prompts(id) ON DELETE CASCADE,
  ip_hash    text        NOT NULL,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prompt_id, ip_hash)
);

-- Drop the old single-argument version before replacing with the new signature.
DROP FUNCTION IF EXISTS public.increment_shared_prompt_views(uuid);

CREATE OR REPLACE FUNCTION public.increment_shared_prompt_views(p_id uuid, p_ip_hash text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- If this IP already viewed this prompt within the last 10 minutes, skip increment.
  IF EXISTS (
    SELECT 1 FROM public.shared_prompt_views
    WHERE prompt_id = p_id
      AND ip_hash   = p_ip_hash
      AND viewed_at > now() - interval '10 minutes'
  ) THEN
    SELECT view_count INTO v_count FROM public.shared_prompts WHERE id = p_id;
    RETURN v_count;
  END IF;

  -- Record / refresh the view timestamp for this IP.
  INSERT INTO public.shared_prompt_views (prompt_id, ip_hash, viewed_at)
    VALUES (p_id, p_ip_hash, now())
  ON CONFLICT (prompt_id, ip_hash) DO UPDATE
    SET viewed_at = now();

  -- Atomically increment and return the new count.
  UPDATE public.shared_prompts
    SET view_count = view_count + 1
    WHERE id = p_id
    RETURNING view_count INTO v_count;

  RETURN v_count;
END;
$$;
