-- Close the public scan table to direct client access. The application writes
-- through the server-side Prisma connection; browsers never receive table
-- privileges or a tenant-readable policy.
ALTER TABLE public.opportunity_map_scans
    ADD COLUMN "feedback_useful" BOOLEAN,
    ADD COLUMN "feedback_missing" TEXT,
    ADD COLUMN "feedback_submitted_at" TIMESTAMP(3);

ALTER TABLE public.opportunity_map_scans ENABLE ROW LEVEL SECURITY;

-- Guarded on the ROLE as well as the object. duplicate_object does not catch a
-- missing role: on a database without the Supabase roles, `TO service_role`
-- raises invalid_role_specification (0P000) and aborts the migration — which
-- would defeat the portability guard already applied in 20260803130000 and
-- break the chain before the feedback columns above are usable
-- (independent review of e5f6c153, P2).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE POLICY "service_role_opportunity_map_scans"
      ON public.opportunity_map_scans
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
