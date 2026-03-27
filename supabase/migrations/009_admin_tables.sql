-- ============================================================
-- 009: Admin Tables
-- Support tickets, suggestions, webhook events, email log.
-- ============================================================

-- ----------------------------------------------------------------
-- Support Tickets
-- ----------------------------------------------------------------
CREATE TABLE public.tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email       TEXT,          -- Fallback if user_id is null (guest)
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  issue_type  TEXT,
  -- issue_type: 'bug'|'feature'|'billing'|'account'|'other'
  priority    TEXT DEFAULT 'medium',
  -- priority: 'low'|'medium'|'high'|'urgent'
  status      TEXT NOT NULL DEFAULT 'open',
  -- status: 'open'|'in_progress'|'resolved'|'closed'
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_user   ON public.tickets(user_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);

CREATE TABLE public.ticket_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,  -- Admin-only notes
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_replies ON public.ticket_replies(ticket_id);

ALTER TABLE public.tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

-- Users can create and view their own tickets
CREATE POLICY "users_own_tickets"
  ON public.tickets FOR ALL
  USING (auth.uid() = user_id);

-- Admins can see and manage all tickets
CREATE POLICY "admins_manage_tickets"
  ON public.tickets FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Users see non-internal replies on their tickets
CREATE POLICY "users_read_replies"
  ON public.ticket_replies FOR SELECT
  USING (
    is_internal = FALSE AND
    EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );

-- Admins manage all replies
CREATE POLICY "admins_manage_replies"
  ON public.ticket_replies FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ----------------------------------------------------------------
-- Feature Suggestions
-- ----------------------------------------------------------------
CREATE TABLE public.suggestions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  type        TEXT DEFAULT 'feature',
  -- type: 'feature'|'improvement'|'bug'|'other'
  importance  TEXT DEFAULT 'medium',
  -- importance: 'low'|'medium'|'high'
  status      TEXT NOT NULL DEFAULT 'pending',
  -- status: 'pending'|'under_review'|'approved'|'rejected'|'implemented'
  votes       INTEGER NOT NULL DEFAULT 0,
  admin_notes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suggestions_status ON public.suggestions(status);
CREATE INDEX idx_suggestions_votes  ON public.suggestions(votes DESC);

CREATE TABLE public.suggestion_votes (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  suggestion_id UUID NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, suggestion_id)
);

ALTER TABLE public.suggestions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;

-- Everyone can read suggestions
CREATE POLICY "public_read_suggestions"
  ON public.suggestions FOR SELECT
  USING (TRUE);

-- Authenticated users can submit suggestions
CREATE POLICY "users_add_suggestions"
  ON public.suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage all suggestions
CREATE POLICY "admins_manage_suggestions"
  ON public.suggestions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Users manage their own votes
CREATE POLICY "users_manage_votes"
  ON public.suggestion_votes FOR ALL
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- Webhook Events Log
-- ----------------------------------------------------------------
CREATE TABLE public.webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source       TEXT NOT NULL,    -- 'stripe' | 'internal'
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'pending',
  -- status: 'pending'|'processed'|'failed'
  error_msg    TEXT,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_status ON public.webhook_events(status);
CREATE INDEX idx_webhook_events_source ON public.webhook_events(source, created_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only admins and service role can access webhook events
CREATE POLICY "admins_read_webhook_events"
  ON public.webhook_events FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ----------------------------------------------------------------
-- Email Send Log
-- ----------------------------------------------------------------
CREATE TABLE public.email_log (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email  TEXT NOT NULL,
  subject   TEXT NOT NULL,
  template  TEXT,
  status    TEXT NOT NULL DEFAULT 'sent',
  -- status: 'sent'|'failed'|'bounced'
  error_msg TEXT,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_log_status ON public.email_log(status);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_email_log"
  ON public.email_log FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
