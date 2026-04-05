-- Migration: Add engagement_outcome to client_journey_events — SYN-677
--
-- Tracks what happened after a journey event was delivered:
--   delivered  → default; sent but no further action observed
--   clicked    → client clicked a tracked link in the email
--   replied    → client replied to the email (manual tagging)
--   surveyed   → client completed a pulse survey
--   acted      → client completed a high-value action (booking, etc.)
--   dismissed  → client explicitly dismissed or unsubscribed
--   ignored    → no engagement after 7+ days (set by a background sweep)

ALTER TABLE client_journey_events
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

-- Index for outcome-based analytics queries
CREATE INDEX IF NOT EXISTS client_journey_events_outcome_idx
  ON client_journey_events (engagement_outcome);

-- Composite index for per-client outcome queries (used by journey_analytics view)
CREATE INDEX IF NOT EXISTS client_journey_events_client_outcome_idx
  ON client_journey_events (client_id, engagement_outcome);
