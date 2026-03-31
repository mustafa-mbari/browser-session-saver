-- Migration 021: add source_prompt_id (unique) and creator_name to shared_prompts
--
-- source_prompt_id: the extension's original prompt UUID — enables stable per-prompt
--   share URLs at /prompts/{sourcePromptId} and prevents duplicate share entries.
-- creator_name: who authored the prompt content ('Browser Hub' for app-sourced prompts,
--   display name for user-created prompts). Distinct from shared_by_name (the sharer).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shared_prompts' AND column_name = 'source_prompt_id'
  ) THEN
    ALTER TABLE shared_prompts ADD COLUMN source_prompt_id TEXT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'shared_prompts'
      AND constraint_name = 'shared_prompts_source_prompt_id_key'
  ) THEN
    ALTER TABLE shared_prompts
      ADD CONSTRAINT shared_prompts_source_prompt_id_key UNIQUE (source_prompt_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shared_prompts' AND column_name = 'creator_name'
  ) THEN
    ALTER TABLE shared_prompts ADD COLUMN creator_name TEXT;
  END IF;
END
$$;
