-- SYN-1090: Testimonial FK schema<->prod drift repair.
--
-- Source of truth: prisma/schema.prisma —
--   TestimonialRequest.organizationId / Testimonial.organizationId are now
--   plain text (cuid), matching Organization.id (text). Prod columns are
--   currently uuid, so the declared FKs to organizations(id) CANNOT exist
--   (uuid <-> text incompatible) and pg_constraint confirms ZERO FKs on both
--   tables (verified live 2026-07-10). Both tables verified EMPTY in prod
--   (testimonial_requests = 0 rows, testimonials = 0 rows), so this type
--   conversion is trivially safe; the USING cast keeps it correct even if
--   rows appear before apply.
--
-- Postgres refuses ALTER COLUMN TYPE on a column referenced by RLS policies
-- ("cannot alter type of a column used in a policy definition"), and all 8
-- tenant policies (select/insert/update/delete x 2 tables, from
-- supabase/migrations/20260602070000_repair_high_exposure_rls_policies.sql,
-- verified identical in live pg_policies) reference organization_id.
-- Therefore, in ONE transaction: drop the 8 policies -> alter the 2 columns
-- -> recreate the 8 policies verbatim -> add the 3 declared FKs.
--
-- STRICTLY CREATE-ONLY REPO ARTIFACT + idempotent (DROP POLICY IF EXISTS
-- before each CREATE; FK adds wrapped in exception-swallowing DO blocks;
-- re-running the ALTERs on already-text columns is a no-op cast).
--
-- Apply via the Supabase MCP apply_migration tool against project
--   znyjoyjsvjotlzjppzal
-- PROD apply is the founder's gate — never `prisma db push` /
-- `prisma migrate deploy` against prod from CI or a dev box. Apply to a
-- Supabase BRANCH first. This folder may be renamed at merge for timestamp
-- ordering.

BEGIN;

-- ============================================================================
-- 1. Drop the 8 tenant policies that reference organization_id
--    (blocks ALTER COLUMN TYPE otherwise).
-- ============================================================================

DROP POLICY IF EXISTS testimonial_requests_tenant_select ON public.testimonial_requests;
DROP POLICY IF EXISTS testimonial_requests_tenant_insert ON public.testimonial_requests;
DROP POLICY IF EXISTS testimonial_requests_tenant_update ON public.testimonial_requests;
DROP POLICY IF EXISTS testimonial_requests_tenant_delete ON public.testimonial_requests;

DROP POLICY IF EXISTS testimonials_tenant_select ON public.testimonials;
DROP POLICY IF EXISTS testimonials_tenant_insert ON public.testimonials;
DROP POLICY IF EXISTS testimonials_tenant_update ON public.testimonials;
DROP POLICY IF EXISTS testimonials_tenant_delete ON public.testimonials;

-- ============================================================================
-- 2. Convert organization_id uuid -> text on both tables.
--    USING cast keeps this correct even if rows exist at apply time
--    (both tables verified 0 rows on 2026-07-10).
-- ============================================================================

ALTER TABLE public.testimonial_requests
  ALTER COLUMN organization_id TYPE text USING organization_id::text;

ALTER TABLE public.testimonials
  ALTER COLUMN organization_id TYPE text USING organization_id::text;

-- ============================================================================
-- 3. Recreate the 8 tenant policies VERBATIM (identical semantics to
--    supabase/migrations/20260602070000_repair_high_exposure_rls_policies.sql
--    and to the live pg_policies definitions dumped 2026-07-10).
--    organization_id::text is now a no-op cast on a text column.
-- ============================================================================

CREATE POLICY testimonial_requests_tenant_select
  ON public.testimonial_requests
  FOR SELECT TO authenticated
  USING (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY testimonial_requests_tenant_insert
  ON public.testimonial_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY testimonial_requests_tenant_update
  ON public.testimonial_requests
  FOR UPDATE TO authenticated
  USING (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  )
  WITH CHECK (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY testimonial_requests_tenant_delete
  ON public.testimonial_requests
  FOR DELETE TO authenticated
  USING (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY testimonials_tenant_select
  ON public.testimonials
  FOR SELECT TO authenticated
  USING (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY testimonials_tenant_insert
  ON public.testimonials
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY testimonials_tenant_update
  ON public.testimonials
  FOR UPDATE TO authenticated
  USING (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  )
  WITH CHECK (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY testimonials_tenant_delete
  ON public.testimonials
  FOR DELETE TO authenticated
  USING (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

-- ============================================================================
-- 4. Add the 3 FKs declared in prisma/schema.prisma (pg_constraint verified
--    EMPTY for both tables in prod — even the type-compatible request_id FK
--    was never created). Names match Prisma's default constraint naming so a
--    future `prisma db push`/diff sees no drift.
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE public.testimonial_requests
    ADD CONSTRAINT testimonial_requests_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.testimonials
    ADD CONSTRAINT testimonials_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.testimonials
    ADD CONSTRAINT testimonials_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.testimonial_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- ============================================================================
-- Post-apply verification (founder runs these SELECTs after applying):
--
--   -- (a) both organization_id columns are text:
--   SELECT table_name, column_name, data_type
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name IN ('testimonial_requests', 'testimonials')
--     AND column_name = 'organization_id';
--   -- expect 2 rows, both data_type = 'text'
--
--   -- (b) the 3 FKs exist:
--   SELECT conrelid::regclass::text AS tbl, conname
--   FROM pg_constraint
--   WHERE contype = 'f'
--     AND conrelid IN ('public.testimonial_requests'::regclass,
--                      'public.testimonials'::regclass);
--   -- expect: testimonial_requests_organization_id_fkey,
--   --         testimonials_organization_id_fkey, testimonials_request_id_fkey
--
--   -- (c) the 8 policies are back:
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('testimonial_requests', 'testimonials');
--   -- expect 8 rows
--
--   -- (d) RLS still enabled:
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE oid IN ('public.testimonial_requests'::regclass,
--                 'public.testimonials'::regclass);
--   -- expect relrowsecurity = true for both
-- ============================================================================
