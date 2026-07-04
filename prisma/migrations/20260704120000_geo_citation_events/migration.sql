-- SYN-584: GEO Citation Baseline Monitor (silent dark run, admin-only).
--
-- Additive + idempotent. The table, its three indexes, and ENABLE RLS were
-- FIRST created by supabase migration
-- 20260405000001_syn656_geo_score_schema_upgrade.sql (whose comment reads
-- "SYN-584 gap — table was never created"). This migration re-declares the
-- same objects with IF NOT EXISTS so the Prisma migration history matches the
-- schema, and ADDS the missing service-role RLS policy so the table is
-- service-role-only (no authenticated read policy — the client-facing UI is a
-- later sprint, not this ticket).
--
-- users.id is TEXT in this schema, so user_id is TEXT (not UUID) — matching the
-- existing FK. Apply out-of-band via Supabase `apply_migration` against project
-- znyjoyjsvjotlzjppzal. Never `prisma db push`.

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

-- Service-role only. RLS enabled + no authenticated SELECT/INSERT policy means
-- all access is via the API service-role key (which bypasses RLS). Canonical
-- pattern per supabase/migrations/20260319000001_rls_comprehensive_all_tables.sql.
ALTER TABLE public.geo_citation_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_geo_citation_events"
    ON public.geo_citation_events FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN datatype_mismatch THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;
