-- Row-level security for opportunity_map_scans (created in 20260803120000).
--
-- Shipped in a SEPARATE forward migration, not appended to the creating one.
-- This repo applies migration SQL out of band via Supabase `apply_migration`
-- before merge (.claude/rules/database/supabase-migrations.md), so the creating
-- migration may already be recorded in `_prisma_migrations` on a database.
-- Prisma never replays an applied migration whose file later changes — it only
-- warns about the checksum — and the repo's drift gate compares columns, not
-- RLS. Appending here would therefore have left prospect data unprotected on
-- exactly those databases while every check went green (independent review of
-- a60c9f68, P1).
--
-- Posture is service-role only. The table is written and read exclusively
-- server-side through Prisma (app/api/opportunity-map/route.ts,
-- app/api/opportunity-map/handoff/route.ts); nothing reaches it with a
-- browser-held key. Without RLS it inherits whatever grants the project gives
-- anon/authenticated, exposing every scan's prospect details, consent record
-- and lead linkage. The table deliberately carries no organization_id — a scan
-- joins the org-scoped CRM only once consent creates a Lead — so there is no
-- tenant column to scope a policy against and "server only" is the boundary.
--
-- Guards match media_spend_events (20260802000000): a bare REVOKE or
-- CREATE POLICY naming a role that does not exist raises
-- invalid_role_specification (0P000) and aborts the whole migration, so every
-- role-bearing statement is wrapped. On a database without the Supabase roles
-- the ALTER still lands and RLS defaults to deny for ordinary roles.
ALTER TABLE "opportunity_map_scans" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', 'opportunity_map_scans', r);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE "opportunity_map_scans" TO service_role;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE POLICY "service_role_opportunity_map_scans"
      ON "opportunity_map_scans" FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
