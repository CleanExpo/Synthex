-- Rollback for 20260802000000_syn1115_media_spend_events (SYN-1115).
--
-- Drops the spend event log and the video link column. All derived spend
-- history is lost, so export first if any window is unreconciled:
--
--   COPY (SELECT * FROM public.media_spend_events) TO '/tmp/media_spend_events.csv' CSV HEADER;

ALTER TABLE "video_generations" DROP COLUMN IF EXISTS "spend_hold_id";
DROP TABLE IF EXISTS "media_spend_events";
