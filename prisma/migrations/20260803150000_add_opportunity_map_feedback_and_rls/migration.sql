-- Close the public scan table to direct client access. The application writes
-- through the server-side Prisma connection; browsers never receive table
-- privileges or a tenant-readable policy.
ALTER TABLE public.opportunity_map_scans
    ADD COLUMN "feedback_useful" BOOLEAN,
    ADD COLUMN "feedback_missing" TEXT,
    ADD COLUMN "feedback_submitted_at" TIMESTAMP(3);

ALTER TABLE public.opportunity_map_scans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_opportunity_map_scans"
    ON public.opportunity_map_scans
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
