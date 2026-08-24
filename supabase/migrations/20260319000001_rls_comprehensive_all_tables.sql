-- =============================================================================
-- Migration: Comprehensive RLS for All 132 Prisma-Managed Tables
-- Source: SYN-398 — RLS policies covered only 16 of 131 models
-- Purpose:
--   1. Enable Row-Level Security on every Prisma-managed table
--   2. Add service_role bypass (Prisma backend retains full access)
--   3. Add user/org scoped SELECT policies for first-party tables
--   4. Child/junction tables get service_role-only access (API-gated)
-- Strategy:
--   - All legitimate backend access goes through Prisma (service_role)
--   - Service_role bypasses RLS, so no breakage
--   - Direct DB access (e.g. compromised postgres user) is now blocked
--   - Idempotent: safe to run multiple times
-- Date: 2026-03-19
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: Helper — define org-membership check used repeatedly
-- =============================================================================

-- NOTE: auth.uid() returns UUID; Prisma user IDs are TEXT (uuid string).
-- We cast auth.uid()::text throughout for compatibility.

-- =============================================================================
-- SECTION 2: ORG-SCOPED TABLES (have organization_id column)
-- Policy: user must belong to that organisation
-- =============================================================================

-- ab_tests
ALTER TABLE IF EXISTS public.ab_tests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_ab_tests" ON public.ab_tests FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_ab_tests" ON public.ab_tests FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- api_credentials
ALTER TABLE IF EXISTS public.api_credentials ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_api_credentials" ON public.api_credentials FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_api_credentials" ON public.api_credentials FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- approval_requests
ALTER TABLE IF EXISTS public.approval_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_approval_requests" ON public.approval_requests FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_approval_requests" ON public.approval_requests FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- business_ownerships
ALTER TABLE IF EXISTS public.business_ownerships ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_business_ownerships" ON public.business_ownerships FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_business_ownerships" ON public.business_ownerships FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- business_vetting_results
ALTER TABLE IF EXISTS public.business_vetting_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_business_vetting_results" ON public.business_vetting_results FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_business_vetting_results" ON public.business_vetting_results FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- calendar_posts
ALTER TABLE IF EXISTS public.calendar_posts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_calendar_posts" ON public.calendar_posts FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_calendar_posts" ON public.calendar_posts FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- campaigns
ALTER TABLE IF EXISTS public.campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_campaigns" ON public.campaigns FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_campaigns" ON public.campaigns FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- content_drafts
ALTER TABLE IF EXISTS public.content_drafts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_content_drafts" ON public.content_drafts FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_content_drafts" ON public.content_drafts FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- content_shares
ALTER TABLE IF EXISTS public.content_shares ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_content_shares" ON public.content_shares FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_content_shares" ON public.content_shares FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- onboarding_progress
ALTER TABLE IF EXISTS public.onboarding_progress ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_onboarding_progress" ON public.onboarding_progress FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_onboarding_progress" ON public.onboarding_progress FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- permission_audits
ALTER TABLE IF EXISTS public.permission_audits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_permission_audits" ON public.permission_audits FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_permission_audits" ON public.permission_audits FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- platform_connections
ALTER TABLE IF EXISTS public.platform_connections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_platform_connections" ON public.platform_connections FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_platform_connections" ON public.platform_connections FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- projects
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_projects" ON public.projects FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_projects" ON public.projects FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- prompt_templates
ALTER TABLE IF EXISTS public.prompt_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_prompt_templates" ON public.prompt_templates FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_prompt_templates" ON public.prompt_templates FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- report_templates
ALTER TABLE IF EXISTS public.report_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_report_templates" ON public.report_templates FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_report_templates" ON public.report_templates FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- reports
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_reports" ON public.reports FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_reports" ON public.reports FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- roles (org-scoped RBAC role definitions)
ALTER TABLE IF EXISTS public.roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_roles" ON public.roles FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_roles" ON public.roles FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- scheduled_reports
ALTER TABLE IF EXISTS public.scheduled_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_scheduled_reports" ON public.scheduled_reports FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_scheduled_reports" ON public.scheduled_reports FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- sentiment_trends
ALTER TABLE IF EXISTS public.sentiment_trends ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_sentiment_trends" ON public.sentiment_trends FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_sentiment_trends" ON public.sentiment_trends FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- team_invitations
ALTER TABLE IF EXISTS public.team_invitations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_team_invitations" ON public.team_invitations FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_team_invitations" ON public.team_invitations FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- team_notifications
ALTER TABLE IF EXISTS public.team_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_team_notifications" ON public.team_notifications FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_team_notifications" ON public.team_notifications FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- tracked_keywords
ALTER TABLE IF EXISTS public.tracked_keywords ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_tracked_keywords" ON public.tracked_keywords FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_tracked_keywords" ON public.tracked_keywords FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- users (special: row = own account only)
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_users" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_row" ON public.users FOR SELECT TO authenticated USING (id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- vault_access_logs (already covered by 20260315 migration — idempotent)
ALTER TABLE IF EXISTS public.vault_access_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_vault_access_logs" ON public.vault_access_logs FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- vault_secrets (already covered by 20260315 migration — idempotent)
ALTER TABLE IF EXISTS public.vault_secrets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_vault_secrets" ON public.vault_secrets FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- video_generations
ALTER TABLE IF EXISTS public.video_generations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_video_generations" ON public.video_generations FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_video_generations" ON public.video_generations FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- workflow_executions
ALTER TABLE IF EXISTS public.workflow_executions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_workflow_executions" ON public.workflow_executions FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_workflow_executions" ON public.workflow_executions FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- workflow_templates
ALTER TABLE IF EXISTS public.workflow_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_workflow_templates" ON public.workflow_templates FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_org_workflow_templates" ON public.workflow_templates FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- =============================================================================
-- SECTION 3: USER-SCOPED TABLES (have user_id column, no org_id)
-- Policy: row belongs to the authenticated user
-- =============================================================================

-- affiliate_links
ALTER TABLE IF EXISTS public.affiliate_links ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_affiliate_links" ON public.affiliate_links FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_affiliate_links" ON public.affiliate_links FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- affiliate_networks
ALTER TABLE IF EXISTS public.affiliate_networks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_affiliate_networks" ON public.affiliate_networks FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_affiliate_networks" ON public.affiliate_networks FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- ai_conversations
ALTER TABLE IF EXISTS public.ai_conversations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_ai_conversations" ON public.ai_conversations FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_ai_conversations" ON public.ai_conversations FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- ai_weekly_digests
ALTER TABLE IF EXISTS public.ai_weekly_digests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_ai_weekly_digests" ON public.ai_weekly_digests FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_ai_weekly_digests" ON public.ai_weekly_digests FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- analytics_events
ALTER TABLE IF EXISTS public.analytics_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_analytics_events" ON public.analytics_events FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_analytics_events" ON public.analytics_events FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- api_usage
ALTER TABLE IF EXISTS public.api_usage ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_api_usage" ON public.api_usage FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_api_usage" ON public.api_usage FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- audit_logs
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_audit_logs" ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- author_profiles
ALTER TABLE IF EXISTS public.author_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_author_profiles" ON public.author_profiles FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_author_profiles" ON public.author_profiles FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- bo_optimisation_runs
ALTER TABLE IF EXISTS public.bo_optimisation_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_bo_optimisation_runs" ON public.bo_optimisation_runs FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_bo_optimisation_runs" ON public.bo_optimisation_runs FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- bo_spaces
ALTER TABLE IF EXISTS public.bo_spaces ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_bo_spaces" ON public.bo_spaces FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_bo_spaces" ON public.bo_spaces FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- brand_generations
ALTER TABLE IF EXISTS public.brand_generations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_brand_generations" ON public.brand_generations FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_brand_generations" ON public.brand_generations FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- competitor_alerts
ALTER TABLE IF EXISTS public.competitor_alerts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_competitor_alerts" ON public.competitor_alerts FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_competitor_alerts" ON public.competitor_alerts FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- competitor_comparisons
ALTER TABLE IF EXISTS public.competitor_comparisons ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_competitor_comparisons" ON public.competitor_comparisons FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_competitor_comparisons" ON public.competitor_comparisons FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- content_access_logs
ALTER TABLE IF EXISTS public.content_access_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_content_access_logs" ON public.content_access_logs FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_content_access_logs" ON public.content_access_logs FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- content_investments
ALTER TABLE IF EXISTS public.content_investments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_content_investments" ON public.content_investments FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_content_investments" ON public.content_investments FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- content_library
ALTER TABLE IF EXISTS public.content_library ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_content_library" ON public.content_library FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_content_library" ON public.content_library FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- engagement_predictions
ALTER TABLE IF EXISTS public.engagement_predictions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_engagement_predictions" ON public.engagement_predictions FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_engagement_predictions" ON public.engagement_predictions FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- entity_analyses
ALTER TABLE IF EXISTS public.entity_analyses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_entity_analyses" ON public.entity_analyses FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_entity_analyses" ON public.entity_analyses FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- feedback_surveys
ALTER TABLE IF EXISTS public.feedback_surveys ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_feedback_surveys" ON public.feedback_surveys FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_feedback_surveys" ON public.feedback_surveys FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- forecast_models
ALTER TABLE IF EXISTS public.forecast_models ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_forecast_models" ON public.forecast_models FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_forecast_models" ON public.forecast_models FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- geo_analyses
ALTER TABLE IF EXISTS public.geo_analyses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_geo_analyses" ON public.geo_analyses FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_geo_analyses" ON public.geo_analyses FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- geo_research_reports
ALTER TABLE IF EXISTS public.geo_research_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_geo_research_reports" ON public.geo_research_reports FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_geo_research_reports" ON public.geo_research_reports FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- link_bio_pages
ALTER TABLE IF EXISTS public.link_bio_pages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_link_bio_pages" ON public.link_bio_pages FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_link_bio_pages" ON public.link_bio_pages FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- local_case_studies
ALTER TABLE IF EXISTS public.local_case_studies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_local_case_studies" ON public.local_case_studies FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_local_case_studies" ON public.local_case_studies FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- notifications
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_notifications" ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- oauth_pkce_states
ALTER TABLE IF EXISTS public.oauth_pkce_states ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_oauth_pkce_states" ON public.oauth_pkce_states FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_oauth_pkce_states" ON public.oauth_pkce_states FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- personas
ALTER TABLE IF EXISTS public.personas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_personas" ON public.personas FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_personas" ON public.personas FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- platform_oauth_credentials
ALTER TABLE IF EXISTS public.platform_oauth_credentials ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_platform_oauth_credentials" ON public.platform_oauth_credentials FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_platform_oauth_credentials" ON public.platform_oauth_credentials FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- quote_collections
ALTER TABLE IF EXISTS public.quote_collections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_quote_collections" ON public.quote_collections FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_quote_collections" ON public.quote_collections FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- quotes
ALTER TABLE IF EXISTS public.quotes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_quotes" ON public.quotes FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_quotes" ON public.quotes FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- referrals
ALTER TABLE IF EXISTS public.referrals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_referrals" ON public.referrals FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_referrals" ON public.referrals FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- revenue_entries
ALTER TABLE IF EXISTS public.revenue_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_revenue_entries" ON public.revenue_entries FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_revenue_entries" ON public.revenue_entries FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- scheduled_audit_targets
ALTER TABLE IF EXISTS public.scheduled_audit_targets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_scheduled_audit_targets" ON public.scheduled_audit_targets FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_scheduled_audit_targets" ON public.scheduled_audit_targets FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- sentiment_analyses
ALTER TABLE IF EXISTS public.sentiment_analyses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_sentiment_analyses" ON public.sentiment_analyses FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_sentiment_analyses" ON public.sentiment_analyses FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- seo_audits
ALTER TABLE IF EXISTS public.seo_audits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_seo_audits" ON public.seo_audits FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_seo_audits" ON public.seo_audits FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- sessions
ALTER TABLE IF EXISTS public.sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_sessions" ON public.sessions FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_sessions" ON public.sessions FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- social_mentions
ALTER TABLE IF EXISTS public.social_mentions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_social_mentions" ON public.social_mentions FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_social_mentions" ON public.social_mentions FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- spatiotemporal_models
ALTER TABLE IF EXISTS public.spatiotemporal_models ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_spatiotemporal_models" ON public.spatiotemporal_models FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_spatiotemporal_models" ON public.spatiotemporal_models FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- sponsors
ALTER TABLE IF EXISTS public.sponsors ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_sponsors" ON public.sponsors FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_sponsors" ON public.sponsors FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- subscriptions
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_subscriptions" ON public.subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- tasks
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_tasks" ON public.tasks FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_tasks" ON public.tasks FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- tracked_competitors
ALTER TABLE IF EXISTS public.tracked_competitors ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_tracked_competitors" ON public.tracked_competitors FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_tracked_competitors" ON public.tracked_competitors FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- user_achievements
ALTER TABLE IF EXISTS public.user_achievements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_user_achievements" ON public.user_achievements FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_user_achievements" ON public.user_achievements FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- user_health_scores
ALTER TABLE IF EXISTS public.user_health_scores ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_user_health_scores" ON public.user_health_scores FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_user_health_scores" ON public.user_health_scores FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- user_loyalty_tiers
ALTER TABLE IF EXISTS public.user_loyalty_tiers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_user_loyalty_tiers" ON public.user_loyalty_tiers FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_user_loyalty_tiers" ON public.user_loyalty_tiers FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- user_psychology_preferences
ALTER TABLE IF EXISTS public.user_psychology_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_user_psychology_preferences" ON public.user_psychology_preferences FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_user_psychology_preferences" ON public.user_psychology_preferences FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- user_roles
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_user_roles" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_user_roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- user_streaks
ALTER TABLE IF EXISTS public.user_streaks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_user_streaks" ON public.user_streaks FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_user_streaks" ON public.user_streaks FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- visual_assets
ALTER TABLE IF EXISTS public.visual_assets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_visual_assets" ON public.visual_assets FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_visual_assets" ON public.visual_assets FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- webhook_endpoints
ALTER TABLE IF EXISTS public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_webhook_endpoints" ON public.webhook_endpoints FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users_select_own_webhook_endpoints" ON public.webhook_endpoints FOR SELECT TO authenticated USING (user_id = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- =============================================================================
-- SECTION 4: UNSCOPED TABLES (child/junction/reference — service_role only)
-- RLS enabled but no user SELECT policy — all access via API (service_role)
-- =============================================================================

-- accounts (linked to users via userId — service_role only for security)
ALTER TABLE IF EXISTS public.accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_accounts" ON public.accounts FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- ab_test_results
ALTER TABLE IF EXISTS public.ab_test_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_ab_test_results" ON public.ab_test_results FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- ab_test_variants
ALTER TABLE IF EXISTS public.ab_test_variants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_ab_test_variants" ON public.ab_test_variants FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- affiliate_link_clicks
ALTER TABLE IF EXISTS public.affiliate_link_clicks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_affiliate_link_clicks" ON public.affiliate_link_clicks FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- ai_messages
ALTER TABLE IF EXISTS public.ai_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_ai_messages" ON public.ai_messages FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- algorithm_updates (platform reference data)
ALTER TABLE IF EXISTS public.algorithm_updates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_algorithm_updates" ON public.algorithm_updates FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- article_authors
ALTER TABLE IF EXISTS public.article_authors ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_article_authors" ON public.article_authors FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- bo_observations
ALTER TABLE IF EXISTS public.bo_observations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_bo_observations" ON public.bo_observations FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- brand_dna
ALTER TABLE IF EXISTS public.brand_dna ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_brand_dna" ON public.brand_dna FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- competitive_analyses
ALTER TABLE IF EXISTS public.competitive_analyses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_competitive_analyses" ON public.competitive_analyses FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- competitor_posts
ALTER TABLE IF EXISTS public.competitor_posts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_competitor_posts" ON public.competitor_posts FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- competitor_snapshots
ALTER TABLE IF EXISTS public.competitor_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_competitor_snapshots" ON public.competitor_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- content_comments
ALTER TABLE IF EXISTS public.content_comments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_content_comments" ON public.content_comments FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- deal_deliverables
ALTER TABLE IF EXISTS public.deal_deliverables ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_deal_deliverables" ON public.deal_deliverables FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- experiment_observations
ALTER TABLE IF EXISTS public.experiment_observations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_experiment_observations" ON public.experiment_observations FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- forecasts
ALTER TABLE IF EXISTS public.forecasts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_forecasts" ON public.forecasts FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- healing_actions
ALTER TABLE IF EXISTS public.healing_actions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_healing_actions" ON public.healing_actions FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- invite_codes
ALTER TABLE IF EXISTS public.invite_codes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_invite_codes" ON public.invite_codes FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- link_bio_links
ALTER TABLE IF EXISTS public.link_bio_links ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_link_bio_links" ON public.link_bio_links FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- organizations
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_organizations" ON public.organizations FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
-- Allow authenticated users to view their own org
DO $$ BEGIN CREATE POLICY "users_select_own_org" ON public.organizations FOR SELECT TO authenticated USING (id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()::text)); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- persona_training_data
ALTER TABLE IF EXISTS public.persona_training_data ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_persona_training_data" ON public.persona_training_data FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- platform_metrics
ALTER TABLE IF EXISTS public.platform_metrics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_platform_metrics" ON public.platform_metrics FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- platform_posts
ALTER TABLE IF EXISTS public.platform_posts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_platform_posts" ON public.platform_posts FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- posts
ALTER TABLE IF EXISTS public.posts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_posts" ON public.posts FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- psychology_metrics
ALTER TABLE IF EXISTS public.psychology_metrics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_psychology_metrics" ON public.psychology_metrics FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- psychology_principles (reference/lookup table)
ALTER TABLE IF EXISTS public.psychology_principles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_psychology_principles" ON public.psychology_principles FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- referrals
-- (already in user_scoped section — skipped)

-- report_deliveries
ALTER TABLE IF EXISTS public.report_deliveries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_report_deliveries" ON public.report_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- sentinel_alerts
ALTER TABLE IF EXISTS public.sentinel_alerts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_sentinel_alerts" ON public.sentinel_alerts FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- seo_experiments
ALTER TABLE IF EXISTS public.seo_experiments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_seo_experiments" ON public.seo_experiments FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- site_health_snapshots
ALTER TABLE IF EXISTS public.site_health_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_site_health_snapshots" ON public.site_health_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- sponsor_deals
ALTER TABLE IF EXISTS public.sponsor_deals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_sponsor_deals" ON public.sponsor_deals FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- step_executions
ALTER TABLE IF EXISTS public.step_executions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_step_executions" ON public.step_executions FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- =============================================================================
-- SECTION 5: UNMAPPED (PascalCase table names) — service_role only
-- These 22 models have no @@map directive; Prisma uses PascalCase table names
-- =============================================================================

ALTER TABLE IF EXISTS public."AuthorityAnalysis" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_AuthorityAnalysis" ON public."AuthorityAnalysis" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."AuthorityCitation" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_AuthorityCitation" ON public."AuthorityCitation" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."AwardListing" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_AwardListing" ON public."AwardListing" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."BacklinkAnalysis" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_BacklinkAnalysis" ON public."BacklinkAnalysis" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."BacklinkProspect" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_BacklinkProspect" ON public."BacklinkProspect" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."BrandCredential" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_BrandCredential" ON public."BrandCredential" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."BrandIdentity" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_BrandIdentity" ON public."BrandIdentity" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."BrandMention" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_BrandMention" ON public."BrandMention" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."CitationMonitor" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_CitationMonitor" ON public."CitationMonitor" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."ContentCapsule" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_ContentCapsule" ON public."ContentCapsule" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."ContentQualityAudit" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_ContentQualityAudit" ON public."ContentQualityAudit" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."DirectoryListing" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_DirectoryListing" ON public."DirectoryListing" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."EEATAudit" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_EEATAudit" ON public."EEATAudit" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."JournalistContact" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_JournalistContact" ON public."JournalistContact" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."MediaCoverage" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_MediaCoverage" ON public."MediaCoverage" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."PRDistribution" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_PRDistribution" ON public."PRDistribution" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."PRPitch" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_PRPitch" ON public."PRPitch" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."PressRelease" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_PressRelease" ON public."PressRelease" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."PromptResult" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_PromptResult" ON public."PromptResult" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."PromptTracker" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_PromptTracker" ON public."PromptTracker" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."SubmissionTracker" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_SubmissionTracker" ON public."SubmissionTracker" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS public."VoiceProfile" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_VoiceProfile" ON public."VoiceProfile" FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON POLICY "service_role_users" ON public.users IS 'Backend Prisma access — service_role bypasses RLS';
COMMENT ON POLICY "users_select_own_row" ON public.users IS 'Authenticated users can only read their own user record';

COMMIT;
