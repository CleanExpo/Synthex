-- Rollback for 20260802000000_syn1115_media_spend_events (SYN-1115).
--
-- Drops the spend event log. Spend history derived from it is lost, so export
-- first if any window has not yet been reconciled elsewhere:
--
--   COPY (SELECT * FROM public.media_spend_events)
--   TO '/tmp/media_spend_events.csv' CSV HEADER;

DROP TABLE IF EXISTS "media_spend_events";
