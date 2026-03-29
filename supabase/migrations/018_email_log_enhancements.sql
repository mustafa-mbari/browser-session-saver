-- ============================================================
-- 018: Email Log Enhancements
-- Add richer columns to email_log for full logging support.
-- ============================================================

ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS type       TEXT,
  ADD COLUMN IF NOT EXISTS message_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata   JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sent_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_log_type    ON public.email_log(type);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_by ON public.email_log(sent_by);
