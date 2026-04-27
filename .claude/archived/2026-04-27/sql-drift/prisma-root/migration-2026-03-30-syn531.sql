-- SYN-531: Add review response workflow fields to gbp_reviews
-- Adds responseStatus (workflow state) and dismissReason (calibration feedback)

ALTER TABLE gbp_reviews
  ADD COLUMN IF NOT EXISTS response_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS dismiss_reason TEXT;
