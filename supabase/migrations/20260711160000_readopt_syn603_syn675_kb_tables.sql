-- RE-ADOPT archived-only live/dormant tables into the active migration tree.
-- Parity-remediation spec docs/specs/spm-parity-remediation-2026-07-11.md (C7 / phase P3).
--
-- These 5 tables EXIST in prod (znyjoyjsvjotlzjppzal) and carry live/dormant code
-- paths (platform_algorithms + ranking_signals via
-- app/api/internal/algorithm-freshness-monitor raw SQL; milestone_events via an API
-- route + the deliver-milestone-notifications edge fn; signal_weights +
-- source_provenance dormant) — but their ONLY DDL lived in
--   .claude/archived/2026-04-27/sql-drift/prisma-root/migration-2026-04-02-syn603-algorithm-kb.sql  (4 KB tables)
--   .claude/archived/2026-04-27/sql-drift/prisma-root/migration-2026-04-05-syn675-milestone-events.sql (milestone_events)
-- i.e. outside every active migration tree, so a FRESH-environment rebuild (Supabase
-- branch / CI) would MISS them. This file closes that gap.
--
-- AUTHORED FROM LIVE PROD (2026-07-11), not the archive: the archived syn603 file
-- shipped these 4 KB tables with ZERO RLS, but prod has since enabled RLS + policies
-- on all 5. This migration mirrors the CURRENT prod shape exactly (columns, PK/FK/CHECK/
-- UNIQUE constraints, indexes, RLS + policies) so fresh == prod.
--
-- ADDITIVE + IDEMPOTENT: CREATE TABLE/INDEX IF NOT EXISTS, ENABLE RLS (no-op if on),
-- policies guarded in DO blocks. On prod every statement is a no-op (objects exist);
-- on a fresh DB it builds the full FK-closed set in dependency order. No DROP, no DML.
--
-- LEDGER: this file lives in supabase/migrations, so `supabase db push` (via
-- scripts/safe-migrate.sh) applies it (no-op on prod) AND records it in
-- supabase_migrations.schema_migrations automatically — no manual ledger insert needed
-- (unlike the prisma/migrations reconcile). PROD apply stays the founder's gate.
--
-- DECISION LOGGED (security review, spec s1): milestone_events keeps prod's
-- non-service-role client SELECT policy `TO public USING (organization_id =
-- auth.uid()::text)` — mirrored as-is (org-scoped, not an open read). The 4 KB tables
-- expose only an `authenticated` SELECT (USING true = catalog-style reference data);
-- writes are service_role-only (RLS enabled, not forced → service_role bypasses).

-- ============================================================================
-- 1. platform_algorithms  (root of the KB FK chain)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "platform_algorithms" (
  "id" text NOT NULL DEFAULT (gen_random_uuid())::text,
  "platform" text NOT NULL,
  "surface" text,
  "algorithm_name" text NOT NULL,
  "description" text,
  "last_verified_date" date,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "platform_algorithms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_algorithms_platform_surface_unique" UNIQUE ("platform", "surface")
);
CREATE INDEX IF NOT EXISTS "idx_platform_algorithms_platform" ON "platform_algorithms" ("platform");
ALTER TABLE "platform_algorithms" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "platform_algorithms_read_authenticated" ON "platform_algorithms"
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ============================================================================
-- 2. ranking_signals  (FK -> platform_algorithms)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "ranking_signals" (
  "id" text NOT NULL DEFAULT (gen_random_uuid())::text,
  "platform_id" text NOT NULL,
  "signal_name" text NOT NULL,
  "category" text NOT NULL,
  "confidence_level" text NOT NULL,
  "weight_tier" text NOT NULL DEFAULT 'unknown'::text,
  "description" text,
  "implication" text,
  "last_verified_date" date,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "needs_review" boolean NOT NULL DEFAULT false,
  "needs_review_reason" text,
  CONSTRAINT "ranking_signals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ranking_signals_platform_name_unique" UNIQUE ("platform_id", "signal_name"),
  CONSTRAINT "ranking_signals_platform_id_fkey" FOREIGN KEY ("platform_id")
    REFERENCES "platform_algorithms" ("id") ON DELETE CASCADE,
  CONSTRAINT "ranking_signals_category_check" CHECK (category = ANY (ARRAY['CQ','EV','UB','AT','TK','FR','DS','PS']::text[])),
  CONSTRAINT "ranking_signals_confidence_check" CHECK (confidence_level = ANY (ARRAY['CONFIRMED','LEAKED','INFERRED','SPECULATIVE']::text[])),
  CONSTRAINT "ranking_signals_weight_check" CHECK (weight_tier = ANY (ARRAY['critical','strong','moderate','minor','unknown']::text[]))
);
CREATE INDEX IF NOT EXISTS "idx_ranking_signals_platform" ON "ranking_signals" ("platform_id");
CREATE INDEX IF NOT EXISTS "idx_ranking_signals_category" ON "ranking_signals" ("category");
CREATE INDEX IF NOT EXISTS "idx_ranking_signals_confidence" ON "ranking_signals" ("confidence_level");
CREATE INDEX IF NOT EXISTS "idx_ranking_signals_needs_review" ON "ranking_signals" ("needs_review");
ALTER TABLE "ranking_signals" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "ranking_signals_read_authenticated" ON "ranking_signals"
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ============================================================================
-- 3. signal_weights  (FK -> ranking_signals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "signal_weights" (
  "id" text NOT NULL DEFAULT (gen_random_uuid())::text,
  "signal_id" text NOT NULL,
  "surface" text,
  "weight_tier" text NOT NULL DEFAULT 'unknown'::text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "signal_weights_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "signal_weights_signal_id_fkey" FOREIGN KEY ("signal_id")
    REFERENCES "ranking_signals" ("id") ON DELETE CASCADE,
  CONSTRAINT "signal_weights_confidence_check" CHECK (weight_tier = ANY (ARRAY['critical','strong','moderate','minor','unknown']::text[]))
);
CREATE INDEX IF NOT EXISTS "idx_signal_weights_signal" ON "signal_weights" ("signal_id");
ALTER TABLE "signal_weights" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "signal_weights_read_authenticated" ON "signal_weights"
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ============================================================================
-- 4. source_provenance  (FK -> ranking_signals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "source_provenance" (
  "id" text NOT NULL DEFAULT (gen_random_uuid())::text,
  "signal_id" text NOT NULL,
  "source_type" text NOT NULL,
  "source_name" text NOT NULL,
  "source_url" text,
  "source_date" date,
  "excerpt" text,
  "confidence_level" text NOT NULL DEFAULT 'INFERRED'::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "source_provenance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "source_provenance_signal_id_fkey" FOREIGN KEY ("signal_id")
    REFERENCES "ranking_signals" ("id") ON DELETE CASCADE,
  CONSTRAINT "source_provenance_confidence_check" CHECK (confidence_level = ANY (ARRAY['CONFIRMED','LEAKED','INFERRED','SPECULATIVE']::text[])),
  CONSTRAINT "source_provenance_type_check" CHECK (source_type = ANY (ARRAY['official_statement','leaked_doc','corroborating','academic']::text[]))
);
CREATE INDEX IF NOT EXISTS "idx_source_provenance_signal" ON "source_provenance" ("signal_id");
ALTER TABLE "source_provenance" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "source_provenance_read_authenticated" ON "source_provenance"
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ============================================================================
-- 5. milestone_events  (standalone; SYN-675)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "milestone_events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" text NOT NULL,
  "milestone_type" text NOT NULL,
  "triggered_at" timestamptz NOT NULL DEFAULT now(),
  "email_sent_at" timestamptz,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "milestone_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "milestone_events_org_type_unique" UNIQUE ("organization_id", "milestone_type"),
  CONSTRAINT "milestone_events_type_check" CHECK (milestone_type = ANY (ARRAY['posts_100','anniversary_1yr','local_views_1000']::text[]))
);
-- Redundant non-unique index on (organization_id, milestone_type) mirrors prod exactly.
CREATE INDEX IF NOT EXISTS "milestone_events_org_type_idx" ON "milestone_events" ("organization_id", "milestone_type");
CREATE INDEX IF NOT EXISTS "milestone_events_unsent_idx" ON "milestone_events" ("organization_id", "email_sent_at") WHERE "email_sent_at" IS NULL;
ALTER TABLE "milestone_events" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all_milestone_events" ON "milestone_events"
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "client_select_own_milestone_events" ON "milestone_events"
    FOR SELECT TO public USING (organization_id = (auth.uid())::text);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- ============================================================================
-- Post-apply verification (read-only; founder runs after apply):
--   SELECT count(*) FROM information_schema.tables WHERE table_schema='public'
--     AND table_name IN ('platform_algorithms','ranking_signals','signal_weights',
--                        'source_provenance','milestone_events');  -- expect 5
--   SELECT tablename, count(*) FROM pg_policies WHERE schemaname='public'
--     AND tablename IN ('platform_algorithms','ranking_signals','signal_weights',
--                       'source_provenance','milestone_events') GROUP BY 1;
--     -- expect 1 each on the 4 KB tables, 2 on milestone_events
-- ============================================================================
