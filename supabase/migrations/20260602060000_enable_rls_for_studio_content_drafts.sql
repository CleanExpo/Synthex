-- ============================================================================
-- Migration: enable RLS for Client Content Studio drafts
-- Purpose:   Close the RLS coverage gap introduced by the Prisma-backed
--            studio_content_drafts table.
-- Scope:     Forward-only, additive. No table or data changes.
-- ============================================================================

BEGIN;

ALTER TABLE IF EXISTS public.studio_content_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY studio_content_drafts_tenant_read
    ON public.studio_content_drafts
    FOR SELECT TO authenticated
    USING (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY studio_content_drafts_tenant_write
    ON public.studio_content_drafts
    FOR ALL TO authenticated
    USING (is_team_member(organization_id))
    WITH CHECK (is_team_member(organization_id));
EXCEPTION
  WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
END $$;

COMMIT;
