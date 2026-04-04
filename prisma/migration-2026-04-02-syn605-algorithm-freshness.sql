-- ============================================================
-- SYN-605: Algorithm Freshness Monitor — schema additions
-- Applied: 2026-04-02
--
-- What this does:
--   1. Adds needs_review flag + reason to ranking_signals
--   2. Adds detectedDate, platform, signalsAffected, reviewed,
--      reviewedDate, linearIssueId columns to algorithm_updates
--      (table already exists from prior migration)
--   3. Creates supporting indexes
-- ============================================================

-- ── 1. ranking_signals freshness flags ──────────────────────
ALTER TABLE ranking_signals
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS needs_review_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_ranking_signals_needs_review
  ON ranking_signals(needs_review);

-- ── 2. algorithm_updates — add SYN-605 columns ─────────────
ALTER TABLE algorithm_updates
  ADD COLUMN IF NOT EXISTS "detectedDate"    DATE        NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS "platform"        TEXT,
  ADD COLUMN IF NOT EXISTS "signalsAffected" TEXT[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "reviewed"        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "reviewedDate"    DATE,
  ADD COLUMN IF NOT EXISTS "linearIssueId"   TEXT;

CREATE INDEX IF NOT EXISTS idx_algorithm_updates_platform ON algorithm_updates("platform");
CREATE INDEX IF NOT EXISTS idx_algorithm_updates_reviewed ON algorithm_updates("reviewed");
CREATE INDEX IF NOT EXISTS idx_algorithm_updates_detected ON algorithm_updates("detectedDate" DESC);
