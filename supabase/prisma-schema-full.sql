-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "google_id" TEXT,
    "avatar" TEXT,
    "auth_provider" TEXT NOT NULL DEFAULT 'local',
    "email_verified" BOOLEAN DEFAULT false,
    "last_login" TIMESTAMP(3),
    "openrouter_api_key" TEXT,
    "anthropic_api_key" TEXT,
    "preferences" JSONB,
    "reset_code" TEXT,
    "reset_code_expires" TIMESTAMP(3),
    "reset_token" TEXT,
    "reset_token_expires" TIMESTAMP(3),
    "verification_code" TEXT,
    "verification_expires" TIMESTAMP(3),
    "organization_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "content" JSONB,
    "analytics" JSONB,
    "settings" JSONB,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."posts" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "analytics" JSONB,
    "campaignId" TEXT NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."api_usage" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "model" TEXT,
    "tokens" INTEGER,
    "cost" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestData" JSONB,
    "responseData" JSONB,
    "errorMessage" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "entity" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT NOT NULL DEFAULT 'system',
    "outcome" TEXT NOT NULL DEFAULT 'success',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "domain" TEXT,
    "customDomain" TEXT,
    "logo" TEXT,
    "primaryColor" TEXT,
    "favicon" TEXT,
    "stripeCustomerId" TEXT,
    "billingEmail" TEXT,
    "billingStatus" TEXT NOT NULL DEFAULT 'active',
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxPosts" INTEGER NOT NULL DEFAULT 500,
    "maxCampaigns" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."platform_connections" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."platform_posts" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."platform_metrics" (
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

-- CreateTable
CREATE TABLE "public"."team_invitations" (
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

-- CreateTable
CREATE TABLE "public"."psychology_principles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "brandingApplication" JSONB NOT NULL DEFAULT '{}',
    "triggerWords" TEXT[],
    "audienceRelevance" JSONB NOT NULL DEFAULT '{}',
    "effectivenessScore" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psychology_principles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."brand_generations" (
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
    "effectivenessScore" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."psychology_metrics" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "principleUsed" TEXT NOT NULL,
    "variantType" TEXT NOT NULL,
    "variantContent" TEXT NOT NULL,
    "engagementScore" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "conversionRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "recallScore" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "clickThroughRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "clientSatisfaction" INTEGER,
    "testDurationHours" INTEGER NOT NULL DEFAULT 24,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psychology_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_psychology_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredPrinciples" TEXT[],
    "avoidedPrinciples" TEXT[],
    "industryFocus" TEXT,
    "targetDemographic" JSONB NOT NULL DEFAULT '{}',
    "successMetrics" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_psychology_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."competitive_analyses" (
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

-- CreateTable
CREATE TABLE "public"."analytics_events" (
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

-- CreateTable
CREATE TABLE "public"."reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "dateRange" JSONB,
    "filters" JSONB,
    "data" JSONB,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "generatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scheduled_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templateId" TEXT,
    "reportType" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "dateRangeType" TEXT NOT NULL DEFAULT 'last_period',
    "filters" JSONB,
    "metrics" TEXT[],
    "recipients" TEXT[],
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastReportId" TEXT,
    "nextRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "metrics" TEXT[],
    "dimensions" TEXT[],
    "filters" JSONB,
    "visualizations" JSONB,
    "layout" JSONB,
    "branding" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_deliveries" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "scheduledReportId" TEXT,
    "deliveryType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sentiment_analyses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT,
    "text" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "emotions" JSONB,
    "toneIndicators" JSONB,
    "keyPhrases" TEXT[],
    "predictedEngagement" JSONB,
    "actualEngagement" JSONB,
    "predictionAccuracy" DOUBLE PRECISION,
    "platform" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT,

    CONSTRAINT "sentiment_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sentiment_trends" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "platform" TEXT,
    "date" DATE NOT NULL,
    "avgScore" DOUBLE PRECISION NOT NULL,
    "positiveCount" INTEGER NOT NULL DEFAULT 0,
    "neutralCount" INTEGER NOT NULL DEFAULT 0,
    "negativeCount" INTEGER NOT NULL DEFAULT 0,
    "mixedCount" INTEGER NOT NULL DEFAULT 0,
    "totalAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "emotionCounts" JSONB,
    "avgEngagement" DOUBLE PRECISION,
    "topPerforming" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sentiment_trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."engagement_predictions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT,
    "sentimentScore" DOUBLE PRECISION NOT NULL,
    "sentiment" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "contentLength" INTEGER NOT NULL,
    "hasMedia" BOOLEAN NOT NULL DEFAULT false,
    "hasHashtags" BOOLEAN NOT NULL DEFAULT false,
    "hasMentions" BOOLEAN NOT NULL DEFAULT false,
    "postHour" INTEGER,
    "postDayOfWeek" INTEGER,
    "predictedLikes" INTEGER NOT NULL,
    "predictedComments" INTEGER NOT NULL,
    "predictedShares" INTEGER NOT NULL,
    "predictedReach" INTEGER,
    "predictedEngRate" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" DOUBLE PRECISION NOT NULL,
    "actualLikes" INTEGER,
    "actualComments" INTEGER,
    "actualShares" INTEGER,
    "actualReach" INTEGER,
    "actualEngRate" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "predictedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "resultsAt" TIMESTAMP(3),

    CONSTRAINT "engagement_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quotes" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quote_collections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "quoteIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tasks" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."personas" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."persona_training_data" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "platform" TEXT,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "extractedTone" JSONB,
    "extractedVocabulary" JSONB,
    "extractedPatterns" JSONB,
    "aiAnalysis" JSONB,
    "sentiment" TEXT,
    "topics" TEXT[],
    "embedding" JSONB,
    "engagement" INTEGER,
    "processedAt" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persona_training_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permission_audits" (
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

-- CreateTable
CREATE TABLE "public"."content_shares" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "sharedWithUserId" TEXT,
    "sharedWithTeamId" TEXT,
    "sharedWithEmail" TEXT,
    "permission" TEXT NOT NULL DEFAULT 'view',
    "canDownload" BOOLEAN NOT NULL DEFAULT true,
    "canReshare" BOOLEAN NOT NULL DEFAULT false,
    "accessLink" TEXT,
    "password" TEXT,
    "expiresAt" TIMESTAMP(3),
    "maxViews" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "sharedById" TEXT NOT NULL,
    "organizationId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAccessedAt" TIMESTAMP(3),

    CONSTRAINT "content_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_comments" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "authorId" TEXT NOT NULL,
    "sentiment" TEXT,
    "sentimentScore" DOUBLE PRECISION,
    "emotions" JSONB,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "mentions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_access_logs" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "shareId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "relatedUserId" TEXT,
    "relatedContentType" TEXT,
    "relatedContentId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "team_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."calendar_posts" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ab_tests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "duration" INTEGER NOT NULL DEFAULT 7,
    "platform" TEXT,
    "targetAudience" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "winner" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recommendations" TEXT[],
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ab_test_variants" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image" TEXT,
    "cta" TEXT,
    "hashtags" TEXT[],
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_test_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ab_test_results" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uplift" DOUBLE PRECISION,
    "pValue" DOUBLE PRECISION,

    CONSTRAINT "ab_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tracked_competitors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "industry" TEXT,
    "twitterHandle" TEXT,
    "instagramHandle" TEXT,
    "linkedinHandle" TEXT,
    "facebookHandle" TEXT,
    "youtubeHandle" TEXT,
    "tiktokHandle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trackPosts" BOOLEAN NOT NULL DEFAULT true,
    "trackMetrics" BOOLEAN NOT NULL DEFAULT true,
    "trackingFrequency" TEXT NOT NULL DEFAULT 'daily',
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastTrackedAt" TIMESTAMP(3),

    CONSTRAINT "tracked_competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."competitor_snapshots" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "followersCount" INTEGER,
    "followingCount" INTEGER,
    "followerGrowth" INTEGER,
    "totalPosts" INTEGER,
    "avgLikes" DOUBLE PRECISION,
    "avgComments" DOUBLE PRECISION,
    "avgShares" DOUBLE PRECISION,
    "engagementRate" DOUBLE PRECISION,
    "postFrequency" DOUBLE PRECISION,
    "topHashtags" TEXT[],
    "contentTypes" JSONB,
    "postingTimes" JSONB,
    "performanceScore" DOUBLE PRECISION,
    "growthScore" DOUBLE PRECISION,
    "engagementScore" DOUBLE PRECISION,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSource" TEXT NOT NULL DEFAULT 'api',

    CONSTRAINT "competitor_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."competitor_posts" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT,
    "postUrl" TEXT,
    "content" TEXT,
    "mediaUrls" TEXT[],
    "mediaType" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER,
    "saves" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "sentiment" TEXT,
    "hashtags" TEXT[],
    "mentions" TEXT[],
    "topics" TEXT[],
    "isTopPerforming" BOOLEAN NOT NULL DEFAULT false,
    "performancePercentile" DOUBLE PRECISION,
    "postedAt" TIMESTAMP(3),
    "trackedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."competitor_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "relatedPostId" TEXT,
    "metrics" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "competitor_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."competitor_comparisons" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "competitorIds" TEXT[],
    "metrics" TEXT[],
    "comparisonData" JSONB,
    "lastUpdated" TIMESTAMP(3),
    "autoRefresh" BOOLEAN NOT NULL DEFAULT true,
    "refreshFrequency" TEXT NOT NULL DEFAULT 'daily',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "public"."users"("google_id");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "public"."accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "public"."accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "campaigns_organizationId_idx" ON "public"."campaigns"("organizationId");

-- CreateIndex
CREATE INDEX "posts_campaignId_createdAt_idx" ON "public"."posts"("campaignId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "posts_platform_status_idx" ON "public"."posts"("platform", "status");

-- CreateIndex
CREATE INDEX "posts_scheduledAt_idx" ON "public"."posts"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "public"."sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "public"."organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_domain_key" ON "public"."organizations"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_customDomain_key" ON "public"."organizations"("customDomain");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "public"."organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "public"."organizations"("status");

-- CreateIndex
CREATE INDEX "organizations_plan_idx" ON "public"."organizations"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "platform_connections_userId_platform_profileId_key" ON "public"."platform_connections"("userId", "platform", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_posts_connectionId_platformId_key" ON "public"."platform_posts"("connectionId", "platformId");

-- CreateIndex
CREATE INDEX "platform_metrics_postId_recordedAt_idx" ON "public"."platform_metrics"("postId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "platform_metrics_recordedAt_idx" ON "public"."platform_metrics"("recordedAt");

-- CreateIndex
CREATE INDEX "team_invitations_email_idx" ON "public"."team_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "psychology_principles_name_key" ON "public"."psychology_principles"("name");

-- CreateIndex
CREATE INDEX "psychology_principles_category_idx" ON "public"."psychology_principles"("category");

-- CreateIndex
CREATE INDEX "psychology_principles_effectivenessScore_idx" ON "public"."psychology_principles"("effectivenessScore" DESC);

-- CreateIndex
CREATE INDEX "brand_generations_userId_idx" ON "public"."brand_generations"("userId");

-- CreateIndex
CREATE INDEX "brand_generations_status_idx" ON "public"."brand_generations"("status");

-- CreateIndex
CREATE INDEX "psychology_metrics_generationId_idx" ON "public"."psychology_metrics"("generationId");

-- CreateIndex
CREATE INDEX "psychology_metrics_principleUsed_idx" ON "public"."psychology_metrics"("principleUsed");

-- CreateIndex
CREATE UNIQUE INDEX "user_psychology_preferences_userId_key" ON "public"."user_psychology_preferences"("userId");

-- CreateIndex
CREATE INDEX "analytics_events_userId_idx" ON "public"."analytics_events"("userId");

-- CreateIndex
CREATE INDEX "analytics_events_sessionId_idx" ON "public"."analytics_events"("sessionId");

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "public"."analytics_events"("timestamp");

-- CreateIndex
CREATE INDEX "reports_userId_idx" ON "public"."reports"("userId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "public"."reports"("status");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "public"."reports"("type");

-- CreateIndex
CREATE INDEX "scheduled_reports_userId_idx" ON "public"."scheduled_reports"("userId");

-- CreateIndex
CREATE INDEX "scheduled_reports_isActive_nextRunAt_idx" ON "public"."scheduled_reports"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "scheduled_reports_organizationId_idx" ON "public"."scheduled_reports"("organizationId");

-- CreateIndex
CREATE INDEX "report_templates_userId_idx" ON "public"."report_templates"("userId");

-- CreateIndex
CREATE INDEX "report_templates_organizationId_idx" ON "public"."report_templates"("organizationId");

-- CreateIndex
CREATE INDEX "report_templates_isSystem_idx" ON "public"."report_templates"("isSystem");

-- CreateIndex
CREATE INDEX "report_templates_category_idx" ON "public"."report_templates"("category");

-- CreateIndex
CREATE INDEX "report_deliveries_reportId_idx" ON "public"."report_deliveries"("reportId");

-- CreateIndex
CREATE INDEX "report_deliveries_scheduledReportId_idx" ON "public"."report_deliveries"("scheduledReportId");

-- CreateIndex
CREATE INDEX "report_deliveries_status_idx" ON "public"."report_deliveries"("status");

-- CreateIndex
CREATE INDEX "sentiment_analyses_userId_idx" ON "public"."sentiment_analyses"("userId");

-- CreateIndex
CREATE INDEX "sentiment_analyses_contentType_contentId_idx" ON "public"."sentiment_analyses"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "sentiment_analyses_sentiment_idx" ON "public"."sentiment_analyses"("sentiment");

-- CreateIndex
CREATE INDEX "sentiment_analyses_analyzedAt_idx" ON "public"."sentiment_analyses"("analyzedAt");

-- CreateIndex
CREATE INDEX "sentiment_trends_userId_date_idx" ON "public"."sentiment_trends"("userId", "date");

-- CreateIndex
CREATE INDEX "sentiment_trends_organizationId_date_idx" ON "public"."sentiment_trends"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "sentiment_trends_userId_platform_date_key" ON "public"."sentiment_trends"("userId", "platform", "date");

-- CreateIndex
CREATE INDEX "engagement_predictions_userId_idx" ON "public"."engagement_predictions"("userId");

-- CreateIndex
CREATE INDEX "engagement_predictions_platform_idx" ON "public"."engagement_predictions"("platform");

-- CreateIndex
CREATE INDEX "engagement_predictions_predictedAt_idx" ON "public"."engagement_predictions"("predictedAt");

-- CreateIndex
CREATE INDEX "quotes_category_idx" ON "public"."quotes"("category");

-- CreateIndex
CREATE INDEX "quotes_userId_idx" ON "public"."quotes"("userId");

-- CreateIndex
CREATE INDEX "quotes_tags_idx" ON "public"."quotes"("tags");

-- CreateIndex
CREATE INDEX "quotes_aiGenerated_idx" ON "public"."quotes"("aiGenerated");

-- CreateIndex
CREATE INDEX "quote_collections_userId_idx" ON "public"."quote_collections"("userId");

-- CreateIndex
CREATE INDEX "tasks_userId_idx" ON "public"."tasks"("userId");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "public"."tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "public"."tasks"("priority");

-- CreateIndex
CREATE INDEX "tasks_dueDate_idx" ON "public"."tasks"("dueDate");

-- CreateIndex
CREATE INDEX "tasks_userId_status_dueDate_idx" ON "public"."tasks"("userId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_assigneeId_priority_idx" ON "public"."tasks"("assigneeId", "priority");

-- CreateIndex
CREATE INDEX "personas_userId_idx" ON "public"."personas"("userId");

-- CreateIndex
CREATE INDEX "personas_status_idx" ON "public"."personas"("status");

-- CreateIndex
CREATE INDEX "persona_training_data_personaId_idx" ON "public"."persona_training_data"("personaId");

-- CreateIndex
CREATE INDEX "persona_training_data_sourceType_idx" ON "public"."persona_training_data"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "persona_training_data_personaId_contentHash_key" ON "public"."persona_training_data"("personaId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "public"."subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeCustomerId_key" ON "public"."subscriptions"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "public"."subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "public"."subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_plan_idx" ON "public"."subscriptions"("plan");

-- CreateIndex
CREATE INDEX "roles_organizationId_idx" ON "public"."roles"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organizationId_name_key" ON "public"."roles"("organizationId", "name");

-- CreateIndex
CREATE INDEX "user_roles_userId_idx" ON "public"."user_roles"("userId");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "public"."user_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "public"."user_roles"("userId", "roleId");

-- CreateIndex
CREATE INDEX "permission_audits_organizationId_idx" ON "public"."permission_audits"("organizationId");

-- CreateIndex
CREATE INDEX "permission_audits_performedBy_idx" ON "public"."permission_audits"("performedBy");

-- CreateIndex
CREATE INDEX "permission_audits_createdAt_idx" ON "public"."permission_audits"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_shares_accessLink_key" ON "public"."content_shares"("accessLink");

-- CreateIndex
CREATE INDEX "content_shares_contentType_contentId_idx" ON "public"."content_shares"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "content_shares_sharedWithUserId_idx" ON "public"."content_shares"("sharedWithUserId");

-- CreateIndex
CREATE INDEX "content_shares_sharedWithTeamId_idx" ON "public"."content_shares"("sharedWithTeamId");

-- CreateIndex
CREATE INDEX "content_shares_sharedById_idx" ON "public"."content_shares"("sharedById");

-- CreateIndex
CREATE INDEX "content_shares_accessLink_idx" ON "public"."content_shares"("accessLink");

-- CreateIndex
CREATE INDEX "content_comments_contentType_contentId_idx" ON "public"."content_comments"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "content_comments_authorId_idx" ON "public"."content_comments"("authorId");

-- CreateIndex
CREATE INDEX "content_comments_parentId_idx" ON "public"."content_comments"("parentId");

-- CreateIndex
CREATE INDEX "content_access_logs_contentType_contentId_idx" ON "public"."content_access_logs"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "content_access_logs_userId_idx" ON "public"."content_access_logs"("userId");

-- CreateIndex
CREATE INDEX "content_access_logs_createdAt_idx" ON "public"."content_access_logs"("createdAt");

-- CreateIndex
CREATE INDEX "team_notifications_userId_read_idx" ON "public"."team_notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "team_notifications_organizationId_idx" ON "public"."team_notifications"("organizationId");

-- CreateIndex
CREATE INDEX "team_notifications_createdAt_idx" ON "public"."team_notifications"("createdAt");

-- CreateIndex
CREATE INDEX "calendar_posts_organizationId_scheduledFor_idx" ON "public"."calendar_posts"("organizationId", "scheduledFor" DESC);

-- CreateIndex
CREATE INDEX "calendar_posts_userId_status_idx" ON "public"."calendar_posts"("userId", "status");

-- CreateIndex
CREATE INDEX "calendar_posts_status_scheduledFor_idx" ON "public"."calendar_posts"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "calendar_posts_campaignId_idx" ON "public"."calendar_posts"("campaignId");

-- CreateIndex
CREATE INDEX "calendar_posts_parentPostId_idx" ON "public"."calendar_posts"("parentPostId");

-- CreateIndex
CREATE INDEX "ab_tests_userId_idx" ON "public"."ab_tests"("userId");

-- CreateIndex
CREATE INDEX "ab_tests_organizationId_idx" ON "public"."ab_tests"("organizationId");

-- CreateIndex
CREATE INDEX "ab_tests_status_idx" ON "public"."ab_tests"("status");

-- CreateIndex
CREATE INDEX "ab_test_variants_testId_idx" ON "public"."ab_test_variants"("testId");

-- CreateIndex
CREATE INDEX "ab_test_results_testId_idx" ON "public"."ab_test_results"("testId");

-- CreateIndex
CREATE INDEX "ab_test_results_variantId_idx" ON "public"."ab_test_results"("variantId");

-- CreateIndex
CREATE INDEX "ab_test_results_timestamp_idx" ON "public"."ab_test_results"("timestamp");

-- CreateIndex
CREATE INDEX "tracked_competitors_userId_idx" ON "public"."tracked_competitors"("userId");

-- CreateIndex
CREATE INDEX "tracked_competitors_isActive_idx" ON "public"."tracked_competitors"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_competitors_userId_domain_key" ON "public"."tracked_competitors"("userId", "domain");

-- CreateIndex
CREATE INDEX "competitor_snapshots_competitorId_idx" ON "public"."competitor_snapshots"("competitorId");

-- CreateIndex
CREATE INDEX "competitor_snapshots_platform_idx" ON "public"."competitor_snapshots"("platform");

-- CreateIndex
CREATE INDEX "competitor_snapshots_snapshotAt_idx" ON "public"."competitor_snapshots"("snapshotAt");

-- CreateIndex
CREATE INDEX "competitor_posts_competitorId_idx" ON "public"."competitor_posts"("competitorId");

-- CreateIndex
CREATE INDEX "competitor_posts_platform_idx" ON "public"."competitor_posts"("platform");

-- CreateIndex
CREATE INDEX "competitor_posts_postedAt_idx" ON "public"."competitor_posts"("postedAt");

-- CreateIndex
CREATE INDEX "competitor_posts_isTopPerforming_idx" ON "public"."competitor_posts"("isTopPerforming");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_posts_competitorId_platform_externalId_key" ON "public"."competitor_posts"("competitorId", "platform", "externalId");

-- CreateIndex
CREATE INDEX "competitor_alerts_userId_idx" ON "public"."competitor_alerts"("userId");

-- CreateIndex
CREATE INDEX "competitor_alerts_competitorId_idx" ON "public"."competitor_alerts"("competitorId");

-- CreateIndex
CREATE INDEX "competitor_alerts_isRead_idx" ON "public"."competitor_alerts"("isRead");

-- CreateIndex
CREATE INDEX "competitor_alerts_createdAt_idx" ON "public"."competitor_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "competitor_comparisons_userId_idx" ON "public"."competitor_comparisons"("userId");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."campaigns" ADD CONSTRAINT "campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."campaigns" ADD CONSTRAINT "campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."api_usage" ADD CONSTRAINT "api_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."platform_connections" ADD CONSTRAINT "platform_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."platform_posts" ADD CONSTRAINT "platform_posts_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "public"."platform_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."platform_metrics" ADD CONSTRAINT "platform_metrics_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."platform_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_invitations" ADD CONSTRAINT "team_invitations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_invitations" ADD CONSTRAINT "team_invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."brand_generations" ADD CONSTRAINT "brand_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."psychology_metrics" ADD CONSTRAINT "psychology_metrics_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "public"."brand_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_psychology_preferences" ADD CONSTRAINT "user_psychology_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitive_analyses" ADD CONSTRAINT "competitive_analyses_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "public"."brand_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheduled_reports" ADD CONSTRAINT "scheduled_reports_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."report_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."persona_training_data" ADD CONSTRAINT "persona_training_data_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "public"."personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roles" ADD CONSTRAINT "roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_comments" ADD CONSTRAINT "content_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."calendar_posts" ADD CONSTRAINT "calendar_posts_parentPostId_fkey" FOREIGN KEY ("parentPostId") REFERENCES "public"."calendar_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ab_test_variants" ADD CONSTRAINT "ab_test_variants_testId_fkey" FOREIGN KEY ("testId") REFERENCES "public"."ab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ab_test_results" ADD CONSTRAINT "ab_test_results_testId_fkey" FOREIGN KEY ("testId") REFERENCES "public"."ab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_snapshots" ADD CONSTRAINT "competitor_snapshots_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "public"."tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_posts" ADD CONSTRAINT "competitor_posts_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "public"."tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_alerts" ADD CONSTRAINT "competitor_alerts_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "public"."tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

