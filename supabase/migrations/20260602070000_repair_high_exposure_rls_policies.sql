-- ============================================================================
-- Migration: 20260602070000_repair_high_exposure_rls_policies
-- Purpose:   Replace the remaining high-exposure RLS warning surface with
--            least-privilege scoped policies.
-- Trace:     RLS adversarial high-exposure follow-up
-- ============================================================================
--
-- Supabase Preview rebuilds from a historical migration set that is missing
-- some older Prisma-backed product tables now present in production. Guard each
-- table block so preview still validates this PR's new migrations without
-- fabricating unrelated legacy table schemas.

BEGIN;

ALTER TABLE IF EXISTS public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.founder_outreach_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nexus_databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.testimonial_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.testimonials ENABLE ROW LEVEL SECURITY;

DO $email_campaigns$
BEGIN
IF to_regclass('public.email_campaigns') IS NOT NULL THEN

DROP POLICY IF EXISTS email_campaigns_founder_access ON public.email_campaigns;
DROP POLICY IF EXISTS email_campaigns_founder_select ON public.email_campaigns;
DROP POLICY IF EXISTS email_campaigns_founder_insert ON public.email_campaigns;
DROP POLICY IF EXISTS email_campaigns_founder_update ON public.email_campaigns;
DROP POLICY IF EXISTS email_campaigns_founder_delete ON public.email_campaigns;

CREATE POLICY email_campaigns_founder_select
  ON public.email_campaigns
  FOR SELECT TO authenticated
  USING (founder_id = (SELECT auth.uid())::text);

CREATE POLICY email_campaigns_founder_insert
  ON public.email_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (founder_id = (SELECT auth.uid())::text);

CREATE POLICY email_campaigns_founder_update
  ON public.email_campaigns
  FOR UPDATE TO authenticated
  USING (founder_id = (SELECT auth.uid())::text)
  WITH CHECK (founder_id = (SELECT auth.uid())::text);

CREATE POLICY email_campaigns_founder_delete
  ON public.email_campaigns
  FOR DELETE TO authenticated
  USING (founder_id = (SELECT auth.uid())::text);

END IF;
END;
$email_campaigns$;

DO $generated_content$
BEGIN
IF to_regclass('public.generated_content') IS NOT NULL THEN

DROP POLICY IF EXISTS generated_content_founder_access ON public.generated_content;
DROP POLICY IF EXISTS generated_content_founder_select ON public.generated_content;
DROP POLICY IF EXISTS generated_content_founder_insert ON public.generated_content;
DROP POLICY IF EXISTS generated_content_founder_update ON public.generated_content;
DROP POLICY IF EXISTS generated_content_founder_delete ON public.generated_content;

CREATE POLICY generated_content_founder_select
  ON public.generated_content
  FOR SELECT TO authenticated
  USING (founder_id = (SELECT auth.uid())::text);

CREATE POLICY generated_content_founder_insert
  ON public.generated_content
  FOR INSERT TO authenticated
  WITH CHECK (founder_id = (SELECT auth.uid())::text);

CREATE POLICY generated_content_founder_update
  ON public.generated_content
  FOR UPDATE TO authenticated
  USING (founder_id = (SELECT auth.uid())::text)
  WITH CHECK (founder_id = (SELECT auth.uid())::text);

CREATE POLICY generated_content_founder_delete
  ON public.generated_content
  FOR DELETE TO authenticated
  USING (founder_id = (SELECT auth.uid())::text);

END IF;
END;
$generated_content$;

DO $nexus_databases$
BEGIN
IF to_regclass('public.nexus_databases') IS NOT NULL THEN

DROP POLICY IF EXISTS nexus_databases_founder_access ON public.nexus_databases;
DROP POLICY IF EXISTS nexus_databases_founder_select ON public.nexus_databases;
DROP POLICY IF EXISTS nexus_databases_founder_insert ON public.nexus_databases;
DROP POLICY IF EXISTS nexus_databases_founder_update ON public.nexus_databases;
DROP POLICY IF EXISTS nexus_databases_founder_delete ON public.nexus_databases;

CREATE POLICY nexus_databases_founder_select
  ON public.nexus_databases
  FOR SELECT TO authenticated
  USING (founder_id = (SELECT auth.uid())::text);

CREATE POLICY nexus_databases_founder_insert
  ON public.nexus_databases
  FOR INSERT TO authenticated
  WITH CHECK (founder_id = (SELECT auth.uid())::text);

CREATE POLICY nexus_databases_founder_update
  ON public.nexus_databases
  FOR UPDATE TO authenticated
  USING (founder_id = (SELECT auth.uid())::text)
  WITH CHECK (founder_id = (SELECT auth.uid())::text);

CREATE POLICY nexus_databases_founder_delete
  ON public.nexus_databases
  FOR DELETE TO authenticated
  USING (founder_id = (SELECT auth.uid())::text);

END IF;
END;
$nexus_databases$;

DO $founder_outreach_queue$
BEGIN
IF to_regclass('public.founder_outreach_queue') IS NOT NULL THEN

DROP POLICY IF EXISTS service_role_all_foq ON public.founder_outreach_queue;
DROP POLICY IF EXISTS founder_outreach_queue_tenant_access ON public.founder_outreach_queue;
DROP POLICY IF EXISTS founder_outreach_queue_tenant_select ON public.founder_outreach_queue;
DROP POLICY IF EXISTS founder_outreach_queue_tenant_insert ON public.founder_outreach_queue;
DROP POLICY IF EXISTS founder_outreach_queue_tenant_update ON public.founder_outreach_queue;
DROP POLICY IF EXISTS founder_outreach_queue_tenant_delete ON public.founder_outreach_queue;

CREATE POLICY founder_outreach_queue_tenant_select
  ON public.founder_outreach_queue
  FOR SELECT TO authenticated
  USING (is_team_member(organization_id));

CREATE POLICY founder_outreach_queue_tenant_insert
  ON public.founder_outreach_queue
  FOR INSERT TO authenticated
  WITH CHECK (is_team_member(organization_id));

CREATE POLICY founder_outreach_queue_tenant_update
  ON public.founder_outreach_queue
  FOR UPDATE TO authenticated
  USING (is_team_member(organization_id))
  WITH CHECK (is_team_member(organization_id));

CREATE POLICY founder_outreach_queue_tenant_delete
  ON public.founder_outreach_queue
  FOR DELETE TO authenticated
  USING (is_team_member(organization_id));

END IF;
END;
$founder_outreach_queue$;

DO $testimonial_requests$
BEGIN
IF to_regclass('public.testimonial_requests') IS NOT NULL THEN

DROP POLICY IF EXISTS testimonial_requests_tenant_access ON public.testimonial_requests;
DROP POLICY IF EXISTS testimonial_requests_tenant_select ON public.testimonial_requests;
DROP POLICY IF EXISTS testimonial_requests_tenant_insert ON public.testimonial_requests;
DROP POLICY IF EXISTS testimonial_requests_tenant_update ON public.testimonial_requests;
DROP POLICY IF EXISTS testimonial_requests_tenant_delete ON public.testimonial_requests;

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

END IF;
END;
$testimonial_requests$;

DO $testimonials$
BEGIN
IF to_regclass('public.testimonials') IS NOT NULL THEN

DROP POLICY IF EXISTS testimonials_tenant_access ON public.testimonials;
DROP POLICY IF EXISTS testimonials_tenant_select ON public.testimonials;
DROP POLICY IF EXISTS testimonials_tenant_insert ON public.testimonials;
DROP POLICY IF EXISTS testimonials_tenant_update ON public.testimonials;
DROP POLICY IF EXISTS testimonials_tenant_delete ON public.testimonials;

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

END IF;
END;
$testimonials$;

DO $invoice_line_items$
BEGIN
IF to_regclass('public.invoice_line_items') IS NOT NULL THEN

DROP POLICY IF EXISTS invoice_line_items_tenant_access ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_tenant_select ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_tenant_insert ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_tenant_update ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_tenant_delete ON public.invoice_line_items;

CREATE POLICY invoice_line_items_tenant_select
  ON public.invoice_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_team_member(i.organization_id)
    )
  );

CREATE POLICY invoice_line_items_tenant_insert
  ON public.invoice_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_team_member(i.organization_id)
    )
  );

CREATE POLICY invoice_line_items_tenant_update
  ON public.invoice_line_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_team_member(i.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_team_member(i.organization_id)
    )
  );

CREATE POLICY invoice_line_items_tenant_delete
  ON public.invoice_line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND is_team_member(i.organization_id)
    )
  );

END IF;
END;
$invoice_line_items$;

COMMIT;
