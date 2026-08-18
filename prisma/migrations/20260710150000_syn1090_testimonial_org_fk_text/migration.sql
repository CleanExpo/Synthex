-- SYN-1090: Convert testimonial organization_id columns uuid -> text
-- to match Organization.id (text/cuid). Restore the 3 declared FKs and
-- re-create the 8 tenant RLS policies (Postgres blocks ALTER COLUMN TYPE
-- on policy-referenced columns).
--
-- APPLY WITH: founder-applied manually against production.
-- Safe to apply with rows: USING cast handles existing uuid values.

BEGIN;

-- 1. Drop all 8 tenant policies BEFORE the type conversion
DROP POLICY IF EXISTS testimonial_requests_tenant_select ON public.testimonial_requests;
DROP POLICY IF EXISTS testimonial_requests_tenant_insert ON public.testimonial_requests;
DROP POLICY IF EXISTS testimonial_requests_tenant_update ON public.testimonial_requests;
DROP POLICY IF EXISTS testimonial_requests_tenant_delete ON public.testimonial_requests;
DROP POLICY IF EXISTS testimonials_tenant_select ON public.testimonials;
DROP POLICY IF EXISTS testimonials_tenant_insert ON public.testimonials;
DROP POLICY IF EXISTS testimonials_tenant_update ON public.testimonials;
DROP POLICY IF EXISTS testimonials_tenant_delete ON public.testimonials;

-- 2. Also drop existing FKs (may not exist in prod, but idempotent)
ALTER TABLE public.testimonial_requests
  DROP CONSTRAINT IF EXISTS testimonial_requests_organization_id_fkey;
ALTER TABLE public.testimonials
  DROP CONSTRAINT IF EXISTS testimonials_organization_id_fkey;
ALTER TABLE public.testimonials
  DROP CONSTRAINT IF EXISTS testimonials_request_id_fkey;

-- 3. Convert organization_id uuid -> text on both tables
ALTER TABLE public.testimonial_requests
  ALTER COLUMN organization_id TYPE text USING organization_id::text;
ALTER TABLE public.testimonials
  ALTER COLUMN organization_id TYPE text USING organization_id::text;

-- 4. Restore 3 FKs (now type-compatible with text Organization.id)
ALTER TABLE public.testimonial_requests
  ADD CONSTRAINT testimonial_requests_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
    ON DELETE CASCADE;
ALTER TABLE public.testimonials
  ADD CONSTRAINT testimonials_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
    ON DELETE CASCADE;
ALTER TABLE public.testimonials
  ADD CONSTRAINT testimonials_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.testimonial_requests(id)
    ON DELETE CASCADE;

-- 5. Recreate 8 tenant RLS policies
CREATE POLICY testimonial_requests_tenant_select
  ON public.testimonial_requests FOR SELECT
  USING (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY testimonial_requests_tenant_insert
  ON public.testimonial_requests FOR INSERT
  WITH CHECK (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY testimonial_requests_tenant_update
  ON public.testimonial_requests FOR UPDATE
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
  ON public.testimonial_requests FOR DELETE
  USING (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY testimonials_tenant_select
  ON public.testimonials FOR SELECT
  USING (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY testimonials_tenant_insert
  ON public.testimonials FOR INSERT
  WITH CHECK (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

CREATE POLICY testimonials_tenant_update
  ON public.testimonials FOR UPDATE
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
  ON public.testimonials FOR DELETE
  USING (
    organization_id::text IN (
      SELECT organization_id
      FROM public.users
      WHERE id = (SELECT auth.uid())::text
    )
  );

COMMIT;
