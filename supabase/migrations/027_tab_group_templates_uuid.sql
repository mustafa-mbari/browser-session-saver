-- ================================================================
-- 027_tab_group_templates_uuid.sql
--
-- Adds a true `id UUID` primary key to `tab_group_templates`. The
-- new SyncEngine upserts with `onConflict: 'id'` uniformly across
-- entities, so this table needs an id column.
--
-- The legacy `(user_id, key)` uniqueness is preserved as a UNIQUE
-- constraint so existing code that reads by `key` still works and
-- so two devices that independently save "Work-blue" still converge
-- to one row.
--
-- Backfill uses deterministic UUID v5 (SHA-1 of "user_id:key") so
-- that two devices arrive at the same UUID for the same (user,key)
-- pair without needing a coordinating round-trip.
--
-- Idempotent. Safe to re-run.
-- ================================================================

BEGIN;

-- Require the pgcrypto extension for gen_random_uuid(); uuid-ossp for v5.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- The v5 namespace below is a fixed UUID (generated once for this app).
-- DO NOT change it after rollout — all backfilled ids depend on it.
-- 8f2a6a6e-0d1b-5c7a-9c3d-5a5e5c5e5c5e == uuid_generate_v5 namespace
DO $$
DECLARE
  v_namespace UUID := '8f2a6a6e-0d1b-5c7a-9c3d-5a5e5c5e5c5e';
BEGIN
  -- Add the id column if it isn't already there.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tab_group_templates'
      AND column_name = 'id'
  ) THEN
    ALTER TABLE public.tab_group_templates ADD COLUMN id UUID;

    -- Backfill deterministically.
    UPDATE public.tab_group_templates
       SET id = uuid_generate_v5(v_namespace, user_id::text || ':' || key)
     WHERE id IS NULL;

    ALTER TABLE public.tab_group_templates ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.tab_group_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Drop the composite PK so we can install id as the new PK.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tab_group_templates_pkey'
      AND conrelid = 'public.tab_group_templates'::regclass
  ) THEN
    ALTER TABLE public.tab_group_templates DROP CONSTRAINT tab_group_templates_pkey;
  END IF;

  -- Install id as the primary key (idempotent: do nothing if already done).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tab_group_templates_pkey'
      AND conrelid = 'public.tab_group_templates'::regclass
  ) THEN
    ALTER TABLE public.tab_group_templates ADD CONSTRAINT tab_group_templates_pkey PRIMARY KEY (id);
  END IF;

  -- Preserve the old uniqueness as a secondary unique constraint.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tab_group_templates_user_key_unique'
      AND conrelid = 'public.tab_group_templates'::regclass
  ) THEN
    ALTER TABLE public.tab_group_templates
      ADD CONSTRAINT tab_group_templates_user_key_unique UNIQUE (user_id, key);
  END IF;
END $$;

COMMIT;
