-- ================================================================
-- 026_soft_delete_columns.sql
--
-- Adds soft-delete infrastructure to every synced table so the new
-- SyncEngine (client-side, src/core/sync/) can propagate deletes via
-- tombstones instead of set-diff.
--
--  * `deleted_at TIMESTAMPTZ NULL` on every synced table
--  * `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` where missing
--  * BEFORE UPDATE trigger using public.touch_updated_at() (migration 010)
--  * Indexes for the pull delta query + deletion sweep
--
-- Idempotent. Safe to re-run.
-- ================================================================

BEGIN;

-- ─── Helper: add deleted_at to a table if missing ──────────────────
CREATE OR REPLACE FUNCTION _tmp_add_deleted_at(tbl regclass)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'ALTER TABLE %s ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL',
    tbl::text
  );
END; $$;

-- ─── Helper: add updated_at with default + touch trigger ───────────
CREATE OR REPLACE FUNCTION _tmp_add_updated_at(tbl regclass, trigger_name text)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'ALTER TABLE %s ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
    tbl::text
  );
  -- Drop-then-create is idempotent and re-applies if the function body changed.
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', trigger_name, tbl::text);
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',
    trigger_name,
    tbl::text
  );
END; $$;

-- ─── Apply to every synced table ───────────────────────────────────
SELECT _tmp_add_deleted_at('public.sessions');
SELECT _tmp_add_deleted_at('public.prompts');
SELECT _tmp_add_deleted_at('public.prompt_folders');
SELECT _tmp_add_deleted_at('public.tracked_subscriptions');
SELECT _tmp_add_deleted_at('public.tab_group_templates');
SELECT _tmp_add_deleted_at('public.bookmark_folders');
SELECT _tmp_add_deleted_at('public.bookmark_entries');
SELECT _tmp_add_deleted_at('public.todo_lists');
SELECT _tmp_add_deleted_at('public.todo_items');
SELECT _tmp_add_deleted_at('public.quick_links');

-- prompt_folders already has updated_at + trigger; sessions/prompts/
-- tracked_subscriptions/bookmark_folders/bookmark_entries/tab_group_templates
-- already have updated_at. todos and quick_links are missing it entirely.
SELECT _tmp_add_updated_at('public.todo_lists',  'touch_todo_lists');
SELECT _tmp_add_updated_at('public.todo_items',  'touch_todo_items');
SELECT _tmp_add_updated_at('public.quick_links', 'touch_quick_links');

-- Re-ensure triggers on tables that had updated_at but may have been
-- missing the trigger historically.
DROP TRIGGER IF EXISTS touch_sessions              ON public.sessions;
CREATE TRIGGER        touch_sessions BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_prompts              ON public.prompts;
CREATE TRIGGER        touch_prompts BEFORE UPDATE ON public.prompts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_prompt_folders              ON public.prompt_folders;
CREATE TRIGGER        touch_prompt_folders BEFORE UPDATE ON public.prompt_folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_tracked_subscriptions              ON public.tracked_subscriptions;
CREATE TRIGGER        touch_tracked_subscriptions BEFORE UPDATE ON public.tracked_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_tab_group_templates              ON public.tab_group_templates;
CREATE TRIGGER        touch_tab_group_templates BEFORE UPDATE ON public.tab_group_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_bookmark_folders              ON public.bookmark_folders;
CREATE TRIGGER        touch_bookmark_folders BEFORE UPDATE ON public.bookmark_folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_bookmark_entries              ON public.bookmark_entries;
CREATE TRIGGER        touch_bookmark_entries BEFORE UPDATE ON public.bookmark_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── Indexes for the pull delta query + deletion sweep ─────────────
-- The sync engine's pull does:
--   SELECT * FROM t WHERE user_id = ? AND updated_at > ? ORDER BY updated_at;
-- A composite (user_id, updated_at DESC) index serves that.
--
-- The deletion-sweep cron (migration 028) will do:
--   SELECT * FROM t WHERE deleted_at IS NOT NULL AND deleted_at < ?;
-- A partial index on (deleted_at) covers that, at near-zero storage cost
-- because live rows are excluded via WHERE deleted_at IS NOT NULL.
--
-- Names follow `idx_<table>_<purpose>` to avoid colliding with existing ones.

CREATE INDEX IF NOT EXISTS idx_sessions_sync              ON public.sessions              (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_tombstones        ON public.sessions              (deleted_at)                WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prompts_sync               ON public.prompts               (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prompts_tombstones         ON public.prompts               (deleted_at)                WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prompt_folders_sync        ON public.prompt_folders        (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prompt_folders_tombstones  ON public.prompt_folders        (deleted_at)                WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracked_subs_sync          ON public.tracked_subscriptions (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tracked_subs_tombstones    ON public.tracked_subscriptions (deleted_at)                WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tab_group_templates_sync        ON public.tab_group_templates (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tab_group_templates_tombstones  ON public.tab_group_templates (deleted_at)                WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookmark_folders_sync        ON public.bookmark_folders (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookmark_folders_tombstones  ON public.bookmark_folders (deleted_at)                WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookmark_entries_sync        ON public.bookmark_entries (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookmark_entries_tombstones  ON public.bookmark_entries (deleted_at)                WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_todo_lists_sync        ON public.todo_lists (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todo_lists_tombstones  ON public.todo_lists (deleted_at)                WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_todo_items_sync        ON public.todo_items (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todo_items_tombstones  ON public.todo_items (deleted_at)                WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quick_links_sync        ON public.quick_links (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quick_links_tombstones  ON public.quick_links (deleted_at)                WHERE deleted_at IS NOT NULL;

-- ─── Cleanup ──────────────────────────────────────────────────────
DROP FUNCTION _tmp_add_deleted_at(regclass);
DROP FUNCTION _tmp_add_updated_at(regclass, text);

COMMIT;
