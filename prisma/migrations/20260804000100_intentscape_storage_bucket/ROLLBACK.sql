-- ROLLBACK for 20260804000100_intentscape_storage_bucket.
--
-- Safe ONLY while the bucket is empty. Check first — expect zero:
--
--   SELECT count(*) FROM storage.objects WHERE bucket_id = 'intentscape-wiki';
--
-- Any non-zero count means tenant artifacts are stored there. STOP: deleting
-- them destroys the organisation's IntentScape record, which is a founder
-- decision, not a rollback step. The DELETE below deliberately does NOT cascade
-- to objects — if any exist it fails closed on the foreign key.

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS intentscape_wiki_tenant_select ON storage.objects;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    DELETE FROM storage.buckets WHERE id = 'intentscape-wiki';
  END IF;
END $$;

-- The ledger row is NOT removed here. To re-apply:
--
--   DELETE FROM _prisma_migrations
--   WHERE migration_name = '20260804000100_intentscape_storage_bucket';
--
-- POST-ROLLBACK VERIFICATION (expect zero rows from both):
--
--   SELECT id FROM storage.buckets WHERE id = 'intentscape-wiki';
--   SELECT policyname FROM pg_policies
--   WHERE schemaname = 'storage' AND policyname = 'intentscape_wiki_tenant_select';
