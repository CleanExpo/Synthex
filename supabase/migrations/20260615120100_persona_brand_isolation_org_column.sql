-- =============================================================================
-- DRAFT — Brand isolation for PERSONA surface (personas table / Persona model)
-- Flagged in #454 / #449. NOT YET APPLIED. Founder-gated, out-of-band via
-- Supabase apply_migration (NEVER prisma db push). This file lives under
-- supabase/migrations/ (NOT prisma/migrations/) so it does NOT auto-apply on
-- Vercel deploy.
--
-- WHY: the Persona Prisma model (prisma/schema.prisma ~line 1376, @@map
-- "personas") has user_id + indexes but NO organization_id. CRUD
-- (app/api/personas/route.ts), optimize (app/api/personas/[id]/optimize) and
-- train (app/api/personas/[id]/train) scope by user_id ONLY — so a
-- multi-business owner sees/mutates the same user's personas across all brands.
--
-- ROLLOUT ORDER: (1) THIS migration adds nullable column + index → (2) backfill
-- → (3) app-code carve-out → (4) LATER add the Prisma field + optional NOT NULL
-- (separate, gated).
--
-- ⚠ DRIFT-CHECKER SEQUENCING: scripts/check-schema-drift.mjs fails the build if
-- a scalar field declared in prisma/schema.prisma is missing from the live DB.
-- Therefore the matching `organizationId` field is NOT added to schema.prisma in
-- this PR (it is documented as a diff snippet in the plan). The Prisma field is
-- added in a FOLLOW-UP PR only AFTER this column exists in prod, so the drift
-- gate stays green. Until then the app-code carve-out uses a raw scoped query or
-- waits for the schema field — see the plan for the exact sequencing.
--
-- Scalar column, NO DB FK to organizations (TEXT/UUID hazard) — org-scope at the
-- query layer, exactly like StudioContentDraft.
-- =============================================================================

-- Step 1: nullable organization_id (TEXT — personas.id and user_id are cuid TEXT).
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Step 2: index for the brand-scoped read path (user_id + organization_id).
CREATE INDEX IF NOT EXISTS idx_personas_user_org
  ON public.personas (user_id, organization_id);

-- =============================================================================
-- Step 3: BACKFILL (run AFTER column confirmed present; reviewed separately).
-- Populate from the owning user's HOME org (public.users.organization_id), the
-- same value getEffectiveOrganizationId() falls back to for non-multi-business
-- users.
--
-- MULTI-ORG AMBIGUITY: each persona has exactly one owning user_id; we assign
-- the owner's HOME org deterministically. Owners with no home org leave the
-- persona NULL (legacy), still visible via the app carve-out — zero data loss.
-- Idempotent: only fills rows still NULL.
-- =============================================================================
UPDATE public.personas p
   SET organization_id = u.organization_id
  FROM public.users u
 WHERE p.user_id::text = u.id  -- personas.user_id is UUID (legacy unified_schema); users.id is TEXT. Cast uuid->text (lossless; no-op if already TEXT) so the join is type-safe and replay-safe.
   AND p.organization_id IS NULL
   AND u.organization_id IS NOT NULL;

-- =============================================================================
-- ROLLBACK (additive-only):
--   DROP INDEX IF EXISTS public.idx_personas_user_org;
--   ALTER TABLE public.personas DROP COLUMN IF EXISTS organization_id;
-- (If the Prisma field has already been added in a later PR, REVERT that PR
--  FIRST — otherwise the drift checker fails the build on the now-missing column.)
-- =============================================================================
