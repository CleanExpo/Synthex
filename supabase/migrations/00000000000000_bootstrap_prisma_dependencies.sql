-- ============================================================================
-- Migration: 00000000000000_bootstrap_prisma_dependencies
-- Purpose:   Create minimal placeholder tables for Prisma-managed entities so
--            Supabase Preview branches (fresh DBs) can apply the rest of the
--            supabase/migrations/ sequence cleanly.
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- Synthex's schema is split across two migration systems:
--   - prisma/migrations/  — creates organizations, users, team_invitations,
--                           workspaces, etc. (cuid-string IDs, type TEXT).
--   - supabase/migrations/ — creates Supabase-native + RLS tables. Several FK
--                           to the Prisma-managed tables above.
--
-- On a real environment the order is: Prisma migrations first, then Supabase
-- migrations apply on top of the existing Prisma tables. FKs resolve cleanly.
--
-- On a Supabase Preview branch the DB starts empty AND only supabase/
-- migrations/ run. The first FK reference to `organizations(id)` (from
-- 20260315000001_vault_secrets_management.sql onwards) fails with
-- `ERROR: relation "organizations" does not exist (SQLSTATE 42P01)`.
--
-- This bootstrap migration creates minimal placeholders so the FK references
-- resolve on Preview. Real environments (prod, dev) already have Prisma's
-- richer schemas — the `IF NOT EXISTS` makes this migration a no-op there.
--
-- SCOPE
-- -----
-- Only the id columns referenced as FK targets. Real columns (name, email,
-- timestamps, etc.) live in Prisma's schema. This file deliberately does NOT
-- duplicate them — that would risk drift between Prisma and these placeholders.
--
-- The bootstrap is also INTENTIONALLY minimal so that anyone reading it
-- immediately understands "this is the preview-bootstrap shim, not the source
-- of truth for organizations/users/team_invitations".
-- ============================================================================

-- FK targets (id-only placeholders — FK references resolve)
CREATE TABLE IF NOT EXISTS public.organizations (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id TEXT PRIMARY KEY
);

-- ALTER targets (later supabase migrations run `ALTER TABLE X ADD COLUMN ...`
-- on these Prisma-managed tables; placeholders here let those ALTERs succeed
-- on Preview, while `IF NOT EXISTS` makes this a no-op in real envs).
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.geo_research_reports (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.client_health_scores (
  id TEXT PRIMARY KEY
);
