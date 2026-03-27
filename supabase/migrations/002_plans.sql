-- ============================================================
-- 002: Plans (static quota config)
-- Defines Free, Pro, and Max tiers with all quota limits.
-- NULL = unlimited; 0 = disabled/no access.
-- ============================================================

CREATE TABLE public.plans (
  id                       TEXT PRIMARY KEY, -- 'free' | 'pro' | 'max'
  name                     TEXT NOT NULL,
  price_monthly            NUMERIC(10,2) DEFAULT 0,
  price_yearly             NUMERIC(10,2) DEFAULT 0,
  stripe_price_monthly     TEXT,
  stripe_price_yearly      TEXT,

  -- Sync
  sync_enabled             BOOLEAN NOT NULL DEFAULT FALSE,

  -- Sessions (synced cloud copies; local always unlimited for Pro/Max)
  sessions_synced_limit    INTEGER,   -- NULL = unlimited; 0 = no sync
  tabs_per_session_limit   INTEGER,   -- Max tabs stored per session

  -- Bookmark Folders (BookmarkCategory in extension)
  folders_synced_limit     INTEGER,
  entries_per_folder_limit INTEGER,   -- Max bookmark entries per folder

  -- Prompts
  prompts_access_limit     INTEGER,   -- How many prompts they can view
  prompts_create_limit     INTEGER,   -- How many they can create

  -- Notes (BookmarkCategory with cardType = 'note')
  notes_limit              INTEGER,   -- NULL = unlimited

  -- Todos
  todos_limit              INTEGER,

  -- Tracked Subscriptions (financial — not to be confused with billing plans)
  subs_synced_limit        INTEGER,   -- NULL = unlimited
  subs_initial_grant       INTEGER,   -- Free only: initial allowance
  subs_monthly_add         INTEGER,   -- Free only: how many can be added per calendar month

  sort_order               INTEGER DEFAULT 0,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the 3 plans
-- Free: no sync, local only with strict limits
INSERT INTO public.plans (
  id, name, price_monthly, price_yearly, stripe_price_monthly, stripe_price_yearly,
  sync_enabled,
  sessions_synced_limit, tabs_per_session_limit,
  folders_synced_limit, entries_per_folder_limit,
  prompts_access_limit, prompts_create_limit,
  notes_limit, todos_limit,
  subs_synced_limit, subs_initial_grant, subs_monthly_add,
  sort_order
) VALUES
(
  'free', 'Free', 0, 0, NULL, NULL,
  FALSE,
  0, 30,      -- 0 synced, 30 tabs/session cap
  5, 30,      -- 5 folders, 30 entries each
  10, 6,      -- access 10 prompts, create 6
  NULL, 50,   -- unlimited notes, 50 todos
  0, 2, 1,    -- 0 synced subs, 2 initial, +1/month
  0
),
(
  'pro', 'Pro', 9.99, 99.99, NULL, NULL,
  TRUE,
  10, 200,    -- 10 synced sessions, 200 tabs/session
  100, 200,   -- 100 synced folders, 200 entries each
  100, 100,   -- access 100, create 100
  200, 200,   -- 200 notes, 200 todos (synced)
  20, NULL, NULL,  -- 20 synced subs, no monthly restriction
  1
),
(
  'max', 'Max', 19.99, 199.99, NULL, NULL,
  TRUE,
  100, 500,   -- 100 synced sessions, 500 tabs/session
  300, 500,   -- 300 synced folders, 500 entries each
  NULL, NULL, -- unlimited prompts
  NULL, NULL, -- unlimited notes & todos
  NULL, NULL, NULL, -- unlimited subs
  2
);
