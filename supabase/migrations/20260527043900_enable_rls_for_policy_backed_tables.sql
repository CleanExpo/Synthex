-- ============================================================================
-- Migration: 20260527043900_enable_rls_for_policy_backed_tables
-- Purpose:   Enable RLS for tables that already have tenant-scoped policies in
--            the Phase 2 RLS batch but lacked matching ENABLE RLS statements.
-- Trace:     SYN-971
-- ============================================================================
--
-- This migration intentionally does not invent new policies. It only activates
-- RLS for tables whose policy pairs already exist in:
--
--   20260516130242_rls_batch_1_tenant_scoped_no_policy.sql
--
-- Remaining uncovered tables must be handled in later reviewed batches with
-- table-specific policy design or documented service-role/public exemptions.

ALTER TABLE IF EXISTS public.autopilot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.competitor_keyword_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content_improvement_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content_performance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content_topic_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ga4_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gbp_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gbp_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gsc_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gsc_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.keyword_rank_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.keyword_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.monthly_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.seasonal_signal_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.story_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.visibility_scores ENABLE ROW LEVEL SECURITY;
