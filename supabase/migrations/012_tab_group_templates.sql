-- ============================================================
-- 012: Tab Group Templates
-- Cloud copies of saved tab group templates from the extension.
-- tabs stored as JSONB (TabGroupTemplateTab[]).
-- ============================================================

CREATE TABLE public.tab_group_templates (
  key         TEXT        NOT NULL,  -- '{title}-{color}' dedup key (from extension)
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  color       TEXT        NOT NULL,
  tabs        JSONB       NOT NULL DEFAULT '[]',  -- TabGroupTemplateTab[]
  saved_at    TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at   TIMESTAMPTZ          DEFAULT NOW(),
  PRIMARY KEY (user_id, key)         -- one template key per user
);

CREATE INDEX idx_tg_templates_user ON public.tab_group_templates(user_id);

ALTER TABLE public.tab_group_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_tab_group_templates"
  ON public.tab_group_templates FOR ALL
  USING (auth.uid() = user_id);

CREATE TRIGGER touch_tab_group_templates
  BEFORE UPDATE ON public.tab_group_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
