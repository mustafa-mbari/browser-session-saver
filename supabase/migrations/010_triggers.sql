-- ============================================================
-- 010: Database Triggers
-- Auto-creates profile + assigns Free plan on signup.
-- Auto-updates updated_at on all mutable tables.
-- ============================================================

-- ----------------------------------------------------------------
-- Auto-setup on user signup
-- Creates a profile row and assigns the Free plan automatically.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_plans (user_id, plan_id, status, source)
  VALUES (NEW.id, 'free', 'active', 'default')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER after_user_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.on_user_signup();

-- ----------------------------------------------------------------
-- updated_at auto-touch helper
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to all tables with an updated_at column
CREATE TRIGGER touch_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_user_plans
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_sessions
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_prompts
  BEFORE UPDATE ON public.prompts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_prompt_folders
  BEFORE UPDATE ON public.prompt_folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_tracked_subs
  BEFORE UPDATE ON public.tracked_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_bm_folders
  BEFORE UPDATE ON public.bookmark_folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_bm_entries
  BEFORE UPDATE ON public.bookmark_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_tickets
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_suggestions
  BEFORE UPDATE ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
