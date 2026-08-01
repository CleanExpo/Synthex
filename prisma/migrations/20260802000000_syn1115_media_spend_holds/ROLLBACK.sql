-- Rollback for 20260802000000_syn1115_media_spend_holds (SYN-1115).
--
-- Drops the durable hold ledger. Any open holds recorded here are lost, so
-- export before dropping if reconciliation is still outstanding:
--
--   COPY (SELECT * FROM public.media_spend_holds WHERE status = 'open')
--   TO '/tmp/open_media_holds.csv' CSV HEADER;

DROP TABLE IF EXISTS "media_spend_holds";
