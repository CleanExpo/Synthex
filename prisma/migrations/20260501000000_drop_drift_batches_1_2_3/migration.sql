-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Drop 7 confirmed-drift tables (SYN-857)
-- CEO-approved 2026-05-01: "Approve schema 1, 2, and 3"
-- Phase 1 validation report: .claude/scratchpad/schema-drift-validation-2026-05-01.md
-- Phase 1.5 false-negative correction 2026-05-01:
--   6 of the originally-approved 13 tables turned out to back live routes
--   via dynamic accessors (prisma as Foo) that the audit grep missed.
--   They have been restored. Only the 7 truly-drift tables drop here.
--
-- Restored (NOT dropped):
--   scheduled_reports, report_templates, report_deliveries (used by
--     /api/reports/scheduled, /api/reports/templates, use-report-templates hook)
--   competitor_alerts, competitor_posts, competitor_snapshots (used by
--     /api/competitors/track via _count include + relation include)
--
-- Dropped (genuinely drift, zero callers anywhere):
--   marketplace_orders, seasonal_signals_runs, sentiment_trends,
--   content_access_logs, engagement_predictions, quote_collections,
--   competitor_comparisons
--
-- Rollback: Supabase Point-In-Time Recovery (PITR) — 24-hour window
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP TABLE IF EXISTS "marketplace_orders" CASCADE;
DROP TABLE IF EXISTS "seasonal_signals_runs" CASCADE;
DROP TABLE IF EXISTS "sentiment_trends" CASCADE;
DROP TABLE IF EXISTS "content_access_logs" CASCADE;
DROP TABLE IF EXISTS "engagement_predictions" CASCADE;
DROP TABLE IF EXISTS "quote_collections" CASCADE;
DROP TABLE IF EXISTS "competitor_comparisons" CASCADE;

COMMIT;
