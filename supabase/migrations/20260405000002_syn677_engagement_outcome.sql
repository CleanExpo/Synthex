-- ============================================================
-- SYN-677: Engagement Outcome — Journey Instrumentation
-- Applied: 2026-04-05
--
-- Adds `engagement_outcome` to `client_journey_events`.
-- Tracks how each delivered journey moment was acted upon.
--
-- Taxonomy:
--   delivered   — email/message sent (default, always set on insert)
--   clicked     — client clicked a tracked link in the email
--   replied     — client replied to the email (future: reply-detect webhook)
--   surveyed    — client responded to pulse survey (GET /api/journey/pulse)
--   acted       — client completed a recommended action in the app
--   dismissed   — client explicitly dismissed the message
--   ignored     — no engagement after N days (future: set by scheduled job)
-- ============================================================

ALTER TABLE IF EXISTS client_journey_events
  ADD COLUMN IF NOT EXISTS engagement_outcome TEXT NOT NULL DEFAULT 'delivered'
    CONSTRAINT client_journey_events_engagement_outcome_check
    CHECK (engagement_outcome IN (
      'delivered',
      'clicked',
      'replied',
      'surveyed',
      'acted',
      'dismissed',
      'ignored'
    ));

-- Index for analytics queries filtering by outcome
DO $$ BEGIN
  IF to_regclass('public.client_journey_events') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS client_journey_events_outcome
      ON client_journey_events (engagement_outcome);
  END IF;
END $$;

-- Composite index: client engagement funnel queries
DO $$ BEGIN
  IF to_regclass('public.client_journey_events') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS client_journey_events_client_outcome
      ON client_journey_events (client_id, engagement_outcome, delivered_at DESC);
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.client_journey_events') IS NOT NULL THEN
    COMMENT ON COLUMN client_journey_events.engagement_outcome IS
      'Lifecycle outcome of this journey event. Progresses from ''delivered'' as the client takes action. Values: delivered | clicked | replied | surveyed | acted | dismissed | ignored';
  END IF;
END $$;
