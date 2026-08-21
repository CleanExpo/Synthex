-- SYN-656: Upgrade client_geo_scores + create missing geo_citation_events
-- Applied to production znyjoyjsvjotlzjppzal on 2026-04-05
-- Executor: synthex-task-executor (first autonomous run)

-- 1. Upgrade client_geo_scores with board-approved columns
ALTER TABLE public.client_geo_scores
  ADD COLUMN IF NOT EXISTS components JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trend_data JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS recommended_actions JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_client_geo_scores_client_id ON public.client_geo_scores(client_id);
CREATE INDEX IF NOT EXISTS idx_client_geo_scores_computed_at ON public.client_geo_scores(computed_at DESC);

ALTER TABLE public.client_geo_scores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'client_geo_scores' AND policyname = 'client_read_own_geo_score'
  ) THEN
    CREATE POLICY "client_read_own_geo_score" ON public.client_geo_scores FOR SELECT USING (client_id = auth.uid()::text);
  END IF;
END $$;

-- 2. Create missing geo_citation_events table (SYN-584 gap — table was never created)
-- Note: users.id is TEXT in this schema, so user_id is TEXT not UUID
CREATE TABLE IF NOT EXISTS public.geo_citation_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  query_text        TEXT NOT NULL,
  search_engine     TEXT NOT NULL CHECK (search_engine IN ('google_ai_overview', 'chatgpt', 'perplexity')),
  query_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  brand_mentioned   BOOLEAN NOT NULL DEFAULT FALSE,
  raw_snippet       TEXT,
  mention_position  INTEGER,
  query_variant     INTEGER NOT NULL CHECK (query_variant IN (1, 2, 3)),
  error_reason      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_citation_user_date ON public.geo_citation_events(user_id, query_date);
CREATE INDEX IF NOT EXISTS idx_geo_citation_engine ON public.geo_citation_events(search_engine);
CREATE INDEX IF NOT EXISTS idx_geo_citation_mentioned ON public.geo_citation_events(brand_mentioned) WHERE brand_mentioned = TRUE;

ALTER TABLE public.geo_citation_events ENABLE ROW LEVEL SECURITY;
