-- SYN-681: Ask Synthex conversation tables
-- client_conversations: stores successful AI-answered exchanges
-- conversation_events: audit log of ALL questions including failures

-- ── client_conversations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_conversations (
  id          UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID                     NOT NULL,
  question    TEXT                     NOT NULL,
  response    JSONB                    NOT NULL,
  -- response shape:
  --   { answer: string,
  --     sources: Array<{ table: string, rows_queried: number, confidence: 'High'|'Medium'|'Low' }>,
  --     model_tier: 'haiku'|'sonnet'|'opus',
  --     score: IntelligenceScore<'conversation'> }
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Clients read only their own conversations
ALTER TABLE public.client_conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "clients_read_own_conversations"
    ON public.client_conversations
    FOR SELECT
    USING (client_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role has full CRUD (no RLS restriction for service key)
DO $$ BEGIN
  CREATE POLICY "service_role_full_access_conversations"
    ON public.client_conversations
    FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_conversations_client_id
  ON public.client_conversations (client_id, created_at DESC);

-- ── conversation_events ───────────────────────────────────────────────────────
-- All questions including failures — analytics / accuracy audit trail

DO $$ BEGIN
  CREATE TYPE public.question_category AS ENUM (
    'performance',
    'algorithm',
    'brand',
    'competitor',
    'general',
    'out_of_scope'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.conversation_events (
  id                UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID                     NOT NULL,
  question          TEXT                     NOT NULL,
  question_category public.question_category NOT NULL DEFAULT 'general',
  answered          BOOLEAN                  NOT NULL DEFAULT false,
  failure_reason    TEXT,            -- populated when answered = false
  model_tier_used   TEXT,            -- 'haiku' | 'sonnet' | 'opus' | null on failure
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

-- Clients cannot read their own event log (internal analytics only)
DO $$ BEGIN
  CREATE POLICY "service_role_full_access_events"
    ON public.conversation_events
    FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversation_events_client_id
  ON public.conversation_events (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_events_answered
  ON public.conversation_events (answered, created_at DESC);
