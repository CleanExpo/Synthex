-- =================================================================
-- 04_policies.sql - Row-Level Security & Multi-Tenant Isolation
-- Generated: 2025-08-13
-- Purpose: Implement RLS policies for data isolation and security
-- =================================================================

BEGIN;

-- =================================================================
-- PART 1: Enable RLS on Tables
-- =================================================================

-- Enable RLS on all user-facing tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE psychology_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_psychology_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitive_analyses ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- PART 2: Helper Functions for RLS
-- =================================================================

-- Get current user ID (from JWT or session)
CREATE OR REPLACE FUNCTION auth.user_id() RETURNS TEXT AS $$
BEGIN
    -- For Supabase: auth.uid()
    -- For custom: current_setting('app.user_id', true)
    RETURN COALESCE(
        current_setting('app.user_id', true),
        auth.uid()::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's organization ID
CREATE OR REPLACE FUNCTION auth.organization_id() RETURNS TEXT AS $$
DECLARE
    org_id TEXT;
BEGIN
    SELECT "organizationId" INTO org_id
    FROM users
    WHERE id = auth.user_id()
    AND deleted_at IS NULL;
    
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin() RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    -- Check if user has admin role in preferences or is in admin table
    SELECT 
        CASE 
            WHEN preferences->>'role' = 'admin' THEN true
            WHEN email IN ('admin@synthex.social', 'support@synthex.social') THEN true
            ELSE false
        END INTO is_admin
    FROM users
    WHERE id = auth.user_id()
    AND deleted_at IS NULL;
    
    RETURN COALESCE(is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user belongs to organization
CREATE OR REPLACE FUNCTION auth.in_organization(org_id TEXT) RETURNS BOOLEAN AS $$
DECLARE
    belongs BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM users
        WHERE id = auth.user_id()
        AND "organizationId" = org_id
        AND deleted_at IS NULL
    ) INTO belongs;
    
    RETURN belongs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================================================
-- PART 3: Users Table Policies
-- =================================================================

-- Users can view their own profile
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (id = auth.user_id() OR auth.is_admin());

-- Users can update their own profile
CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (id = auth.user_id())
    WITH CHECK (id = auth.user_id());

-- Users can view other users in same organization
CREATE POLICY users_select_org ON users
    FOR SELECT
    USING (
        "organizationId" IS NOT NULL 
        AND "organizationId" = auth.organization_id()
    );

-- Admins can manage all users
CREATE POLICY users_admin_all ON users
    FOR ALL
    USING (auth.is_admin())
    WITH CHECK (auth.is_admin());

-- =================================================================
-- PART 4: Campaigns Policies
-- =================================================================

-- Users can view their own campaigns
CREATE POLICY campaigns_select_own ON campaigns
    FOR SELECT
    USING ("userId" = auth.user_id());

-- Users can manage their own campaigns
CREATE POLICY campaigns_manage_own ON campaigns
    FOR ALL
    USING ("userId" = auth.user_id())
    WITH CHECK ("userId" = auth.user_id());

-- Organization members can view org campaigns
CREATE POLICY campaigns_select_org ON campaigns
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = campaigns."userId"
            AND u."organizationId" = auth.organization_id()
            AND u."organizationId" IS NOT NULL
        )
    );

-- =================================================================
-- PART 5: Posts Policies
-- =================================================================

-- Users can view posts from their campaigns
CREATE POLICY posts_select_own ON posts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = posts."campaignId"
            AND c."userId" = auth.user_id()
        )
    );

-- Users can manage posts in their campaigns
CREATE POLICY posts_manage_own ON posts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = posts."campaignId"
            AND c."userId" = auth.user_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = posts."campaignId"
            AND c."userId" = auth.user_id()
        )
    );

-- =================================================================
-- PART 6: Projects Policies
-- =================================================================

-- Users can view and manage their own projects
CREATE POLICY projects_own ON projects
    FOR ALL
    USING ("userId" = auth.user_id())
    WITH CHECK ("userId" = auth.user_id());

-- Organization members can view org projects
CREATE POLICY projects_org_select ON projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = projects."userId"
            AND u."organizationId" = auth.organization_id()
            AND u."organizationId" IS NOT NULL
        )
    );

-- =================================================================
-- PART 7: API Usage Policies
-- =================================================================

-- Users can view their own API usage
CREATE POLICY api_usage_own ON api_usage
    FOR SELECT
    USING ("userId" = auth.user_id());

-- Admins can view all API usage
CREATE POLICY api_usage_admin ON api_usage
    FOR SELECT
    USING (auth.is_admin());

-- =================================================================
-- PART 8: Notifications Policies
-- =================================================================

-- Users can only see and manage their own notifications
CREATE POLICY notifications_own ON notifications
    FOR ALL
    USING ("userId" = auth.user_id())
    WITH CHECK ("userId" = auth.user_id());

-- =================================================================
-- PART 9: Audit Logs Policies
-- =================================================================

-- Users can view their own audit logs
CREATE POLICY audit_logs_own ON audit_logs
    FOR SELECT
    USING ("userId" = auth.user_id());

-- Admins can view all audit logs
CREATE POLICY audit_logs_admin ON audit_logs
    FOR SELECT
    USING (auth.is_admin());

-- =================================================================
-- PART 10: Organizations Policies
-- =================================================================

-- Users can view their own organization
CREATE POLICY organizations_select_own ON organizations
    FOR SELECT
    USING (
        id = auth.organization_id()
        OR auth.is_admin()
    );

-- Organization admins can update their org
CREATE POLICY organizations_update_admin ON organizations
    FOR UPDATE
    USING (
        id = auth.organization_id()
        AND EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.user_id()
            AND preferences->>'orgRole' = 'admin'
        )
    )
    WITH CHECK (
        id = auth.organization_id()
    );

-- =================================================================
-- PART 11: Platform Connections Policies
-- =================================================================

-- Users can only manage their own platform connections
CREATE POLICY platform_connections_own ON platform_connections
    FOR ALL
    USING ("userId" = auth.user_id())
    WITH CHECK ("userId" = auth.user_id());

-- =================================================================
-- PART 12: Platform Posts Policies
-- =================================================================

-- Users can manage posts from their connections
CREATE POLICY platform_posts_own ON platform_posts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM platform_connections pc
            WHERE pc.id = platform_posts."connectionId"
            AND pc."userId" = auth.user_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM platform_connections pc
            WHERE pc.id = platform_posts."connectionId"
            AND pc."userId" = auth.user_id()
        )
    );

-- =================================================================
-- PART 13: Platform Metrics Policies
-- =================================================================

-- Users can view metrics for their posts
CREATE POLICY platform_metrics_select ON platform_metrics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM platform_posts pp
            JOIN platform_connections pc ON pc.id = pp."connectionId"
            WHERE pp.id = platform_metrics."postId"
            AND pc."userId" = auth.user_id()
        )
    );

-- =================================================================
-- PART 14: Team Invitations Policies
-- =================================================================

-- Users can view invitations they sent
CREATE POLICY team_invitations_sender ON team_invitations
    FOR SELECT
    USING ("userId" = auth.user_id());

-- Users can view invitations to their email
CREATE POLICY team_invitations_recipient ON team_invitations
    FOR SELECT
    USING (
        email = (SELECT email FROM users WHERE id = auth.user_id())
    );

-- Organization admins can manage org invitations
CREATE POLICY team_invitations_org_admin ON team_invitations
    FOR ALL
    USING (
        "organizationId" = auth.organization_id()
        AND EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.user_id()
            AND preferences->>'orgRole' = 'admin'
        )
    )
    WITH CHECK (
        "organizationId" = auth.organization_id()
    );

-- =================================================================
-- PART 15: Brand Generations Policies
-- =================================================================

-- Users can manage their own brand generations
CREATE POLICY brand_generations_own ON brand_generations
    FOR ALL
    USING ("userId" = auth.user_id())
    WITH CHECK ("userId" = auth.user_id());

-- =================================================================
-- PART 16: Psychology Metrics Policies
-- =================================================================

-- Users can view metrics for their generations
CREATE POLICY psychology_metrics_select ON psychology_metrics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM brand_generations bg
            WHERE bg.id = psychology_metrics."generationId"
            AND bg."userId" = auth.user_id()
        )
    );

-- =================================================================
-- PART 17: User Psychology Preferences Policies
-- =================================================================

-- Users can only manage their own preferences
CREATE POLICY user_psychology_preferences_own ON user_psychology_preferences
    FOR ALL
    USING ("userId" = auth.user_id())
    WITH CHECK ("userId" = auth.user_id());

-- =================================================================
-- PART 18: Competitive Analyses Policies
-- =================================================================

-- Users can view analyses for their generations
CREATE POLICY competitive_analyses_select ON competitive_analyses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM brand_generations bg
            WHERE bg.id = competitive_analyses."generationId"
            AND bg."userId" = auth.user_id()
        )
    );

-- =================================================================
-- PART 19: Service Account Bypass
-- =================================================================

-- Create role for service accounts that bypass RLS
CREATE ROLE service_account;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_account;

-- Create policy to allow service accounts to bypass RLS
CREATE POLICY service_account_bypass ON users
    FOR ALL
    USING (current_user = 'service_account')
    WITH CHECK (current_user = 'service_account');

-- Apply to all tables (repeat for each table)
-- Note: In production, be more selective about which tables service accounts can access

-- =================================================================
-- PART 20: Public/Anonymous Access Policies (if needed)
-- =================================================================

-- Example: Allow anonymous users to view public campaigns
-- CREATE POLICY campaigns_public_view ON campaigns
--     FOR SELECT
--     USING (settings->>'visibility' = 'public');

-- =================================================================
-- PART 21: Cross-Tenant Data Sharing (if needed)
-- =================================================================

-- Example: Allow viewing shared projects across organizations
-- CREATE POLICY projects_shared_view ON projects
--     FOR SELECT
--     USING (
--         data->>'shared' = 'true'
--         OR "userId" = auth.user_id()
--     );

COMMIT;

-- =================================================================
-- TESTING RLS POLICIES
-- =================================================================
-- To test RLS policies:
-- SET app.user_id = 'test-user-id';
-- SELECT * FROM campaigns; -- Should only see user's campaigns
-- RESET app.user_id;

-- =================================================================
-- ROLLBACK SCRIPT
-- =================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS users_select_own ON users;
-- DROP POLICY IF EXISTS users_update_own ON users;
-- DROP POLICY IF EXISTS users_select_org ON users;
-- DROP POLICY IF EXISTS users_admin_all ON users;
-- -- Continue for all policies...
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- -- Continue for all tables...
-- DROP FUNCTION IF EXISTS auth.user_id();
-- DROP FUNCTION IF EXISTS auth.organization_id();
-- DROP FUNCTION IF EXISTS auth.is_admin();
-- DROP FUNCTION IF EXISTS auth.in_organization();
-- DROP ROLE IF EXISTS service_account;
-- COMMIT;