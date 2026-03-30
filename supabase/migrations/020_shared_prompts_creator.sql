-- Migration 020: add shared_by_name to shared_prompts
-- Stores a snapshot of the sharer's display name or email at share time.
-- Safe to run multiple times (IF NOT EXISTS / column existence check).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shared_prompts' AND column_name = 'shared_by_name'
  ) THEN
    ALTER TABLE shared_prompts ADD COLUMN shared_by_name text;
  END IF;
END
$$;
