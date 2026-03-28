-- ============================================================
-- 013: Tab Sync Limits & Schema Fixes
-- - Adds board_id to bookmark_folders so the board ↔ category
--   relationship can be restored on another device.
-- - Adds is_native / native_id to bookmark_entries.
-- - Adds total_tabs_limit to plans (Pro=1000, Max=3000).
-- - Updates get_user_quota() to expose total_tabs_limit.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. bookmark_folders: add board_id
-- ----------------------------------------------------------------
ALTER TABLE public.bookmark_folders
  ADD COLUMN IF NOT EXISTS board_id TEXT;

CREATE INDEX IF NOT EXISTS idx_bm_folders_board
  ON public.bookmark_folders(board_id);

-- ----------------------------------------------------------------
-- 2. bookmark_entries: add is_native / native_id
-- ----------------------------------------------------------------
ALTER TABLE public.bookmark_entries
  ADD COLUMN IF NOT EXISTS is_native  BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.bookmark_entries
  ADD COLUMN IF NOT EXISTS native_id  TEXT;

-- ----------------------------------------------------------------
-- 3. plans: add total_tabs_limit
-- ----------------------------------------------------------------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS total_tabs_limit INTEGER;

UPDATE public.plans SET total_tabs_limit = 0    WHERE id = 'free';
UPDATE public.plans SET total_tabs_limit = 1000 WHERE id = 'pro';
UPDATE public.plans SET total_tabs_limit = 3000 WHERE id = 'max';

-- ----------------------------------------------------------------
-- 4. get_user_quota(): expose total_tabs_limit
-- Must DROP first because the return-type signature changed.
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_quota(UUID);

CREATE FUNCTION public.get_user_quota(p_user_id UUID)
RETURNS TABLE (
  plan_id                  TEXT,
  plan_name                TEXT,
  sync_enabled             BOOLEAN,
  sessions_synced_limit    INTEGER,
  tabs_per_session_limit   INTEGER,
  folders_synced_limit     INTEGER,
  entries_per_folder_limit INTEGER,
  prompts_access_limit     INTEGER,
  prompts_create_limit     INTEGER,
  notes_limit              INTEGER,
  todos_limit              INTEGER,
  subs_synced_limit        INTEGER,
  subs_initial_grant       INTEGER,
  subs_monthly_add         INTEGER,
  total_tabs_limit         INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.sync_enabled,
    p.sessions_synced_limit,
    p.tabs_per_session_limit,
    p.folders_synced_limit,
    p.entries_per_folder_limit,
    p.prompts_access_limit,
    p.prompts_create_limit,
    p.notes_limit,
    p.todos_limit,
    p.subs_synced_limit,
    p.subs_initial_grant,
    p.subs_monthly_add,
    p.total_tabs_limit
  FROM public.user_plans up
  JOIN public.plans p ON p.id = up.plan_id
  WHERE up.user_id = p_user_id
    AND up.status = 'active'
  LIMIT 1;
$$;
