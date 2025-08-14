-- =================================================================
-- 01_snapshot.sql - Current Schema State
-- Generated: 2025-08-13
-- Database: PostgreSQL (Supabase)
-- =================================================================

-- Current Tables:
-- - users (User authentication and profile)
-- - campaigns (Marketing campaigns)
-- - posts (Campaign posts)
-- - projects (User projects)
-- - api_usage (API usage tracking)
-- - sessions (User sessions)
-- - notifications (User notifications)
-- - audit_logs (System audit trail)
-- - organizations (Multi-tenant orgs)
-- - platform_connections (Social media connections)
-- - platform_posts (Platform-specific posts)
-- - platform_metrics (Post metrics)
-- - team_invitations (Team invitations)
-- - psychology_principles (Marketing psychology)
-- - brand_generations (Brand generation results)
-- - psychology_metrics (Psychology effectiveness metrics)
-- - user_psychology_preferences (User preferences)
-- - competitive_analyses (Competitor analysis)

-- =================================================================
-- SCHEMA GAPS IDENTIFIED:
-- =================================================================
-- 1. Missing Foreign Key Constraints:
--    - sessions.userId -> users.id
--    - Many relationships defined only in Prisma, not DB
--
-- 2. Missing NOT NULL Constraints:
--    - Critical fields allow NULL (e.g., platform, status)
--
-- 3. Missing CHECK Constraints:
--    - Status enums not enforced at DB level
--    - Cost/amount fields can be negative
--    - Email format not validated
--
-- 4. Missing Indexes:
--    - Foreign key columns not indexed
--    - Frequent query patterns not optimized
--    - JSON fields not indexed for searches
--
-- 5. Security Concerns:
--    - No Row-Level Security (RLS) policies
--    - No soft delete (physical deletes used)
--    - No audit triggers at DB level
--    - Sensitive data not encrypted
--
-- 6. Performance Issues:
--    - No partial indexes for deleted_at IS NULL
--    - No covering indexes for common queries
--    - No query performance monitoring
--
-- 7. Data Integrity:
--    - No idempotency key handling
--    - No transactional outbox pattern
--    - No optimistic locking (version columns)
--
-- 8. Multi-tenancy:
--    - organizationId not consistently enforced
--    - No RLS policies for tenant isolation

-- =================================================================
-- CURRENT SCHEMA EXTRACT (from Prisma)
-- =================================================================

-- Note: This is the logical schema from Prisma
-- Actual DB schema may differ if migrations weren't run

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "googleId" TEXT UNIQUE,
    avatar TEXT,
    "authProvider" TEXT DEFAULT 'local',
    "emailVerified" BOOLEAN DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "openrouterApiKey" TEXT,
    "anthropicApiKey" TEXT,
    preferences JSONB,
    "resetCode" TEXT,
    "resetCodeExpires" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpires" TIMESTAMP(3),
    "verificationCode" TEXT,
    "verificationExpires" TIMESTAMP(3),
    "organizationId" TEXT
);

CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    content JSONB,
    analytics JSONB,
    settings JSONB,
    "userId" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    content TEXT NOT NULL,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    metadata JSONB,
    analytics JSONB,
    "campaignId" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    data JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_usage (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    endpoint TEXT NOT NULL,
    model TEXT,
    tokens INTEGER,
    cost DOUBLE PRECISION,
    status TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "requestData" JSONB,
    "responseData" JSONB,
    "errorMessage" TEXT,
    "userId" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    token TEXT UNIQUE NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    data JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    "resourceId" TEXT,
    entity TEXT,
    "entityId" TEXT,
    details JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    severity TEXT DEFAULT 'medium',
    category TEXT DEFAULT 'system',
    outcome TEXT DEFAULT 'success',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT
);

CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    plan TEXT DEFAULT 'free',
    settings JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "billingEmail" TEXT,
    "billingStatus" TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS platform_connections (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    platform TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    scope TEXT,
    "profileId" TEXT,
    "profileName" TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "lastSync" TIMESTAMP(3),
    metadata JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    UNIQUE("userId", platform, "profileId")
);

CREATE TABLE IF NOT EXISTS platform_posts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "connectionId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    content TEXT NOT NULL,
    "mediaUrls" TEXT[],
    hashtags TEXT[],
    mentions TEXT[],
    status TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    metadata JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    UNIQUE("connectionId", "platformId")
);

CREATE TABLE IF NOT EXISTS platform_metrics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "postId" TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    "engagementRate" DOUBLE PRECISION,
    metadata JSONB,
    "recordedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_invitations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    message TEXT,
    "campaignAccess" JSONB,
    status TEXT DEFAULT 'sent',
    "sentAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "organizationId" TEXT
);

CREATE TABLE IF NOT EXISTS psychology_principles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    "brandingApplication" JSONB DEFAULT '{}',
    "triggerWords" TEXT[],
    "audienceRelevance" JSONB DEFAULT '{}',
    "effectivenessScore" DECIMAL(3,2) DEFAULT 0.00,
    "usageCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS brand_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "targetAudience" JSONB NOT NULL,
    "brandGoals" TEXT[],
    "tonePreference" TEXT,
    "psychologyStrategy" JSONB NOT NULL,
    "brandNames" JSONB NOT NULL,
    taglines JSONB NOT NULL,
    "metadataPackages" JSONB DEFAULT '{}',
    "implementationGuide" JSONB DEFAULT '{}',
    "effectivenessScore" DECIMAL(3,2) DEFAULT 0.00,
    status TEXT DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS psychology_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "generationId" TEXT NOT NULL,
    "principleUsed" TEXT NOT NULL,
    "variantType" TEXT NOT NULL,
    "variantContent" TEXT NOT NULL,
    "engagementScore" DECIMAL(3,2) DEFAULT 0.00,
    "conversionRate" DECIMAL(5,2) DEFAULT 0.00,
    "recallScore" DECIMAL(3,2) DEFAULT 0.00,
    "clickThroughRate" DECIMAL(5,2) DEFAULT 0.00,
    "clientSatisfaction" INTEGER,
    "testDurationHours" INTEGER DEFAULT 24,
    "sampleSize" INTEGER DEFAULT 0,
    "testedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_psychology_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT UNIQUE NOT NULL,
    "preferredPrinciples" TEXT[],
    "avoidedPrinciples" TEXT[],
    "industryFocus" TEXT,
    "targetDemographic" JSONB DEFAULT '{}',
    "successMetrics" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS competitive_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "generationId" TEXT NOT NULL,
    "competitorName" TEXT NOT NULL,
    "competitorTagline" TEXT,
    "identifiedPrinciples" TEXT[],
    "differentiationStrategy" TEXT,
    "marketPosition" TEXT,
    "analyzedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);