-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Drop Drift Batches 1+2+3 (SYN-857)
-- CEO-approved 2026-05-01: "Approve schema 1, 2, and 3"
-- Phase 1 validation report: .claude/scratchpad/schema-drift-validation-2026-05-01.md
--
-- Drops 13 tables that have:
--   - Zero Prisma client references
--   - Zero Supabase REST writers (.from('...'))
--   - Zero raw SQL ($queryRaw / $executeRaw / FROM / INSERT INTO)
--   - Zero dynamic accessors ((prisma as any).model)
--   - Either no incoming relations OR relations only from other models in this drop set
--
-- Rollback: Supabase Point-In-Time Recovery (PITR) — 24-hour window per project plan.
--   Apply via Supabase dashboard → Database → Backups if rollback needed.
--   PITR is the project's documented rollback path (CLAUDE.md DB migration standard).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Batch 3: Competitor Intelligence v2 (drop child tables FIRST)
DROP TABLE IF EXISTS "competitor_alerts" CASCADE;
DROP TABLE IF EXISTS "competitor_posts" CASCADE;
DROP TABLE IF EXISTS "competitor_snapshots" CASCADE;
DROP TABLE IF EXISTS "competitor_comparisons" CASCADE;

-- Batch 2: Reporting v2 (drop ReportDelivery first, then ScheduledReport, then ReportTemplate)
DROP TABLE IF EXISTS "report_deliveries" CASCADE;
DROP TABLE IF EXISTS "scheduled_reports" CASCADE;
DROP TABLE IF EXISTS "report_templates" CASCADE;

-- Batch 1: remaining single-table drops
DROP TABLE IF EXISTS "marketplace_orders" CASCADE;
DROP TABLE IF EXISTS "seasonal_signals_runs" CASCADE;
DROP TABLE IF EXISTS "sentiment_trends" CASCADE;
DROP TABLE IF EXISTS "content_access_logs" CASCADE;
DROP TABLE IF EXISTS "engagement_predictions" CASCADE;
DROP TABLE IF EXISTS "quote_collections" CASCADE;

COMMIT;
