-- =================================================================
-- 02_hardening.sql - Database Hardening Migrations
-- Generated: 2025-08-13
-- Purpose: Add constraints, FKs, checks, and data integrity
-- =================================================================

BEGIN;

-- =================================================================
-- STEP 1: Add Missing Foreign Key Constraints
-- =================================================================

-- Sessions -> Users
ALTER TABLE sessions 
ADD CONSTRAINT fk_sessions_user 
FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- Campaigns -> Users
ALTER TABLE campaigns
ADD CONSTRAINT fk_campaigns_user
FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- Posts -> Campaigns
ALTER TABLE posts
ADD CONSTRAINT fk_posts_campaign
FOREIGN KEY ("campaignId") REFERENCES campaigns(id) ON DELETE CASCADE;

-- Projects -> Users  
ALTER TABLE projects
ADD CONSTRAINT fk_projects_user
FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- API Usage -> Users
ALTER TABLE api_usage
ADD CONSTRAINT fk_api_usage_user
FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- Notifications -> Users
ALTER TABLE notifications
ADD CONSTRAINT fk_notifications_user
FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- Audit Logs -> Users (nullable)
ALTER TABLE audit_logs
ADD CONSTRAINT fk_audit_logs_user
FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- Users -> Organizations (nullable)
ALTER TABLE users
ADD CONSTRAINT fk_users_organization
FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE SET NULL;

-- Platform Connections -> Users
ALTER TABLE platform_connections
ADD CONSTRAINT fk_platform_connections_user
FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- Platform Posts -> Platform Connections
ALTER TABLE platform_posts
ADD CONSTRAINT fk_platform_posts_connection
FOREIGN KEY ("connectionId") REFERENCES platform_connections(id) ON DELETE CASCADE;

-- Platform Metrics -> Platform Posts
ALTER TABLE platform_metrics
ADD CONSTRAINT fk_platform_metrics_post
FOREIGN KEY ("postId") REFERENCES platform_posts(id) ON DELETE CASCADE;

-- Team Invitations -> Users (nullable)
ALTER TABLE team_invitations
ADD CONSTRAINT fk_team_invitations_user
FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL;

-- Team Invitations -> Organizations (nullable)
ALTER TABLE team_invitations
ADD CONSTRAINT fk_team_invitations_organization
FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE SET NULL;

-- Brand Generations -> Users
ALTER TABLE brand_generations
ADD CONSTRAINT fk_brand_generations_user
FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- Psychology Metrics -> Brand Generations
ALTER TABLE psychology_metrics
ADD CONSTRAINT fk_psychology_metrics_generation
FOREIGN KEY ("generationId") REFERENCES brand_generations(id) ON DELETE CASCADE;

-- User Psychology Preferences -> Users
ALTER TABLE user_psychology_preferences
ADD CONSTRAINT fk_user_psychology_preferences_user
FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- Competitive Analyses -> Brand Generations
ALTER TABLE competitive_analyses
ADD CONSTRAINT fk_competitive_analyses_generation
FOREIGN KEY ("generationId") REFERENCES brand_generations(id) ON DELETE CASCADE;

-- =================================================================
-- STEP 2: Add CHECK Constraints for Enums
-- =================================================================

-- User auth provider
ALTER TABLE users
ADD CONSTRAINT chk_users_auth_provider
CHECK ("authProvider" IN ('local', 'google', 'github'));

-- Campaign status
ALTER TABLE campaigns
ADD CONSTRAINT chk_campaigns_status
CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived'));

-- Campaign platform
ALTER TABLE campaigns
ADD CONSTRAINT chk_campaigns_platform
CHECK (platform IN ('instagram', 'twitter', 'linkedin', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit', 'threads'));

-- Post status
ALTER TABLE posts
ADD CONSTRAINT chk_posts_status
CHECK (status IN ('draft', 'scheduled', 'published', 'failed', 'archived'));

-- Post platform (same as campaigns)
ALTER TABLE posts
ADD CONSTRAINT chk_posts_platform
CHECK (platform IN ('instagram', 'twitter', 'linkedin', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit', 'threads'));

-- Project type
ALTER TABLE projects
ADD CONSTRAINT chk_projects_type
CHECK (type IN ('marketing', 'content', 'analytics', 'brand', 'strategy'));

-- API usage status
ALTER TABLE api_usage
ADD CONSTRAINT chk_api_usage_status
CHECK (status IN ('success', 'error', 'rate_limited', 'timeout'));

-- Notification type
ALTER TABLE notifications
ADD CONSTRAINT chk_notifications_type
CHECK (type IN ('info', 'warning', 'error', 'success', 'alert'));

-- Audit log severity
ALTER TABLE audit_logs
ADD CONSTRAINT chk_audit_logs_severity
CHECK (severity IN ('low', 'medium', 'high', 'critical'));

-- Audit log category
ALTER TABLE audit_logs
ADD CONSTRAINT chk_audit_logs_category
CHECK (category IN ('auth', 'data', 'system', 'security', 'compliance', 'api'));

-- Audit log outcome
ALTER TABLE audit_logs
ADD CONSTRAINT chk_audit_logs_outcome
CHECK (outcome IN ('success', 'failure', 'warning', 'pending'));

-- Organization plan
ALTER TABLE organizations
ADD CONSTRAINT chk_organizations_plan
CHECK (plan IN ('free', 'starter', 'pro', 'enterprise'));

-- Organization billing status
ALTER TABLE organizations
ADD CONSTRAINT chk_organizations_billing_status
CHECK ("billingStatus" IN ('active', 'past_due', 'canceled', 'trialing'));

-- Platform connection platform
ALTER TABLE platform_connections
ADD CONSTRAINT chk_platform_connections_platform
CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'reddit', 'threads'));

-- Platform post status
ALTER TABLE platform_posts
ADD CONSTRAINT chk_platform_posts_status
CHECK (status IN ('draft', 'scheduled', 'published', 'failed'));

-- Team invitation status
ALTER TABLE team_invitations
ADD CONSTRAINT chk_team_invitations_status
CHECK (status IN ('sent', 'accepted', 'declined', 'expired', 'revoked'));

-- Brand generation status
ALTER TABLE brand_generations
ADD CONSTRAINT chk_brand_generations_status
CHECK (status IN ('draft', 'generating', 'completed', 'failed', 'archived'));

-- =================================================================
-- STEP 3: Add Value Constraints
-- =================================================================

-- Cost cannot be negative
ALTER TABLE api_usage
ADD CONSTRAINT chk_api_usage_cost_positive
CHECK (cost IS NULL OR cost >= 0);

-- Tokens cannot be negative
ALTER TABLE api_usage
ADD CONSTRAINT chk_api_usage_tokens_positive
CHECK (tokens IS NULL OR tokens >= 0);

-- Platform metrics cannot be negative
ALTER TABLE platform_metrics
ADD CONSTRAINT chk_platform_metrics_positive
CHECK (
    likes >= 0 AND
    shares >= 0 AND
    comments >= 0 AND
    views >= 0 AND
    reach >= 0 AND
    impressions >= 0 AND
    clicks >= 0 AND
    saves >= 0
);

-- Engagement rate between 0 and 100
ALTER TABLE platform_metrics
ADD CONSTRAINT chk_platform_metrics_engagement_rate
CHECK ("engagementRate" IS NULL OR ("engagementRate" >= 0 AND "engagementRate" <= 100));

-- Psychology scores between 0 and 1
ALTER TABLE psychology_principles
ADD CONSTRAINT chk_psychology_principles_effectiveness
CHECK ("effectivenessScore" >= 0 AND "effectivenessScore" <= 1);

ALTER TABLE brand_generations
ADD CONSTRAINT chk_brand_generations_effectiveness
CHECK ("effectivenessScore" >= 0 AND "effectivenessScore" <= 1);

ALTER TABLE psychology_metrics
ADD CONSTRAINT chk_psychology_metrics_scores
CHECK (
    "engagementScore" >= 0 AND "engagementScore" <= 1 AND
    "recallScore" >= 0 AND "recallScore" <= 1
);

-- Conversion and CTR between 0 and 100
ALTER TABLE psychology_metrics
ADD CONSTRAINT chk_psychology_metrics_rates
CHECK (
    "conversionRate" >= 0 AND "conversionRate" <= 100 AND
    "clickThroughRate" >= 0 AND "clickThroughRate" <= 100
);

-- Client satisfaction between 1 and 10
ALTER TABLE psychology_metrics
ADD CONSTRAINT chk_psychology_metrics_satisfaction
CHECK ("clientSatisfaction" IS NULL OR ("clientSatisfaction" >= 1 AND "clientSatisfaction" <= 10));

-- =================================================================
-- STEP 4: Add Email Format Validation
-- =================================================================

ALTER TABLE users
ADD CONSTRAINT chk_users_email_format
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE organizations
ADD CONSTRAINT chk_organizations_billing_email_format
CHECK ("billingEmail" IS NULL OR "billingEmail" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE team_invitations
ADD CONSTRAINT chk_team_invitations_email_format
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- =================================================================
-- STEP 5: Add Soft Delete Columns
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
-- STEP 6: Add Optimistic Locking Version Columns
-- =================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE brand_generations ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

-- =================================================================
-- STEP 7: Update Unique Constraints for Soft Delete
-- =================================================================

-- Drop old unique constraint and recreate with partial index
DROP INDEX IF EXISTS users_email_key;
CREATE UNIQUE INDEX users_email_unique_active 
ON users(lower(email)) 
WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS users_googleid_key;
CREATE UNIQUE INDEX users_googleid_unique_active
ON users("googleId")
WHERE "googleId" IS NOT NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS organizations_slug_key;
CREATE UNIQUE INDEX organizations_slug_unique_active
ON organizations(slug)
WHERE deleted_at IS NULL;

-- =================================================================
-- STEP 8: Add Missing Indexes for Performance
-- =================================================================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns("userId") WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_campaign_id ON posts("campaignId") WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects("userId") WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage("userId");
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications("userId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs("userId") WHERE "userId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_connections_user_id ON platform_connections("userId") WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_platform_posts_connection_id ON platform_posts("connectionId") WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_platform_metrics_post_id ON platform_metrics("postId");
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_brand_generations_user_id ON brand_generations("userId") WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_psychology_metrics_generation_id ON psychology_metrics("generationId");
CREATE INDEX IF NOT EXISTS idx_competitive_analyses_generation_id ON competitive_analyses("generationId");

-- Query pattern indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_status_user ON campaigns("userId", status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled ON posts(status, "scheduledAt") WHERE deleted_at IS NULL AND status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_api_usage_created_user ON api_usage("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications("userId", read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_desc ON audit_logs("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_platform_posts_status ON platform_posts(status) WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_org_active ON users("organizationId") WHERE deleted_at IS NULL AND "emailVerified" = true;
CREATE INDEX IF NOT EXISTS idx_campaigns_user_platform_status ON campaigns("userId", platform, status) WHERE deleted_at IS NULL;

-- JSON indexes (GIN for containment queries)
CREATE INDEX IF NOT EXISTS idx_users_preferences_gin ON users USING GIN (preferences) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_content_gin ON campaigns USING GIN (content) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_details_gin ON audit_logs USING GIN (details);

-- =================================================================
-- STEP 9: Add Update Triggers for updatedAt
-- =================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updatedAt
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_connections_updated_at BEFORE UPDATE ON platform_connections 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_posts_updated_at BEFORE UPDATE ON platform_posts 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_generations_updated_at BEFORE UPDATE ON brand_generations 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- =================================================================
-- ROLLBACK SCRIPT
-- =================================================================
-- To rollback these changes, run:
-- BEGIN;
-- DROP TRIGGER IF EXISTS update_users_updated_at ON users;
-- DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
-- DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
-- DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
-- DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
-- DROP TRIGGER IF EXISTS update_platform_connections_updated_at ON platform_connections;
-- DROP TRIGGER IF EXISTS update_platform_posts_updated_at ON platform_posts;
-- DROP TRIGGER IF EXISTS update_brand_generations_updated_at ON brand_generations;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS version;
-- -- Continue for all columns and constraints...
-- COMMIT;