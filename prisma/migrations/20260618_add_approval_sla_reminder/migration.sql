-- Backlog #12 — approvals SLA reminders.
-- Additive, backward-compatible: a single nullable timestamp on the existing
-- (already RLS-enabled) approval_requests table. Stamped by the
-- approval-sla-reminder cron once an overdue reminder has been sent, so the
-- daily run does not re-notify the submitter on every pass.
ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS sla_reminder_sent_at TIMESTAMP(3);
