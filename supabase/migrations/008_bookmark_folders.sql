-- ============================================================
-- 008: Synced Bookmark Folders & Entries
-- Mirrors the extension's newtab-db BookmarkCategory + BookmarkEntry.
-- note_content stores inline note text for note-type widgets.
-- ============================================================

CREATE TABLE public.bookmark_folders (
  id               TEXT PRIMARY KEY,  -- Extension-generated UUID
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  icon             TEXT,
  color            TEXT,
  card_type        TEXT DEFAULT 'bookmark',
  -- card_type: 'bookmark'|'clock'|'note'|'todo'|'subscription'|'tab-groups'|'prompt-manager'
  note_content     TEXT,   -- For note-type widgets (cardType = 'note')
  col_span         INTEGER DEFAULT 3,
  row_span         INTEGER DEFAULT 3,
  position         INTEGER DEFAULT 0,
  parent_folder_id TEXT REFERENCES public.bookmark_folders(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bm_folders_user
  ON public.bookmark_folders(user_id);

CREATE INDEX idx_bm_folders_parent
  ON public.bookmark_folders(parent_folder_id);

ALTER TABLE public.bookmark_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_bm_folders"
  ON public.bookmark_folders FOR ALL
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------

CREATE TABLE public.bookmark_entries (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_id    TEXT NOT NULL REFERENCES public.bookmark_folders(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  url          TEXT NOT NULL,
  fav_icon_url TEXT,
  description  TEXT,
  category     TEXT,     -- User-defined label
  position     INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bm_entries_folder
  ON public.bookmark_entries(folder_id);

CREATE INDEX idx_bm_entries_user
  ON public.bookmark_entries(user_id);

ALTER TABLE public.bookmark_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_bm_entries"
  ON public.bookmark_entries FOR ALL
  USING (auth.uid() = user_id);
