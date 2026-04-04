-- ==============================================================================
-- SYNTHEX Consolidated Schema Migration
-- Generated: 2026-02-04
--
-- This migration safely adds all missing tables and columns to bring the
-- database in sync with the Prisma schema. Uses IF NOT EXISTS to be idempotent.
-- ==============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. ACCOUNTS TABLE (OAuth Multi-Provider Authentication)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" INTEGER,
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- Indexes for accounts
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_providerAccountId_key"
    ON "accounts"("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "accounts_userId_idx" ON "accounts"("userId");

-- Foreign key (may already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'accounts_userId_fkey'
    ) THEN
        ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- 2. PLATFORM CONNECTIONS (Social Media Integrations)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "platform_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "profileId" TEXT,
    "profileName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_connections_userId_platform_profileId_key"
    ON "platform_connections"("userId", "platform", "profileId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'platform_connections_userId_fkey'
    ) THEN
        ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- 3. PLATFORM POSTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "platform_posts" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrls" TEXT[],
    "hashtags" TEXT[],
    "mentions" TEXT[],
    "status" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_posts_connectionId_platformId_key"
    ON "platform_posts"("connectionId", "platformId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'platform_posts_connectionId_fkey'
    ) THEN
        ALTER TABLE "platform_posts" ADD CONSTRAINT "platform_posts_connectionId_fkey"
            FOREIGN KEY ("connectionId") REFERENCES "platform_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- 4. PLATFORM METRICS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "platform_metrics" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION,
    "metadata" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_metrics_postId_recordedAt_idx"
    ON "platform_metrics"("postId", "recordedAt" DESC);
CREATE INDEX IF NOT EXISTS "platform_metrics_recordedAt_idx"
    ON "platform_metrics"("recordedAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'platform_metrics_postId_fkey'
    ) THEN
        ALTER TABLE "platform_metrics" ADD CONSTRAINT "platform_metrics_postId_fkey"
            FOREIGN KEY ("postId") REFERENCES "platform_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- 5. TEAM INVITATIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "team_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "message" TEXT,
    "campaignAccess" JSONB,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "organizationId" TEXT,

    CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "team_invitations_email_idx" ON "team_invitations"("email");

-- ==============================================================================
-- 6. PSYCHOLOGY PRINCIPLES (Strategic Marketing)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "psychology_principles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "brandingApplication" JSONB NOT NULL DEFAULT '{}',
    "triggerWords" TEXT[],
    "audienceRelevance" JSONB NOT NULL DEFAULT '{}',
    "effectivenessScore" DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psychology_principles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "psychology_principles_name_key" ON "psychology_principles"("name");
CREATE INDEX IF NOT EXISTS "psychology_principles_category_idx" ON "psychology_principles"("category");
CREATE INDEX IF NOT EXISTS "psychology_principles_effectivenessScore_idx"
    ON "psychology_principles"("effectivenessScore" DESC);

-- ==============================================================================
-- 7. BRAND GENERATIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "brand_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "targetAudience" JSONB NOT NULL,
    "brandGoals" TEXT[],
    "tonePreference" TEXT,
    "psychologyStrategy" JSONB NOT NULL,
    "brandNames" JSONB NOT NULL,
    "taglines" JSONB NOT NULL,
    "metadataPackages" JSONB NOT NULL DEFAULT '{}',
    "implementationGuide" JSONB NOT NULL DEFAULT '{}',
    "effectivenessScore" DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_generations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "brand_generations_userId_idx" ON "brand_generations"("userId");
CREATE INDEX IF NOT EXISTS "brand_generations_status_idx" ON "brand_generations"("status");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'brand_generations_userId_fkey'
    ) THEN
        ALTER TABLE "brand_generations" ADD CONSTRAINT "brand_generations_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- 8. PSYCHOLOGY METRICS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "psychology_metrics" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "principleUsed" TEXT NOT NULL,
    "variantType" TEXT NOT NULL,
    "variantContent" TEXT NOT NULL,
    "engagementScore" DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    "conversionRate" DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    "recallScore" DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    "clickThroughRate" DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    "clientSatisfaction" INTEGER,
    "testDurationHours" INTEGER NOT NULL DEFAULT 24,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psychology_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "psychology_metrics_generationId_idx" ON "psychology_metrics"("generationId");
CREATE INDEX IF NOT EXISTS "psychology_metrics_principleUsed_idx" ON "psychology_metrics"("principleUsed");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'psychology_metrics_generationId_fkey'
    ) THEN
        ALTER TABLE "psychology_metrics" ADD CONSTRAINT "psychology_metrics_generationId_fkey"
            FOREIGN KEY ("generationId") REFERENCES "brand_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- 9. USER PSYCHOLOGY PREFERENCES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "user_psychology_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredPrinciples" TEXT[],
    "avoidedPrinciples" TEXT[],
    "industryFocus" TEXT,
    "targetDemographic" JSONB NOT NULL DEFAULT '{}',
    "successMetrics" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_psychology_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_psychology_preferences_userId_key"
    ON "user_psychology_preferences"("userId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_psychology_preferences_userId_fkey'
    ) THEN
        ALTER TABLE "user_psychology_preferences" ADD CONSTRAINT "user_psychology_preferences_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- 10. COMPETITIVE ANALYSES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "competitive_analyses" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "competitorName" TEXT NOT NULL,
    "competitorTagline" TEXT,
    "identifiedPrinciples" TEXT[],
    "differentiationStrategy" TEXT,
    "marketPosition" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitive_analyses_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'competitive_analyses_generationId_fkey'
    ) THEN
        ALTER TABLE "competitive_analyses" ADD CONSTRAINT "competitive_analyses_generationId_fkey"
            FOREIGN KEY ("generationId") REFERENCES "brand_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- 11. ANALYTICS EVENTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "analytics_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "platform" TEXT,
    "contentId" TEXT,
    "campaignId" TEXT,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_events_userId_idx" ON "analytics_events"("userId");
CREATE INDEX IF NOT EXISTS "analytics_events_sessionId_idx" ON "analytics_events"("sessionId");
CREATE INDEX IF NOT EXISTS "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");

-- ==============================================================================
-- 12. QUOTES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "quotes" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "source" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sentiment" TEXT,
    "readingLevel" TEXT,
    "userId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quotes_category_idx" ON "quotes"("category");
CREATE INDEX IF NOT EXISTS "quotes_userId_idx" ON "quotes"("userId");
CREATE INDEX IF NOT EXISTS "quotes_aiGenerated_idx" ON "quotes"("aiGenerated");

-- ==============================================================================
-- 13. QUOTE COLLECTIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "quote_collections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "quoteIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_collections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quote_collections_userId_idx" ON "quote_collections"("userId");

-- ==============================================================================
-- 14. TASKS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "tags" TEXT[],
    "category" TEXT,
    "estimatedTime" INTEGER,
    "actualTime" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "columnId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tasks_userId_idx" ON "tasks"("userId");
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks"("status");
CREATE INDEX IF NOT EXISTS "tasks_priority_idx" ON "tasks"("priority");
CREATE INDEX IF NOT EXISTS "tasks_dueDate_idx" ON "tasks"("dueDate");
CREATE INDEX IF NOT EXISTS "tasks_userId_status_dueDate_idx" ON "tasks"("userId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "tasks_assigneeId_priority_idx" ON "tasks"("assigneeId", "priority");

-- ==============================================================================
-- 15. PERSONAS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "personas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "style" TEXT NOT NULL DEFAULT 'formal',
    "vocabulary" TEXT NOT NULL DEFAULT 'standard',
    "emotion" TEXT NOT NULL DEFAULT 'neutral',
    "trainingSourcesCount" INTEGER NOT NULL DEFAULT 0,
    "trainingWordsCount" INTEGER NOT NULL DEFAULT 0,
    "trainingSamplesCount" INTEGER NOT NULL DEFAULT 0,
    "accuracy" INTEGER NOT NULL DEFAULT 0,
    "lastTrained" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "personas_userId_idx" ON "personas"("userId");
CREATE INDEX IF NOT EXISTS "personas_status_idx" ON "personas"("status");

-- ==============================================================================
-- 16. SUBSCRIPTIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "maxSocialAccounts" INTEGER NOT NULL DEFAULT 2,
    "maxAiPosts" INTEGER NOT NULL DEFAULT 10,
    "maxPersonas" INTEGER NOT NULL DEFAULT 1,
    "currentAiPosts" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripeCustomerId_key" ON "subscriptions"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX IF NOT EXISTS "subscriptions_plan_idx" ON "subscriptions"("plan");

-- ==============================================================================
-- 17. ROLES (RBAC)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "roles_organizationId_name_key" ON "roles"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "roles_organizationId_idx" ON "roles"("organizationId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'roles_organizationId_fkey'
    ) THEN
        ALTER TABLE "roles" ADD CONSTRAINT "roles_organizationId_fkey"
            FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- 18. USER ROLES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");
CREATE INDEX IF NOT EXISTS "user_roles_userId_idx" ON "user_roles"("userId");
CREATE INDEX IF NOT EXISTS "user_roles_roleId_idx" ON "user_roles"("roleId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_roles_roleId_fkey'
    ) THEN
        ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey"
            FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- 19. PERMISSION AUDITS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "permission_audits" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetRoleId" TEXT,
    "performedBy" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "permission_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "permission_audits_organizationId_idx" ON "permission_audits"("organizationId");
CREATE INDEX IF NOT EXISTS "permission_audits_performedBy_idx" ON "permission_audits"("performedBy");
CREATE INDEX IF NOT EXISTS "permission_audits_createdAt_idx" ON "permission_audits"("createdAt");

-- ==============================================================================
-- 20. CALENDAR POSTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "calendar_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "platforms" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "mediaUrls" TEXT[],
    "tags" TEXT[],
    "hashtags" TEXT[],
    "mentions" TEXT[],
    "recurrenceType" TEXT,
    "recurrenceInterval" INTEGER,
    "recurrenceEndDate" TIMESTAMP(3),
    "recurrenceOccurrences" INTEGER,
    "recurrenceDaysOfWeek" INTEGER[],
    "recurrenceDayOfMonth" INTEGER,
    "parentPostId" TEXT,
    "campaignId" TEXT,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metadata" JSONB,
    "analytics" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_posts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "calendar_posts_organizationId_scheduledFor_idx"
    ON "calendar_posts"("organizationId", "scheduledFor" DESC);
CREATE INDEX IF NOT EXISTS "calendar_posts_userId_status_idx" ON "calendar_posts"("userId", "status");
CREATE INDEX IF NOT EXISTS "calendar_posts_status_scheduledFor_idx" ON "calendar_posts"("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "calendar_posts_campaignId_idx" ON "calendar_posts"("campaignId");
CREATE INDEX IF NOT EXISTS "calendar_posts_parentPostId_idx" ON "calendar_posts"("parentPostId");

-- ==============================================================================
-- 21. ADD MISSING COLUMNS TO EXISTING TABLES
-- ==============================================================================

-- Add password column to users if it doesn't exist (nullable for OAuth users)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "password" TEXT;
    ELSE
        -- Make password nullable if it exists and is NOT NULL
        ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
    END IF;
END $$;

-- Add status column to organizations if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'status'
    ) THEN
        ALTER TABLE "organizations" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
    END IF;
END $$;

-- Add domain columns to organizations if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'domain'
    ) THEN
        ALTER TABLE "organizations" ADD COLUMN "domain" TEXT;
        ALTER TABLE "organizations" ADD COLUMN "customDomain" TEXT;
        ALTER TABLE "organizations" ADD COLUMN "logo" TEXT;
        ALTER TABLE "organizations" ADD COLUMN "primaryColor" TEXT;
        ALTER TABLE "organizations" ADD COLUMN "favicon" TEXT;
        ALTER TABLE "organizations" ADD COLUMN "maxUsers" INTEGER NOT NULL DEFAULT 5;
        ALTER TABLE "organizations" ADD COLUMN "maxPosts" INTEGER NOT NULL DEFAULT 500;
        ALTER TABLE "organizations" ADD COLUMN "maxCampaigns" INTEGER NOT NULL DEFAULT 10;
    END IF;
END $$;

-- Add organizationId to campaigns if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'organizationId'
    ) THEN
        ALTER TABLE "campaigns" ADD COLUMN "organizationId" TEXT;
    END IF;
END $$;

-- ==============================================================================
-- 22. CREATE PERFORMANCE INDEXES FOR EXISTING TABLES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS "posts_campaignId_createdAt_idx" ON "posts"("campaignId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "posts_platform_status_idx" ON "posts"("platform", "status");
CREATE INDEX IF NOT EXISTS "posts_scheduledAt_idx" ON "posts"("scheduledAt");
CREATE INDEX IF NOT EXISTS "campaigns_organizationId_idx" ON "campaigns"("organizationId");

-- ==============================================================================
-- MIGRATION COMPLETE
-- ==============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'SYNTHEX Consolidated Schema Migration completed successfully at %', NOW();
END $$;
