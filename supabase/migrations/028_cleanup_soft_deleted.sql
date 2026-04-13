-- ================================================================
-- 028_cleanup_soft_deleted.sql
--
-- Hard-deletes soft-deleted rows older than 30 days across every
-- synced table. Scheduled via pg_cron to run daily at 03:00 UTC.
--
-- 30-day retention chosen so that:
--   * A user who deletes a row on Device A has ample time for
--     every other device to come online and pull the tombstone.
--   * A user who accidentally bulk-deletes has a real restore
--     window (our UI surface can display tombstones during this
--     period if we later add an "undo" flow).
--
-- Idempotent. Safe to re-run.
-- ================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── The sweep function ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_soft_deleted()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '30 days';
BEGIN
  DELETE FROM public.sessions              WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  DELETE FROM public.prompts               WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  DELETE FROM public.prompt_folders        WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  DELETE FROM public.tracked_subscriptions WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  DELETE FROM public.tab_group_templates   WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  DELETE FROM public.bookmark_entries      WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  DELETE FROM public.bookmark_folders      WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  DELETE FROM public.todo_items            WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  DELETE FROM public.todo_lists            WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  DELETE FROM public.quick_links           WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
END;
$$;

-- ─── Schedule (daily 03:00 UTC) ────────────────────────────────────
-- pg_cron.unschedule() only accepts the job name; wrap in a DO block so
-- a missing prior schedule doesn't abort the migration.
DO $$
BEGIN
  PERFORM cron.unschedule('purge_soft_deleted_daily');
EXCEPTION WHEN OTHERS THEN
  -- First run — no existing schedule. Continue.
  NULL;
END $$;

SELECT cron.schedule(
  'purge_soft_deleted_daily',
  '0 3 * * *',
  $$SELECT public.purge_soft_deleted();$$
);

COMMIT;
