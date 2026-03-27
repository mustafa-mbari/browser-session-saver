-- ============================================================
-- 005: Synced Sessions
-- Cloud copies of browser sessions saved by the extension.
-- tabs and tab_groups stored as JSONB to match extension types.
-- ============================================================

CREATE TABLE public.sessions (
  id                TEXT PRIMARY KEY,  -- Extension-generated UUID
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  tabs              JSONB NOT NULL DEFAULT '[]',       -- Tab[]
  tab_groups        JSONB NOT NULL DEFAULT '[]',       -- TabGroup[]
  window_id         INTEGER,
  tags              TEXT[] DEFAULT '{}',
  is_pinned         BOOLEAN NOT NULL DEFAULT FALSE,
  is_starred        BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked         BOOLEAN NOT NULL DEFAULT FALSE,
  is_auto_save      BOOLEAN NOT NULL DEFAULT FALSE,
  auto_save_trigger TEXT,
  -- trigger: 'timer'|'shutdown'|'sleep'|'battery'|'network'|'window_close'|'manual'
  notes             TEXT DEFAULT '',
  tab_count         INTEGER NOT NULL DEFAULT 0,
  version           TEXT DEFAULT '1.0.0',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user
  ON public.sessions(user_id);

CREATE INDEX idx_sessions_auto_save
  ON public.sessions(user_id, is_auto_save);

CREATE INDEX idx_sessions_created_at
  ON public.sessions(user_id, created_at DESC);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions"
  ON public.sessions FOR ALL
  USING (auth.uid() = user_id);
