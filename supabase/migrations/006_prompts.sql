-- ============================================================
-- 006: Synced Prompts & Prompt Folders
-- Mirrors the local chrome.storage.local prompt data.
-- Supports nested folders via parent_id self-reference.
-- ============================================================

CREATE TABLE public.prompt_folders (
  id         TEXT PRIMARY KEY,  -- Extension-generated UUID
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT,
  color      TEXT,
  source     TEXT NOT NULL DEFAULT 'local',  -- 'local' | 'app'
  parent_id  TEXT REFERENCES public.prompt_folders(id) ON DELETE SET NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompt_folders_user
  ON public.prompt_folders(user_id);

CREATE INDEX idx_prompt_folders_parent
  ON public.prompt_folders(parent_id);

ALTER TABLE public.prompt_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_prompt_folders"
  ON public.prompt_folders FOR ALL
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------

CREATE TABLE public.prompts (
  id                TEXT PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  content           TEXT NOT NULL,  -- May contain {{variable}} placeholders
  description       TEXT,
  category_id       TEXT,
  folder_id         TEXT REFERENCES public.prompt_folders(id) ON DELETE SET NULL,
  source            TEXT NOT NULL DEFAULT 'local',  -- 'local' | 'app'
  tags              TEXT[] DEFAULT '{}',
  is_favorite       BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned         BOOLEAN NOT NULL DEFAULT FALSE,
  usage_count       INTEGER NOT NULL DEFAULT 0,
  last_used_at      TIMESTAMPTZ,
  compatible_models TEXT[] DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompts_user
  ON public.prompts(user_id);

CREATE INDEX idx_prompts_folder
  ON public.prompts(folder_id);

CREATE INDEX idx_prompts_favorite
  ON public.prompts(user_id, is_favorite);

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_prompts"
  ON public.prompts FOR ALL
  USING (auth.uid() = user_id);
