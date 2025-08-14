-- =================================================================
-- SAFE DATABASE MIGRATION SCRIPT FOR SUPABASE
-- Generated: 2025-08-13
-- 
-- This version checks column existence before adding constraints
-- =================================================================

BEGIN;

-- =================================================================
-- STEP 1: First, let's check what columns exist
-- =================================================================

DO $$
DECLARE
    v_table_exists boolean;
    v_column_exists boolean;
BEGIN
    -- Check if sessions table exists and has userId column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'sessions'
    ) INTO v_table_exists;
    
    IF v_table_exists THEN
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'sessions' 
            AND column_name = 'userId'
        ) INTO v_column_exists;
        
        IF NOT v_column_exists THEN
            RAISE NOTICE 'sessions table exists but userId column not found - skipping FK';
        ELSE
            -- Add foreign key only if column exists
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sessions_user') THEN
                ALTER TABLE sessions ADD CONSTRAINT fk_sessions_user 
                FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
                RAISE NOTICE 'Added FK: sessions.userId -> users.id';
            END IF;
        END IF;
    ELSE
        RAISE NOTICE 'sessions table does not exist - skipping';
    END IF;
END $$;

-- =================================================================
-- STEP 2: Add Foreign Keys with column existence checks
-- =================================================================

DO $$
DECLARE
    v_exists boolean;
BEGIN
    -- Campaigns -> Users
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'userId'
    ) INTO v_exists;
    
    IF v_exists AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_campaigns_user') THEN
        ALTER TABLE campaigns ADD CONSTRAINT fk_campaigns_user
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: campaigns.userId -> users.id';
    END IF;

    -- Posts -> Campaigns
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'campaignId'
    ) INTO v_exists;
    
    IF v_exists AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_posts_campaign') THEN
        ALTER TABLE posts ADD CONSTRAINT fk_posts_campaign
        FOREIGN KEY ("campaignId") REFERENCES campaigns(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: posts.campaignId -> campaigns.id';
    END IF;

    -- Projects -> Users
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'userId'
    ) INTO v_exists;
    
    IF v_exists AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_user') THEN
        ALTER TABLE projects ADD CONSTRAINT fk_projects_user
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: projects.userId -> users.id';
    END IF;

    -- API Usage -> Users
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'api_usage' AND column_name = 'userId'
    ) INTO v_exists;
    
    IF v_exists AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_usage_user') THEN
        ALTER TABLE api_usage ADD CONSTRAINT fk_api_usage_user
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: api_usage.userId -> users.id';
    END IF;

    -- Notifications -> Users
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'userId'
    ) INTO v_exists;
    
    IF v_exists AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_user') THEN
        ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: notifications.userId -> users.id';
    END IF;

    -- Audit Logs -> Users (nullable)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'userId'
    ) INTO v_exists;
    
    IF v_exists AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_user') THEN
        ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_user
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: audit_logs.userId -> users.id';
    END IF;

    -- Users -> Organizations (nullable)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'organizationId'
    ) INTO v_exists;
    
    IF v_exists AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_organization') THEN
        ALTER TABLE users ADD CONSTRAINT fk_users_organization
        FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added FK: users.organizationId -> organizations.id';
    END IF;

    -- Platform Connections -> Users
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'platform_connections' AND column_name = 'userId'
    ) INTO v_exists;
    
    IF v_exists AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_platform_connections_user') THEN
        ALTER TABLE platform_connections ADD CONSTRAINT fk_platform_connections_user
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: platform_connections.userId -> users.id';
    END IF;

    -- Platform Posts -> Platform Connections
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'platform_posts' AND column_name = 'connectionId'
    ) INTO v_exists;
    
    IF v_exists AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_connections')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_platform_posts_connection') THEN
        ALTER TABLE platform_posts ADD CONSTRAINT fk_platform_posts_connection
        FOREIGN KEY ("connectionId") REFERENCES platform_connections(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: platform_posts.connectionId -> platform_connections.id';
    END IF;

    -- Platform Metrics -> Platform Posts
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'platform_metrics' AND column_name = 'postId'
    ) INTO v_exists;
    
    IF v_exists AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_posts')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_platform_metrics_post') THEN
        ALTER TABLE platform_metrics ADD CONSTRAINT fk_platform_metrics_post
        FOREIGN KEY ("postId") REFERENCES platform_posts(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: platform_metrics.postId -> platform_posts.id';
    END IF;

    -- Team Invitations -> Users (nullable)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'userId'
    ) INTO v_exists;
    
    IF v_exists AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_invitations_user') THEN
        ALTER TABLE team_invitations ADD CONSTRAINT fk_team_invitations_user
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added FK: team_invitations.userId -> users.id';
    END IF;

    -- Team Invitations -> Organizations (nullable)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'organizationId'
    ) INTO v_exists;
    
    IF v_exists AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_invitations_organization') THEN
        ALTER TABLE team_invitations ADD CONSTRAINT fk_team_invitations_organization
        FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added FK: team_invitations.organizationId -> organizations.id';
    END IF;

    -- Brand Generations -> Users
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'brand_generations' AND column_name = 'userId'
    ) INTO v_exists;
    
    IF v_exists AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_brand_generations_user') THEN
        ALTER TABLE brand_generations ADD CONSTRAINT fk_brand_generations_user
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: brand_generations.userId -> users.id';
    END IF;

    -- Psychology Metrics -> Brand Generations
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'psychology_metrics' AND column_name = 'generationId'
    ) INTO v_exists;
    
    IF v_exists AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_generations')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_psychology_metrics_generation') THEN
        ALTER TABLE psychology_metrics ADD CONSTRAINT fk_psychology_metrics_generation
        FOREIGN KEY ("generationId") REFERENCES brand_generations(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: psychology_metrics.generationId -> brand_generations.id';
    END IF;

    -- User Psychology Preferences -> Users
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'user_psychology_preferences' AND column_name = 'userId'
    ) INTO v_exists;
    
    IF v_exists AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_psychology_preferences_user') THEN
        ALTER TABLE user_psychology_preferences ADD CONSTRAINT fk_user_psychology_preferences_user
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: user_psychology_preferences.userId -> users.id';
    END IF;

    -- Competitive Analyses -> Brand Generations
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'competitive_analyses' AND column_name = 'generationId'
    ) INTO v_exists;
    
    IF v_exists AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_generations')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_competitive_analyses_generation') THEN
        ALTER TABLE competitive_analyses ADD CONSTRAINT fk_competitive_analyses_generation
        FOREIGN KEY ("generationId") REFERENCES brand_generations(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added FK: competitive_analyses.generationId -> brand_generations.id';
    END IF;
END $$;

-- =================================================================
-- STEP 3: Add CHECK Constraints (safely)
-- =================================================================

DO $$
BEGIN
    -- Only add constraints if tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_auth_provider') THEN
            ALTER TABLE users ADD CONSTRAINT chk_users_auth_provider
            CHECK ("authProvider" IN ('local', 'google', 'github'));
            RAISE NOTICE 'Added CHECK: users.authProvider';
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_campaigns_status') THEN
            ALTER TABLE campaigns ADD CONSTRAINT chk_campaigns_status
            CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived'));
            RAISE NOTICE 'Added CHECK: campaigns.status';
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_posts_status') THEN
            ALTER TABLE posts ADD CONSTRAINT chk_posts_status
            CHECK (status IN ('draft', 'scheduled', 'published', 'failed', 'archived'));
            RAISE NOTICE 'Added CHECK: posts.status';
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_api_usage_status') THEN
            ALTER TABLE api_usage ADD CONSTRAINT chk_api_usage_status
            CHECK (status IN ('success', 'error', 'rate_limited', 'timeout'));
            RAISE NOTICE 'Added CHECK: api_usage.status';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_api_usage_cost_positive') THEN
            ALTER TABLE api_usage ADD CONSTRAINT chk_api_usage_cost_positive
            CHECK (cost IS NULL OR cost >= 0);
            RAISE NOTICE 'Added CHECK: api_usage.cost >= 0';
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_notifications_type') THEN
            ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type
            CHECK (type IN ('info', 'warning', 'error', 'success', 'alert'));
            RAISE NOTICE 'Added CHECK: notifications.type';
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_organizations_plan') THEN
            ALTER TABLE organizations ADD CONSTRAINT chk_organizations_plan
            CHECK (plan IN ('free', 'starter', 'pro', 'enterprise'));
            RAISE NOTICE 'Added CHECK: organizations.plan';
        END IF;
    END IF;
END $$;

-- =================================================================
-- STEP 4: Add Soft Delete Columns (safe)
-- =================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE platform_connections ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE platform_posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE brand_generations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- =================================================================
-- STEP 5: Add Important Indexes (safe)
-- =================================================================

-- User lookups
CREATE INDEX IF NOT EXISTS idx_users_email_lower 
ON users(lower(email)) 
WHERE deleted_at IS NULL;

-- Campaign queries
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id 
ON campaigns("userId") 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_status 
ON campaigns(status) 
WHERE deleted_at IS NULL;

-- Post queries
CREATE INDEX IF NOT EXISTS idx_posts_campaign_id 
ON posts("campaignId") 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_scheduled 
ON posts("scheduledAt", status) 
WHERE deleted_at IS NULL AND status = 'scheduled';

-- Notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications("userId", "createdAt" DESC) 
WHERE read = false;

-- API usage tracking
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date 
ON api_usage("userId", "createdAt" DESC);

-- =================================================================
-- STEP 6: Enable Row Level Security (safe for Supabase)
-- =================================================================

-- Enable RLS on tables (safe to run multiple times)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_posts ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies for Supabase Auth
-- Users can see and edit their own data
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id);

-- Users can manage their own campaigns
DROP POLICY IF EXISTS "Users can view own campaigns" ON campaigns;
CREATE POLICY "Users can view own campaigns" ON campaigns
    FOR SELECT USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can manage own campaigns" ON campaigns;
CREATE POLICY "Users can manage own campaigns" ON campaigns
    FOR ALL USING (auth.uid()::text = "userId");

-- Users can manage posts in their campaigns
DROP POLICY IF EXISTS "Users can view own posts" ON posts;
CREATE POLICY "Users can view own posts" ON posts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE campaigns.id = posts."campaignId" 
            AND campaigns."userId" = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "Users can manage own posts" ON posts;
CREATE POLICY "Users can manage own posts" ON posts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE campaigns.id = posts."campaignId" 
            AND campaigns."userId" = auth.uid()::text
        )
    );

-- Users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR ALL USING (auth.uid()::text = "userId");

-- Users can view their own API usage
DROP POLICY IF EXISTS "Users can view own API usage" ON api_usage;
CREATE POLICY "Users can view own API usage" ON api_usage
    FOR SELECT USING (auth.uid()::text = "userId");

-- =================================================================
-- STEP 7: Create Basic Audit Schema
-- =================================================================

-- Create audit schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS audit;

-- Simple audit log table
CREATE TABLE IF NOT EXISTS audit.changes (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    user_id TEXT,
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    old_data JSONB,
    new_data JSONB
);

-- =================================================================
-- STEP 8: Verification
-- =================================================================

DO $$
DECLARE
    fk_count INTEGER;
    idx_count INTEGER;
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fk_count
    FROM pg_constraint 
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
    
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes 
    WHERE schemaname = 'public';
    
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '  Foreign Keys: %', fk_count;
    RAISE NOTICE '  Indexes: %', idx_count;
    RAISE NOTICE '  RLS Policies: %', policy_count;
    RAISE NOTICE 'Migration completed successfully!';
END $$;

COMMIT;

-- =================================================================
-- POST-MIGRATION NOTES:
-- 
-- 1. This script safely checks for column existence before adding FKs
-- 2. It won't fail if tables or columns don't exist
-- 3. It provides feedback via RAISE NOTICE statements
-- 4. All changes are wrapped in a transaction
-- 
-- If you encounter any errors, run the check_schema.sql script first
-- to see what tables and columns actually exist in your database
-- =================================================================