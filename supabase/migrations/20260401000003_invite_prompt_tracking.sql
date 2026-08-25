-- SYN-597: Team invite prompt tracking on organizations table
-- Adds two nullable columns for dismiss state tracking.
-- Backward-compatible: both columns have defaults.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS invite_prompt_dismissed_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invite_prompt_dismiss_count INT         NOT NULL DEFAULT 0;
