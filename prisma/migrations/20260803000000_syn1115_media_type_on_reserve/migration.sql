-- SYN-1115 (release review, pass 2) — record WHAT a hold was taken for.
--
-- The stale sweep could not tell an IMAGE hold from a VIDEO hold stranded
-- before its `video_generations` row existed: neither has an owner row. It
-- therefore settled both at zero when no attempt evidence survived.
--
-- Because spend is derived as SUM(delta_usd), settling at zero does not merely
-- lose accuracy — it FORGETS real provider spend and returns the headroom, so
-- the organisation can be admitted for further work beyond its cap. That is an
-- admission defect, which is why this could not stay a documented residual.
--
-- Nullable: rows written before this column existed carry no media type and
-- keep the old conservative treatment.
ALTER TABLE "media_spend_events" ADD COLUMN "media_type" TEXT;

-- Backfill what is knowable. A reserve event whose hold is referenced by a
-- video job is unambiguously video; everything else stays NULL rather than
-- being guessed, so an unknown row is never mistaken for a proven one.
UPDATE "media_spend_events" e
SET media_type = 'video'
WHERE e.media_type IS NULL
  AND EXISTS (
    SELECT 1 FROM "video_generations" v WHERE v.spend_hold_id = e.hold_id
  );

-- Provider attempts already record their media type, so a hold with attempts
-- can be classified from them too.
UPDATE "media_spend_events" e
SET media_type = a.media_type
FROM (
  SELECT DISTINCT hold_id, media_type FROM "media_provider_attempts"
) a
WHERE e.media_type IS NULL
  AND a.hold_id = e.hold_id;
