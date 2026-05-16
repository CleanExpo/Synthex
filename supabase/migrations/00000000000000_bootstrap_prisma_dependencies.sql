-- ============================================================================
-- Migration: 00000000000000_bootstrap_prisma_dependencies
-- Purpose:   Create minimal placeholder tables for Prisma-managed entities
--            referenced as FK targets by later supabase/migrations/ files.
--
-- HISTORICAL NOTE
-- ---------------
-- This file's content covers the 3 FK-target tables. A second bootstrap at
-- `20250101000000_bootstrap_prisma_alter_targets.sql` covers tables that
-- supabase migrations ALTER (rather than FK to). They were split because
-- this file was applied to the Preview project before the ALTER targets
-- were enumerated — adding to this file would have left the new tables
-- un-applied (Preview saw the version as already-done).
--
-- See `20250101000000_bootstrap_prisma_alter_targets.sql` for the rest.
-- ============================================================================

-- FK targets (id-only placeholders so FK references resolve on Preview)
CREATE TABLE IF NOT EXISTS public.organizations (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id TEXT PRIMARY KEY
);
