-- Rollback for 20260802000000_syn1115_media_spend_events (SYN-1115).
--
-- Drops the attempt log, the spend event log and the video link column.
-- All derived spend history AND the record of what providers actually charged
-- are lost, so export both before dropping if any window is unreconciled:
--
--   COPY (SELECT * FROM public.media_provider_attempts) TO '/tmp/media_provider_attempts.csv' CSV HEADER;
--   COPY (SELECT * FROM public.media_spend_events)      TO '/tmp/media_spend_events.csv' CSV HEADER;
--
-- NOTE: the counter columns on organization_video_quotas were left intact by
-- the forward migration precisely so this rollback lands on a working ceiling.
-- They are stale by the amount spent since cutover; re-seed them from the
-- exported events if the gap matters.

ALTER TABLE "video_generations" DROP COLUMN IF EXISTS "spend_hold_id";
DROP TABLE IF EXISTS "media_provider_attempts";
DROP TABLE IF EXISTS "media_spend_events";
