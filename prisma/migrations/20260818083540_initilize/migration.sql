-- CreateEnum
CREATE TYPE "SeoContentType" AS ENUM ('blog_local_authority', 'how_to', 'listicle', 'news_item', 'comparison', 'case_study');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('enquiry', 'qualified', 'converted');

-- CreateEnum
CREATE TYPE "LeadContactMethod" AS ENUM ('form_submission', 'phone_call', 'direction_request', 'booking');

-- CreateTable
CREATE TABLE "users" (
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
    "conversion_copy_variant" TEXT DEFAULT 'control',
    "openrouter_api_key" TEXT,
    "anthropic_api_key" TEXT,
    "openai_api_key" TEXT,
    "gemini_api_key" TEXT,
    "company" TEXT,
    "job_role" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "social_links" JSONB,
    "preferences" JSONB,
    "user_settings" JSONB,
    "reset_code" TEXT,
    "reset_code_expires" TIMESTAMP(3),
    "reset_token" TEXT,
    "reset_token_expires" TIMESTAMP(3),
    "verification_code" TEXT,
    "verification_expires" TIMESTAMP(3),
    "organization_id" TEXT,
    "is_multi_business_owner" BOOLEAN NOT NULL DEFAULT true,
    "active_organization_id" TEXT,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_step" INTEGER NOT NULL DEFAULT 0,
    "business_profile_complete" BOOLEAN NOT NULL DEFAULT false,
    "api_key_configured" BOOLEAN NOT NULL DEFAULT false,
    "api_key_valid" BOOLEAN NOT NULL DEFAULT false,
    "api_key_last_validated" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Brisbane',
    "deleted_at" TIMESTAMP(3),
    "referral_code" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
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
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "content" JSONB,
    "analytics" JSONB,
    "settings" JSONB,
    "deleted_at" TIMESTAMP(3),
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "analytics" JSONB,
    "deleted_at" TIMESTAMP(3),
    "campaign_id" TEXT NOT NULL,
    "predicted_engagement" DOUBLE PRECISION,
    "confidence_score" DOUBLE PRECISION,
    "cross_client_percentile_industry" INTEGER,
    "feature_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "website_url" TEXT,
    "domain" TEXT,
    "pages" INTEGER,
    "colors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "model" TEXT,
    "tokens" INTEGER,
    "cost" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_data" JSONB,
    "response_data" JSONB,
    "error_message" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_pkce_states" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "code_verifier" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "link_to_user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_pkce_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
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
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "description" TEXT,
    "events" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_delivered_at" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_metrics" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_latency_ms" INTEGER,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "quality_score" DOUBLE PRECISION,
    "week_start" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "entity" TEXT,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT NOT NULL DEFAULT 'system',
    "outcome" TEXT NOT NULL DEFAULT 'success',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parent_org_id" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "settings" JSONB,
    "first_win_detected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "domain" TEXT,
    "custom_domain" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "abn" TEXT,
    "team_size" TEXT,
    "phone_number" TEXT,
    "ai_generated_data" JSONB,
    "social_handles" JSONB,
    "logo" TEXT,
    "primary_color" TEXT,
    "favicon" TEXT,
    "stripe_customer_id" TEXT,
    "billing_email" TEXT,
    "billing_status" TEXT NOT NULL DEFAULT 'active',
    "max_users" INTEGER NOT NULL DEFAULT 5,
    "max_posts" INTEGER NOT NULL DEFAULT 500,
    "max_campaigns" INTEGER NOT NULL DEFAULT 10,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "lastApprovedAt" TIMESTAMP(3),
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "calendar_mode" TEXT NOT NULL DEFAULT 'shadow',
    "auto_publish_paused" BOOLEAN NOT NULL DEFAULT false,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "live_mode_tier" INTEGER NOT NULL DEFAULT 0,
    "live_mode_activated_at" TIMESTAMP(3),
    "perpetual_reviewer" BOOLEAN NOT NULL DEFAULT false,
    "shadow_mode_approval_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consecutive_threshold_passes" INTEGER NOT NULL DEFAULT 0,
    "nudge_dismissed_at" JSONB,
    "billing_anchor_date" INTEGER,
    "invite_prompt_dismissed_at" TIMESTAMP(3),
    "invite_prompt_dismiss_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "review_link" TEXT NOT NULL,
    "recipient_phone" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "follow_up_sent_at" TIMESTAMP(3),
    "review_received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_topic_suggestions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "current_rank" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opportunity_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_topic_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_targets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "location" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "auto_seeded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_rank_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "keyword_target_id" TEXT NOT NULL,
    "position" DOUBLE PRECISION,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "ctr" DOUBLE PRECISION,
    "snapshot_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_rank_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follower_snapshots" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "platform" TEXT NOT NULL,
    "followers" INTEGER NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follower_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visibility_scores" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "review_score" INTEGER NOT NULL,
    "gbp_score" INTEGER NOT NULL,
    "content_score" INTEGER NOT NULL,
    "rank_score" INTEGER NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visibility_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "platform" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "profile_id" TEXT,
    "profile_name" TEXT,
    "account_type" TEXT NOT NULL DEFAULT 'personal',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync" TIMESTAMP(3),
    "metadata" JSONB,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_posts" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "media_urls" TEXT[],
    "hashtags" TEXT[],
    "mentions" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduled_for" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "error_message" TEXT,
    "metadata" JSONB,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_metrics" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "engagement_rate" DOUBLE PRECISION,
    "metadata" JSONB,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "message" TEXT,
    "campaign_access" JSONB,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "organization_id" TEXT,

    CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psychology_principles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "branding_application" JSONB NOT NULL DEFAULT '{}',
    "trigger_words" TEXT[],
    "audience_relevance" JSONB NOT NULL DEFAULT '{}',
    "effectiveness_score" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psychology_principles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_generations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "business_type" TEXT NOT NULL,
    "target_audience" JSONB NOT NULL,
    "brand_goals" TEXT[],
    "tone_preference" TEXT,
    "psychology_strategy" JSONB NOT NULL,
    "brand_names" JSONB NOT NULL,
    "taglines" JSONB NOT NULL,
    "metadata_packages" JSONB NOT NULL DEFAULT '{}',
    "implementation_guide" JSONB NOT NULL DEFAULT '{}',
    "effectiveness_score" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psychology_metrics" (
    "id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "principle_used" TEXT NOT NULL,
    "variant_type" TEXT NOT NULL,
    "variant_content" TEXT NOT NULL,
    "engagement_score" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "conversion_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "recall_score" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "click_through_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "client_satisfaction" INTEGER,
    "test_duration_hours" INTEGER NOT NULL DEFAULT 24,
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "tested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psychology_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_psychology_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "preferred_principles" TEXT[],
    "avoided_principles" TEXT[],
    "industry_focus" TEXT,
    "target_demographic" JSONB NOT NULL DEFAULT '{}',
    "success_metrics" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_psychology_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitive_analyses" (
    "id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "competitor_name" TEXT NOT NULL,
    "competitor_tagline" TEXT,
    "identified_principles" TEXT[],
    "differentiation_strategy" TEXT,
    "market_position" TEXT,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitive_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "platform" TEXT,
    "content_id" TEXT,
    "campaign_id" TEXT,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "date_range" JSONB,
    "filters" JSONB,
    "data" JSONB,
    "file_url" TEXT,
    "file_size" INTEGER,
    "generated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentiment_analyses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "content_id" TEXT,
    "text" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "emotions" JSONB,
    "tone_indicators" JSONB,
    "key_phrases" TEXT[],
    "predicted_engagement" JSONB,
    "actual_engagement" JSONB,
    "prediction_accuracy" DOUBLE PRECISION,
    "platform" TEXT,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT,

    CONSTRAINT "sentiment_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "source" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "sentiment" TEXT,
    "reading_level" TEXT,
    "user_id" TEXT,
    "campaign_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_library" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "platform" TEXT,
    "category" TEXT,
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "platform" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hook_type" TEXT,
    "tone" TEXT,
    "topic" TEXT,
    "target_length" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "metadata" JSONB,
    "scheduled_post_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "category" TEXT NOT NULL,
    "layer" TEXT DEFAULT 'task',
    "platforms" TEXT[],
    "structure" JSONB NOT NULL,
    "variables" TEXT[],
    "tips" TEXT[],
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "due_date" TIMESTAMP(3),
    "tags" TEXT[],
    "category" TEXT,
    "agency_task_id" VARCHAR(10),
    "estimated_time" INTEGER,
    "actual_time" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "column_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "user_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "campaign_id" TEXT,
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "style" TEXT NOT NULL DEFAULT 'formal',
    "vocabulary" TEXT NOT NULL DEFAULT 'standard',
    "emotion" TEXT NOT NULL DEFAULT 'neutral',
    "training_sources_count" INTEGER NOT NULL DEFAULT 0,
    "training_words_count" INTEGER NOT NULL DEFAULT 0,
    "training_samples_count" INTEGER NOT NULL DEFAULT 0,
    "accuracy" INTEGER NOT NULL DEFAULT 0,
    "last_trained" TIMESTAMP(3),
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_training_data" (
    "id" TEXT NOT NULL,
    "persona_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_url" TEXT,
    "platform" TEXT,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "extracted_tone" JSONB,
    "extracted_vocabulary" JSONB,
    "extracted_patterns" JSONB,
    "ai_analysis" JSONB,
    "sentiment" TEXT,
    "topics" TEXT[],
    "embedding" JSONB,
    "engagement" INTEGER,
    "processed_at" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persona_training_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "trial_start" TIMESTAMP(3),
    "trial_end" TIMESTAMP(3),
    "max_social_accounts" INTEGER NOT NULL DEFAULT 2,
    "max_ai_posts" INTEGER NOT NULL DEFAULT 10,
    "max_personas" INTEGER NOT NULL DEFAULT 1,
    "current_ai_posts" INTEGER NOT NULL DEFAULT 0,
    "last_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dunning_states" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "last_failure_at" TIMESTAMP(3),
    "recovered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dunning_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "platform" TEXT,
    "post_id" TEXT,
    "brand_name" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_investments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT,
    "description" TEXT,
    "platform" TEXT,
    "post_id" TEXT,
    "invested_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'lead',
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsor_deals" (
    "id" TEXT NOT NULL,
    "sponsor_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "value" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stage" TEXT NOT NULL DEFAULT 'negotiation',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "revenue_entry_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsor_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_deliverables" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "platform" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "content_url" TEXT,
    "post_id" TEXT,
    "client_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organization_id" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_audits" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_user_id" TEXT,
    "target_role_id" TEXT,
    "performed_by" TEXT NOT NULL,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" TEXT NOT NULL,

    CONSTRAINT "permission_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_shares" (
    "id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "shared_with_user_id" TEXT,
    "shared_with_team_id" TEXT,
    "shared_with_email" TEXT,
    "permission" TEXT NOT NULL DEFAULT 'view',
    "can_download" BOOLEAN NOT NULL DEFAULT true,
    "can_reshare" BOOLEAN NOT NULL DEFAULT false,
    "access_link" TEXT,
    "password" TEXT,
    "expires_at" TIMESTAMP(3),
    "max_views" INTEGER,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "shared_by_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_accessed_at" TIMESTAMP(3),

    CONSTRAINT "content_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_comments" (
    "id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parent_id" TEXT,
    "author_id" TEXT NOT NULL,
    "sentiment" TEXT,
    "sentiment_score" DOUBLE PRECISION,
    "emotions" JSONB,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "mentions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "action_url" TEXT,
    "related_user_id" TEXT,
    "related_content_type" TEXT,
    "related_content_id" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "team_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "workflow_id" TEXT,
    "submitted_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "total_steps" INTEGER NOT NULL DEFAULT 1,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3),
    "metadata" JSONB,
    "sla_reminder_sent_at" TIMESTAMP(3),
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_comments" (
    "id" TEXT NOT NULL,
    "approval_request_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intentscape_workspaces" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "retention_class" TEXT NOT NULL DEFAULT 'standard',
    "origin_signal_hash" TEXT NOT NULL,
    "active_context_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "intentscape_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intentscape_artifacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "logical_path" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "parent_version" INTEGER,
    "evidence_state" TEXT NOT NULL DEFAULT 'unverified',
    "lineage" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentscape_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intentscape_vision_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "context_version" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "generator_provider" TEXT,
    "generator_model" TEXT,
    "evaluator_provider" TEXT,
    "evaluator_model" TEXT,
    "confidence" DOUBLE PRECISION,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_micros" INTEGER,
    "vision_artifact_id" TEXT,
    "anchoring_artifact_id" TEXT,
    "evaluation_artifact_id" TEXT,
    "rejection_reasons" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "intentscape_vision_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intentscape_hypotheses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "vision_run_id" TEXT NOT NULL,
    "hypothesis_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "causal_mechanism" TEXT NOT NULL,
    "desired_change" TEXT NOT NULL,
    "affected_stakeholders" JSONB NOT NULL,
    "evidence_for" JSONB NOT NULL DEFAULT '[]',
    "evidence_against" JSONB NOT NULL DEFAULT '[]',
    "invalidating_assumption" TEXT NOT NULL,
    "main_risk" TEXT NOT NULL,
    "adjacent_value" TEXT NOT NULL,
    "research_branch_ids" JSONB NOT NULL,
    "rank" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentscape_hypotheses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intentscape_goal_contracts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "vision_run_id" TEXT NOT NULL,
    "hypothesis_id" TEXT NOT NULL,
    "hypothesis_version" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "context_version" INTEGER NOT NULL,
    "desired_change" TEXT NOT NULL,
    "primary_stakeholder" TEXT NOT NULL,
    "acceptance_criteria" JSONB NOT NULL,
    "exclusions" JSONB NOT NULL DEFAULT '[]',
    "authority_boundaries" JSONB NOT NULL,
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'approved',
    "approved_by" TEXT NOT NULL,
    "approved_at" TIMESTAMPTZ(6) NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentscape_goal_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intentscape_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "artifact_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentscape_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_packets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "cleaned_text" TEXT NOT NULL,
    "sensitivity" TEXT NOT NULL,
    "board_input_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ontology_refs" TEXT[],
    "team_route" TEXT[],
    "scenario_state" TEXT NOT NULL,
    "approval_gate" TEXT NOT NULL,
    "risks" TEXT[],
    "next_action" TEXT NOT NULL,
    "outcome_metric" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "safety_flags" TEXT[],
    "routing_hints" JSONB,
    "evidence_refs" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "command_packets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "content_types" JSONB NOT NULL DEFAULT '["post"]',
    "auto_approve_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "platforms" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "media_urls" TEXT[],
    "tags" TEXT[],
    "hashtags" TEXT[],
    "mentions" TEXT[],
    "recurrence_type" TEXT,
    "recurrence_interval" INTEGER,
    "recurrence_end_date" TIMESTAMP(3),
    "recurrence_occurrences" INTEGER,
    "recurrence_days_of_week" INTEGER[],
    "recurrence_day_of_month" INTEGER,
    "parent_post_id" TEXT,
    "campaign_id" TEXT,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "metadata" JSONB,
    "analytics" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "predicted_engagement" DOUBLE PRECISION,
    "confidence_score" DOUBLE PRECISION,
    "cross_client_percentile_industry" INTEGER,
    "feature_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "calendar_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_tests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "duration" INTEGER NOT NULL DEFAULT 7,
    "platform" TEXT,
    "target_audience" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "winner" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recommendations" TEXT[],
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "campaign_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_test_variants" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image" TEXT,
    "cta" TEXT,
    "hashtags" TEXT[],
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_test_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_test_results" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "conversion_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uplift" DOUBLE PRECISION,
    "p_value" DOUBLE PRECISION,

    CONSTRAINT "ab_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_competitors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "logo_url" TEXT,
    "description" TEXT,
    "industry" TEXT,
    "twitter_handle" TEXT,
    "instagram_handle" TEXT,
    "linkedin_handle" TEXT,
    "facebook_handle" TEXT,
    "youtube_handle" TEXT,
    "tiktok_handle" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "track_posts" BOOLEAN NOT NULL DEFAULT true,
    "track_metrics" BOOLEAN NOT NULL DEFAULT true,
    "tracking_frequency" TEXT NOT NULL DEFAULT 'daily',
    "alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_tracked_at" TIMESTAMP(3),

    CONSTRAINT "tracked_competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_keyword_gaps" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "our_position" DOUBLE PRECISION,
    "competitor_position" DOUBLE PRECISION,
    "impressions" INTEGER,
    "displacement_score" DOUBLE PRECISION,
    "snapshot_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_keyword_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "status" TEXT NOT NULL DEFAULT 'active',
    "context_snapshot" JSONB,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "tokens_used" INTEGER,
    "latency_ms" INTEGER,
    "action_items" JSONB,
    "suggestions" JSONB,
    "rating" INTEGER,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_weekly_digests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "highlights" JSONB NOT NULL,
    "action_items" JSONB NOT NULL,
    "opportunities" JSONB NOT NULL,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "email_sent_at" TIMESTAMP(3),
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "opened_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_weekly_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_health_scores" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 50,
    "trend" TEXT NOT NULL DEFAULT 'stable',
    "risk_level" TEXT NOT NULL DEFAULT 'medium',
    "login_score" INTEGER NOT NULL DEFAULT 50,
    "content_score" INTEGER NOT NULL DEFAULT 50,
    "feature_score" INTEGER NOT NULL DEFAULT 50,
    "engagement_score" INTEGER NOT NULL DEFAULT 50,
    "growth_score" INTEGER NOT NULL DEFAULT 50,
    "days_active" INTEGER NOT NULL DEFAULT 0,
    "features_used" INTEGER NOT NULL DEFAULT 0,
    "content_created" INTEGER NOT NULL DEFAULT 0,
    "last_login_days_ago" INTEGER NOT NULL DEFAULT 0,
    "alert_sent" BOOLEAN NOT NULL DEFAULT false,
    "alert_sent_at" TIMESTAMP(3),
    "last_alert_type" TEXT,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_health_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_streaks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "total_days" INTEGER NOT NULL DEFAULT 0,
    "last_active_date" DATE,
    "level" INTEGER NOT NULL DEFAULT 1,
    "points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "achievement_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "progress" INTEGER NOT NULL DEFAULT 100,
    "unlocked_at" TIMESTAMP(3),
    "points_awarded" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "referee_id" TEXT,
    "referee_email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "referrer_rewarded" BOOLEAN NOT NULL DEFAULT false,
    "referee_rewarded" BOOLEAN NOT NULL DEFAULT false,
    "reward_type" TEXT,
    "reward_amount" INTEGER,
    "clicked_at" TIMESTAMP(3),
    "signed_up_at" TIMESTAMP(3),
    "converted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_loyalty_tiers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "points" INTEGER NOT NULL DEFAULT 0,
    "lifetime_points" INTEGER NOT NULL DEFAULT 0,
    "months_active" INTEGER NOT NULL DEFAULT 0,
    "bonus_ai_credits" INTEGER NOT NULL DEFAULT 0,
    "discount_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priority_support" BOOLEAN NOT NULL DEFAULT false,
    "last_tier_change" TIMESTAMP(3),
    "next_tier_at" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_loyalty_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_surveys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trigger_event" TEXT,
    "score" INTEGER,
    "comment" TEXT,
    "tags" TEXT[],
    "follow_up_sent" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_at" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "author_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "credentials" JSONB,
    "social_links" JSONB,
    "avatar_url" TEXT,
    "same_as_urls" TEXT[],
    "expertise_areas" TEXT[],
    "verified_at" TIMESTAMP(3),
    "eeat_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "author_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_audits" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "audit_type" TEXT NOT NULL,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "eeat_score" JSONB,
    "geo_score" JSONB,
    "technical_score" JSONB,
    "recommendations" JSONB NOT NULL,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_audit_targets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "alert_threshold" INTEGER NOT NULL DEFAULT 10,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "last_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_audit_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_analyses" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_id" TEXT,
    "author_id" INTEGER,
    "content_url" TEXT,
    "content_text" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "citability_score" DOUBLE PRECISION NOT NULL,
    "structure_score" DOUBLE PRECISION NOT NULL,
    "multi_modal_score" DOUBLE PRECISION NOT NULL,
    "authority_score" DOUBLE PRECISION NOT NULL,
    "technical_score" DOUBLE PRECISION NOT NULL,
    "entity_coherence_score" DOUBLE PRECISION,
    "citable_passages" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "schema_issues" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_analyses" (
    "id" SERIAL NOT NULL,
    "geo_analysis_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "entity_count" INTEGER NOT NULL,
    "unique_entity_count" INTEGER NOT NULL,
    "proper_noun_density" DOUBLE PRECISION NOT NULL,
    "coherence_score" DOUBLE PRECISION NOT NULL,
    "entities" JSONB NOT NULL,
    "coherence_issues" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_research_reports" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sas_score" DOUBLE PRECISION,
    "executive_summary" TEXT,
    "methodology" TEXT,
    "findings" JSONB,
    "recommendations" JSONB,
    "full_content" TEXT,
    "data_sources" JSONB,
    "citations" JSONB,
    "dataset_url" TEXT,
    "schema_markup" JSONB,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organization_id" TEXT,

    CONSTRAINT "geo_research_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visual_assets" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "report_id" INTEGER,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "metadata" JSONB,
    "quality_score" DOUBLE PRECISION,
    "alt_text" TEXT,
    "caption" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visual_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_case_studies" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "suburb" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "coordinates" JSONB,
    "summary" TEXT NOT NULL,
    "challenge" TEXT,
    "solution" TEXT,
    "results" TEXT,
    "testimonial" TEXT,
    "before_images" TEXT[],
    "after_images" TEXT[],
    "diagrams" TEXT[],
    "schema_markup" JSONB,
    "nap_data" JSONB,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_case_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_authors" (
    "id" SERIAL NOT NULL,
    "post_id" TEXT NOT NULL,
    "author_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'author',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_ownerships" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "display_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "billing_status" TEXT NOT NULL DEFAULT 'active',
    "monthly_rate" DOUBLE PRECISION NOT NULL DEFAULT 249.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_keywords" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "keyword" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "platforms" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_checked_at" TIMESTAMP(3),
    "total_mentions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_mentions" (
    "id" TEXT NOT NULL,
    "keyword_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platform_post_id" TEXT NOT NULL,
    "platform_url" TEXT,
    "author_handle" TEXT NOT NULL,
    "author_name" TEXT,
    "author_avatar" TEXT,
    "author_followers" INTEGER,
    "content" TEXT NOT NULL,
    "media_urls" TEXT[],
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER,
    "sentiment" TEXT,
    "sentiment_score" DOUBLE PRECISION,
    "is_influencer" BOOLEAN NOT NULL DEFAULT false,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_bio_pages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bio" TEXT,
    "avatar_url" TEXT,
    "cover_url" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'default',
    "primary_color" TEXT NOT NULL DEFAULT '#06b6d4',
    "background_color" TEXT NOT NULL DEFAULT '#0f172a',
    "text_color" TEXT NOT NULL DEFAULT '#ffffff',
    "button_style" TEXT NOT NULL DEFAULT 'rounded',
    "social_links" JSONB NOT NULL DEFAULT '[]',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "show_branding" BOOLEAN NOT NULL DEFAULT true,
    "total_views" INTEGER NOT NULL DEFAULT 0,
    "total_clicks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "link_bio_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_bio_links" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "icon_type" TEXT,
    "icon_value" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_highlighted" BOOLEAN NOT NULL DEFAULT false,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "link_bio_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_networks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "api_key" TEXT,
    "tracking_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "commission_rate" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "network_id" TEXT,
    "name" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "affiliate_url" TEXT NOT NULL,
    "short_code" TEXT,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "conversion_count" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "product_name" TEXT,
    "product_image" TEXT,
    "category" TEXT,
    "tags" TEXT[],
    "auto_insert" BOOLEAN NOT NULL DEFAULT false,
    "keywords" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_link_clicks" (
    "id" TEXT NOT NULL,
    "link_id" TEXT NOT NULL,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "referer" TEXT,
    "country" TEXT,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "revenue" DECIMAL(12,2),
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_link_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_vetting_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "business_name" TEXT NOT NULL,
    "website" TEXT,
    "abn_number" TEXT,
    "business_location" TEXT,
    "overall_score" INTEGER NOT NULL,
    "seo_score" INTEGER,
    "aeo_score" INTEGER,
    "geo_score" INTEGER,
    "social_score" INTEGER,
    "seo_details" JSONB,
    "aeo_details" JSONB,
    "geo_details" JSONB,
    "social_details" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recommendations" JSONB,
    "vetting_approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_vetting_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "provider" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
    "masked_key" TEXT,
    "is_valid" BOOLEAN NOT NULL DEFAULT false,
    "last_validated_at" TIMESTAMP(3),
    "validation_error" TEXT,
    "last_used_at" TIMESTAMP(3),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_oauth_credentials" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "encrypted_client_id" TEXT NOT NULL,
    "encrypted_client_secret" TEXT NOT NULL,
    "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
    "masked_client_id" TEXT,
    "masked_client_secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "configured_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_oauth_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "currentStage" TEXT NOT NULL DEFAULT 'vetting',
    "completed_stages" TEXT[],
    "business_name" TEXT,
    "website" TEXT,
    "abn_number" TEXT,
    "business_location" TEXT,
    "vetting_approved" BOOLEAN NOT NULL DEFAULT false,
    "vetting_approved_at" TIMESTAMP(3),
    "api_credentials_added" BOOLEAN NOT NULL DEFAULT false,
    "api_setup_completed_at" TIMESTAMP(3),
    "required_providers" TEXT[],
    "selected_platforms" TEXT[],
    "platforms_approved_at" TIMESTAMP(3),
    "persona_data" JSONB,
    "persona_approved_at" TIMESTAMP(3),
    "audit_data" JSONB,
    "goals_data" JSONB,
    "posting_mode" TEXT,
    "social_profile_urls" JSONB,
    "status" TEXT NOT NULL DEFAULT 'in-progress',
    "completed_at" TIMESTAMP(3),
    "abandoned_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_generations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "script_content" JSONB,
    "video_url" TEXT,
    "thumbnail_url" TEXT,
    "youtube_video_id" TEXT,
    "published_at" TIMESTAMP(3),
    "scheduled_platforms" TEXT[],
    "metadata" JSONB,
    "mode" TEXT NOT NULL DEFAULT 'script',
    "provider" TEXT,
    "gen_model" TEXT,
    "provider_job_id" TEXT,
    "initiated_by" TEXT NOT NULL DEFAULT 'studio',
    "input_prompt" TEXT,
    "enhanced_prompt" TEXT,
    "input_image_url" TEXT,
    "method_card_id" TEXT,
    "modifier_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brand_card_id" TEXT,
    "aspect_ratio" TEXT,
    "duration_seconds" INTEGER,
    "audio_enabled" BOOLEAN NOT NULL DEFAULT false,
    "batch_group_id" TEXT,
    "seed" INTEGER,
    "spend_hold_id" TEXT,
    "estimated_cost_usd" DECIMAL(10,4),
    "actual_cost_usd" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_generations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "batch_group_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "seed" INTEGER,
    "input_prompt" TEXT NOT NULL,
    "enhanced_prompt" TEXT,
    "style" TEXT,
    "aspect_ratio" TEXT,
    "image_url" TEXT,
    "media_asset_id" TEXT,
    "grounded" BOOLEAN NOT NULL DEFAULT false,
    "reference_set" TEXT,
    "ref_count" INTEGER,
    "lora_id" TEXT,
    "lora_applied" BOOLEAN NOT NULL DEFAULT false,
    "kept" BOOLEAN,
    "rank" INTEGER,
    "feedback_at" TIMESTAMP(3),
    "estimated_cost_usd" DECIMAL(10,4),
    "actual_cost_usd" DECIMAL(10,4),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_provider_attempts" (
    "id" TEXT NOT NULL,
    "attempt_key" TEXT NOT NULL,
    "hold_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "cost_usd" DECIMAL(10,4),
    "output_width" INTEGER,
    "output_height" INTEGER,
    "input_image_count" INTEGER NOT NULL DEFAULT 0,
    "provider_job_id" TEXT,
    "window_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_provider_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_spend_events" (
    "id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "hold_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "initiated_by" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "delta_usd" DECIMAL(10,4) NOT NULL,
    "window_at" TIMESTAMP(3) NOT NULL,
    "run_id" TEXT,
    "media_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_spend_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_video_quotas" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "monthly_budget_usd" DECIMAL(10,4) NOT NULL DEFAULT 75,
    "daily_budget_usd" DECIMAL(10,4) NOT NULL DEFAULT 15,
    "spent_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "spent_today_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "spent_today_mcp_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "day_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_video_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_agency_campaigns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "provider_mode" TEXT NOT NULL DEFAULT 'mock',
    "product_name" TEXT NOT NULL,
    "primary_offer" TEXT NOT NULL,
    "board_memo" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_agency_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_agency_source_refs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "path" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'document',
    "required_for_claims" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "content_hash" TEXT,
    "retrieved_at" TIMESTAMP(3),
    "provider" TEXT,
    "excerpt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_agency_source_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_agency_claims" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "source_ref_id" TEXT,
    "statement" TEXT NOT NULL,
    "claim_type" TEXT NOT NULL,
    "evidence_status" TEXT NOT NULL DEFAULT 'blocked',
    "evidence_notes" TEXT,
    "metadata" JSONB,
    "approval_status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_agency_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_agency_assets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_asset_id" TEXT,
    "asset_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "licence_status" TEXT NOT NULL DEFAULT 'pending',
    "licence_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_agency_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_agency_qa_reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'blocked',
    "blocked_reasons" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "checks" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_agency_qa_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_agency_export_packages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'blocked',
    "formats" TEXT[],
    "artifact_manifest" JSONB NOT NULL,
    "handoff_notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_agency_export_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_agency_signals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "external_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_kind" TEXT NOT NULL,
    "source_label" TEXT NOT NULL,
    "source_url" TEXT,
    "source_path" TEXT,
    "permission_context" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "business" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "audience_segment" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "freshness" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "commercial_impact" DOUBLE PRECISION NOT NULL,
    "creative_potential" DOUBLE PRECISION NOT NULL,
    "risk" DOUBLE PRECISION NOT NULL,
    "score_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'captured',
    "risk_state" TEXT NOT NULL DEFAULT 'blocked',
    "risk_reasons" JSONB NOT NULL DEFAULT '[]',
    "approval_status" TEXT NOT NULL DEFAULT 'blocked',
    "blocked_reasons" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "raw_signal" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_agency_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_agency_opportunities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "signal_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "risk" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approval_status" TEXT NOT NULL DEFAULT 'blocked',
    "blocked_reasons" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "next_action" TEXT NOT NULL,
    "outcome_metric" TEXT NOT NULL,
    "raw_opportunity" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_agency_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_agency_outcome_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "signal_id" TEXT NOT NULL,
    "opportunity_id" TEXT,
    "event_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'observed',
    "outcome_metric" TEXT,
    "observed_value" TEXT,
    "confidence" DOUBLE PRECISION,
    "notes" TEXT,
    "metadata" JSONB,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_agency_outcome_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_agents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "goal" TEXT NOT NULL,
    "max_claims_per_run" INTEGER NOT NULL DEFAULT 5,
    "cadence" TEXT NOT NULL DEFAULT 'manual',
    "config" JSONB,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_agent_runs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "triggered_by_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "opportunities_considered" INTEGER NOT NULL DEFAULT 0,
    "claims_proposed" INTEGER NOT NULL DEFAULT 0,
    "evidence_gaps_flagged" INTEGER NOT NULL DEFAULT 0,
    "qa_report_id" TEXT,
    "summary" TEXT,
    "artifacts" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,

    CONSTRAINT "marketing_agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL DEFAULT 'manual',
    "triggered_by" TEXT NOT NULL,
    "current_step_index" INTEGER NOT NULL DEFAULT 0,
    "total_steps" INTEGER NOT NULL DEFAULT 0,
    "input_data" JSONB,
    "output_data" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "batch_id" TEXT,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_executions" (
    "id" TEXT NOT NULL,
    "workflow_execution_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "step_name" TEXT NOT NULL,
    "step_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input_data" JSONB,
    "output_data" JSONB,
    "confidence_score" DOUBLE PRECISION,
    "auto_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorityAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "contentText" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "claimsFound" INTEGER NOT NULL,
    "claimsVerified" INTEGER NOT NULL,
    "claimsFailed" INTEGER NOT NULL,
    "sourceBreakdown" JSONB NOT NULL,
    "analysisResult" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorityAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorityCitation" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "citationText" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorityCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitationMonitor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "contentUrl" TEXT NOT NULL,
    "lastChecked" TIMESTAMP(3),
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "platforms" JSONB NOT NULL,
    "alertOnChange" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CitationMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sampleText" TEXT NOT NULL,
    "fingerprint" JSONB NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCapsule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "capsuleOutput" JSONB NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "extractability" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCapsule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentQualityAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "contentText" TEXT NOT NULL,
    "humanessScore" DOUBLE PRECISION NOT NULL,
    "slopDensity" DOUBLE PRECISION NOT NULL,
    "ttr" DOUBLE PRECISION,
    "fleschScore" DOUBLE PRECISION,
    "passRate" BOOLEAN NOT NULL,
    "slopMatchCount" INTEGER NOT NULL,
    "auditResult" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentQualityAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EEATAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "contentText" TEXT NOT NULL,
    "contentUrl" TEXT,
    "experienceScore" DOUBLE PRECISION NOT NULL,
    "expertiseScore" DOUBLE PRECISION NOT NULL,
    "authorityScore" DOUBLE PRECISION NOT NULL,
    "trustScore" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "auditResult" JSONB NOT NULL,
    "assetPlan" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EEATAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "foundingDate" TEXT,
    "hasPhysicalLocation" BOOLEAN NOT NULL DEFAULT false,
    "address" JSONB,
    "phone" TEXT,
    "wikidataUrl" TEXT,
    "wikipediaUrl" TEXT,
    "linkedinUrl" TEXT,
    "crunchbaseUrl" TEXT,
    "youtubeUrl" TEXT,
    "twitterUrl" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "wikidataQId" TEXT,
    "kgmid" TEXT,
    "kgConfidence" DOUBLE PRECISION,
    "entityGraph" JSONB,
    "consistencyScore" DOUBLE PRECISION,
    "consistencyReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCredential" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "dateIssued" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "url" TEXT,
    "description" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandMention" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publishedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "apiSource" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalistContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailScore" INTEGER,
    "outlet" TEXT NOT NULL,
    "outletDomain" TEXT NOT NULL,
    "title" TEXT,
    "location" TEXT,
    "beats" TEXT[],
    "recentArticles" JSONB,
    "beatsUpdatedAt" TIMESTAMP(3),
    "twitterHandle" TEXT,
    "linkedinUrl" TEXT,
    "notes" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'cold',
    "lastContactedAt" TIMESTAMP(3),
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalistContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRPitch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "journalistId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "bodyDraft" TEXT,
    "personalisation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "campaignId" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PRPitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaCoverage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "pitchId" TEXT,
    "journalistId" TEXT,
    "url" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "outlet" TEXT NOT NULL,
    "outletDomain" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "apiSource" TEXT NOT NULL,
    "estimatedReach" INTEGER,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "tier" TEXT NOT NULL DEFAULT 'tier3',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressRelease" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "subheading" TEXT,
    "body" TEXT NOT NULL,
    "boilerplate" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "datePublished" TIMESTAMP(3),
    "location" TEXT,
    "category" TEXT,
    "keywords" TEXT[],
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "distributedTo" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRDistribution" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "channelUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PRDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "submissionUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'researched',
    "description" TEXT,
    "nominationDraft" TEXT,
    "entryFee" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceNote" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectoryListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "directoryName" TEXT NOT NULL,
    "directoryUrl" TEXT NOT NULL,
    "listingUrl" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'identified',
    "domainAuthority" INTEGER,
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "submittedAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "isAiIndexed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionTracker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacklinkProspect" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "targetDomain" TEXT NOT NULL,
    "domainAuthority" INTEGER,
    "pageRank" DOUBLE PRECISION,
    "opportunityType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'identified',
    "pitchSent" BOOLEAN NOT NULL DEFAULT false,
    "pitchResponse" TEXT,
    "outreachEmail" TEXT,
    "notes" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacklinkProspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacklinkAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "analysisResult" JSONB NOT NULL,
    "linksFound" INTEGER NOT NULL DEFAULT 0,
    "highValueCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacklinkAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTracker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "promptCategory" TEXT NOT NULL,
    "targetModel" TEXT NOT NULL DEFAULT 'claude-3-5-haiku-20241022',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "brandMentioned" BOOLEAN,
    "brandPosition" INTEGER,
    "competitorsMentioned" JSONB,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptResult" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "brandMentioned" BOOLEAN NOT NULL,
    "brandPosition" INTEGER,
    "mentionContext" TEXT,
    "competitorsFound" JSONB NOT NULL,
    "responseQuality" DOUBLE PRECISION NOT NULL,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "algorithm_updates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "updateType" TEXT NOT NULL,
    "announcedAt" TIMESTAMP(3) NOT NULL,
    "rolloutStart" TIMESTAMP(3),
    "rolloutEnd" TIMESTAMP(3),
    "impactLevel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "platform" TEXT,
    "signalsAffected" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedDate" DATE,
    "linearIssueId" TEXT,

    CONSTRAINT "algorithm_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_health_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "avgPosition" DOUBLE PRECISION NOT NULL,
    "totalClicks" INTEGER NOT NULL,
    "totalImpressions" INTEGER NOT NULL,
    "coverageErrors" INTEGER NOT NULL,
    "coverageWarnings" INTEGER NOT NULL,
    "coreWebVitals" JSONB NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertsTriggered" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "site_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentinel_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric" TEXT,
    "previousValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "changePercent" DOUBLE PRECISION,
    "relatedUpdateId" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentinel_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_experiments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "experimentType" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "metricToTrack" TEXT NOT NULL,
    "originalValue" TEXT NOT NULL,
    "variantValue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "winnerVariant" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "baselineScore" DOUBLE PRECISION,
    "variantScore" DOUBLE PRECISION,
    "improvement" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_observations" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "healing_actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedFix" TEXT NOT NULL,
    "fixApplied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "triggerAlertId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "healing_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bo_spaces" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "name" TEXT,
    "parameters" JSONB NOT NULL,
    "acquisition_fn" TEXT NOT NULL DEFAULT 'ei',
    "constraints" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "best_parameters" JSONB,
    "best_target" DOUBLE PRECISION,
    "total_observations" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bo_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bo_observations" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bo_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bo_optimisation_runs" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "external_job_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "init_points" INTEGER NOT NULL DEFAULT 5,
    "n_iterations" INTEGER NOT NULL DEFAULT 25,
    "current_iteration" INTEGER NOT NULL DEFAULT 0,
    "best_parameters" JSONB,
    "best_target" DOUBLE PRECISION,
    "all_results" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bo_optimisation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_models" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "platform" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "model_data" BYTEA,
    "training_points" INTEGER NOT NULL DEFAULT 0,
    "last_trained_at" TIMESTAMP(3),
    "accuracy" JSONB,
    "seasonality" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecast_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasts" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "horizon_days" INTEGER NOT NULL,
    "predictions" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spatiotemporal_models" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "target_metric" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "training_points" INTEGER NOT NULL DEFAULT 0,
    "last_trained_at" TIMESTAMP(3),
    "accuracy" JSONB,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spatiotemporal_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "used_by" TEXT,
    "used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_secrets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "secret_type" TEXT NOT NULL,
    "provider" TEXT,
    "encrypted_value" TEXT NOT NULL,
    "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
    "masked_value" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_rotatable" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_rotated_at" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_access_logs" (
    "id" TEXT NOT NULL,
    "vault_secret_id" TEXT,
    "organization_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'success',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_dna" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "vertical" TEXT NOT NULL DEFAULT 'other',
    "industry" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "primaryColour" TEXT,
    "secondaryColour" TEXT,
    "neutralColour" TEXT,
    "brandVoice" JSONB NOT NULL DEFAULT '{}',
    "persona" JSONB NOT NULL DEFAULT '{}',
    "offerings" JSONB NOT NULL DEFAULT '[]',
    "socialProfiles" JSONB NOT NULL DEFAULT '[]',
    "seoScore" INTEGER,
    "sourceUrl" TEXT NOT NULL,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRefreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_dna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_operating_system" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT '',
    "qualityThreshold" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "systemPromptOverride" TEXT,
    "rules" JSONB NOT NULL DEFAULT '[]',
    "outputStructure" JSONB NOT NULL DEFAULT '{}',
    "decisionLogic" JSONB NOT NULL DEFAULT '{}',
    "changelog" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_operating_system_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "budgetTier" TEXT,
    "intakeStatus" TEXT NOT NULL DEFAULT 'pending',
    "intakeSource" TEXT,
    "intakeCompletedAt" TIMESTAMP(3),
    "icp" JSONB NOT NULL DEFAULT '{}',
    "offers" JSONB NOT NULL DEFAULT '[]',
    "proofPoints" JSONB NOT NULL DEFAULT '[]',
    "competitors" JSONB NOT NULL DEFAULT '[]',
    "toneKeywords" JSONB NOT NULL DEFAULT '[]',
    "antiPatterns" JSONB NOT NULL DEFAULT '[]',
    "vocabularyBank" JSONB NOT NULL DEFAULT '{}',
    "goals" JSONB NOT NULL DEFAULT '[]',
    "channels" JSONB NOT NULL DEFAULT '[]',
    "constraints" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_research_runs" (
    "id" TEXT NOT NULL,
    "runType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "platforms" TEXT[],
    "insightsCount" INTEGER NOT NULL DEFAULT 0,
    "promptsUpdated" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "organizationId" TEXT,

    CONSTRAINT "auto_research_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trend_insights" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "insight" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "dataPoints" INTEGER NOT NULL,
    "validUntil" TIMESTAMP(3),
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trend_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gsc_properties" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "site_url" TEXT NOT NULL,
    "permission_level" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gsc_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ga4_properties" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "measurement_id" TEXT,
    "display_name" TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sync_at" TIMESTAMP(3),
    "sync_status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "ga4_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gsc_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "site_url" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "indexed_pages" INTEGER,
    "error_pages" INTEGER,
    "warning_pages" INTEGER,
    "excluded_pages" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gsc_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_locations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "location_name" TEXT NOT NULL,
    "address" JSONB,
    "phone" TEXT,
    "website" TEXT,
    "categories" JSONB,
    "hours" JSONB,
    "new_review_uri" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gbp_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_citation_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "query_text" TEXT NOT NULL,
    "search_engine" TEXT NOT NULL,
    "query_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brand_mentioned" BOOLEAN NOT NULL DEFAULT false,
    "raw_snippet" TEXT,
    "mention_position" INTEGER,
    "query_variant" INTEGER NOT NULL,
    "error_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_citation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_reviews" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "gbp_review_id" TEXT NOT NULL,
    "reviewer_name" TEXT,
    "reviewer_avatar" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "review_time" TIMESTAMP(3) NOT NULL,
    "reply_text" TEXT,
    "reply_time" TIMESTAMP(3),
    "ai_suggestion" TEXT,
    "ai_suggestion_at" TIMESTAMP(3),
    "response_status" TEXT NOT NULL DEFAULT 'pending',
    "dismiss_reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "display_on_widget" BOOLEAN NOT NULL DEFAULT true,
    "widget_order" INTEGER,
    "sentiment" TEXT,
    "sentiment_score" DOUBLE PRECISION,
    "moderated_by" TEXT,
    "moderated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "predicted_engagement" DOUBLE PRECISION,
    "confidence_score" DOUBLE PRECISION,
    "cross_client_percentile_industry" INTEGER,
    "feature_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "gbp_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "search_views" INTEGER,
    "maps_views" INTEGER,
    "website_clicks" INTEGER,
    "phone_clicks" INTEGER,
    "direction_clicks" INTEGER,
    "total_reviews" INTEGER,
    "average_rating" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gbp_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autopilot_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "posts_per_day_per_platform" INTEGER NOT NULL DEFAULT 1,
    "planning_horizon_days" INTEGER NOT NULL DEFAULT 7,
    "min_score_threshold" INTEGER NOT NULL DEFAULT 65,
    "auto_approve_threshold" INTEGER NOT NULL DEFAULT 80,
    "content_mix" JSONB NOT NULL DEFAULT '{"educational":30,"promotional":20,"engagement":25,"storytelling":25}',
    "enable_ab_testing" BOOLEAN NOT NULL DEFAULT false,
    "enable_trend_content" BOOLEAN NOT NULL DEFAULT true,
    "enable_repurposing" BOOLEAN NOT NULL DEFAULT true,
    "enabled_platforms" TEXT[],
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "last_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autopilot_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autopilot_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "run_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "posts_generated" INTEGER NOT NULL DEFAULT 0,
    "posts_scheduled" INTEGER NOT NULL DEFAULT 0,
    "posts_drafted" INTEGER NOT NULL DEFAULT 0,
    "posts_rejected" INTEGER NOT NULL DEFAULT 0,
    "avg_score" DOUBLE PRECISION,
    "post_ids" TEXT[],
    "campaign_id" TEXT,
    "input_summary" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "predicted_engagement" DOUBLE PRECISION,
    "confidence_score" DOUBLE PRECISION,
    "cross_client_percentile_industry" INTEGER,
    "feature_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "autopilot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonial_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "token" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "title" TEXT NOT NULL DEFAULT 'Share Your Experience',
    "subtitle" TEXT NOT NULL DEFAULT 'We''d love to hear what you think!',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonial_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "request_id" UUID NOT NULL,
    "submitter_name" TEXT NOT NULL,
    "submitter_email" TEXT,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "photo_urls" JSONB NOT NULL DEFAULT '[]',
    "video_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "gbp_post_id" TEXT,
    "posted_to_gmb_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_content" (
    "id" TEXT NOT NULL,
    "founder_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "seo_content_type" "SeoContentType",
    "body" TEXT NOT NULL,
    "layout_data" JSONB,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_assets" (
    "id" TEXT NOT NULL,
    "founder_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_series" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "series_type" TEXT NOT NULL,
    "youtube_playlist_id" TEXT,
    "youtube_channel_id" TEXT,
    "production_config" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "next_episode_num" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_episodes" (
    "id" TEXT NOT NULL,
    "series_id" TEXT NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_ref" TEXT,
    "source_content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error_message" TEXT,
    "script_content" JSONB,
    "capture_assets" JSONB,
    "raw_video_path" TEXT,
    "processed_video_path" TEXT,
    "thumbnail_path" TEXT,
    "humanness_score" DOUBLE PRECISION,
    "geo_tactic_score" DOUBLE PRECISION,
    "slop_scan_passed" BOOLEAN,
    "quality_metadata" JSONB,
    "youtube_video_id" TEXT,
    "youtube_url" TEXT,
    "youtube_embed_url" TEXT,
    "blog_post_url" TEXT,
    "blog_post_id" TEXT,
    "social_posts" JSONB,
    "video_object_schema" JSONB,
    "scripted_at" TIMESTAMP(3),
    "captured_at" TIMESTAMP(3),
    "rendered_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_topic_queue" (
    "id" TEXT NOT NULL,
    "series_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_ref" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "episode_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_topic_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_engagements" (
    "id" TEXT NOT NULL,
    "founder_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "post_id" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagement_rate" DOUBLE PRECISION,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL,
    "founder_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "opens" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "bounces" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_analytics" (
    "id" TEXT NOT NULL,
    "founder_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "metric_type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "period_date" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisory_cases" (
    "id" TEXT NOT NULL,
    "founder_id" TEXT NOT NULL,
    "approval_queue_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisory_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiments" (
    "id" TEXT NOT NULL,
    "founder_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "hypothesis" TEXT,
    "metric_to_track" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_results" (
    "id" TEXT NOT NULL,
    "experiment_id" TEXT NOT NULL,
    "period_date" TIMESTAMP(3) NOT NULL,
    "variant" TEXT NOT NULL,
    "metric_value" DOUBLE PRECISION NOT NULL,
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials_vault" (
    "id" TEXT NOT NULL,
    "founder_id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "encrypted_value" TEXT NOT NULL,
    "masked_value" TEXT NOT NULL,
    "label" TEXT,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credentials_vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexus_databases" (
    "id" TEXT NOT NULL,
    "founder_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nexus_databases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookkeeper_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "founder_id" UUID NOT NULL,
    "business_key" TEXT NOT NULL,
    "xero_tenant_id" TEXT NOT NULL,
    "xero_transaction_id" TEXT NOT NULL,
    "transaction_date" DATE NOT NULL,
    "description" TEXT,
    "amount_cents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "reconciliation_status" TEXT NOT NULL,
    "confidence_score" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "matched_invoice_id" TEXT,
    "matched_bill_id" TEXT,
    "tax_code" TEXT,
    "gst_amount_cents" BIGINT NOT NULL DEFAULT 0,
    "tax_category" TEXT,
    "is_deductible" BOOLEAN NOT NULL DEFAULT false,
    "deduction_category" TEXT,
    "deduction_notes" TEXT,
    "approval_queue_id" UUID,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "raw_xero_data" JSONB,
    "raw_xero_data_encrypted" TEXT,
    "raw_xero_data_iv" TEXT,
    "raw_xero_data_salt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookkeeper_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connected_projects" (
    "id" TEXT NOT NULL,
    "founder_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connected_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "subtotal_cents" INTEGER NOT NULL,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_email" TEXT NOT NULL,
    "client_address" TEXT,
    "client_abn" TEXT,
    "notes" TEXT,
    "due_date" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "stripe_invoice_id" TEXT,
    "stripe_payment_link_id" TEXT,
    "stripe_payment_link_url" TEXT,
    "xero_invoice_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_products" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_channel_listings" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "channel_listing_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "channel_data" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_channel_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_templates" (
    "id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "scenario_name" TEXT NOT NULL,
    "prompt_template" TEXT NOT NULL,
    "example_output" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "industry_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "target_customer" TEXT NOT NULL,
    "differentiator" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "first_post_topic" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "author" TEXT NOT NULL DEFAULT 'Synthex Team',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "og_image" TEXT,
    "og_image_alt" TEXT,
    "word_count" INTEGER,
    "read_time" INTEGER,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_model" TEXT,
    "generation_cost" DOUBLE PRECISION,
    "quality_score" INTEGER,
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_cost_ledger" (
    "id" TEXT NOT NULL,
    "pipeline_name" TEXT NOT NULL,
    "client_id" TEXT,
    "run_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_cost_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_budget_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "daily_ceiling_usd" DOUBLE PRECISION,
    "monthly_ceiling_usd" DOUBLE PRECISION,
    "enforcement_mode" TEXT NOT NULL DEFAULT 'log_only',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_budget_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edge_function_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "function_name" TEXT NOT NULL,
    "run_id" UUID NOT NULL,
    "client_id" UUID,
    "status" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "clients_processed" INTEGER NOT NULL DEFAULT 0,
    "clients_failed" INTEGER NOT NULL DEFAULT 0,
    "error_json" JSONB,
    "output_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edge_function_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authority_scores" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "eeat_breakdown" JSONB NOT NULL,
    "signals_version" TEXT NOT NULL DEFAULT '1.0',
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "predicted_engagement" DOUBLE PRECISION,
    "confidence_score" DOUBLE PRECISION,
    "cross_client_percentile_industry" INTEGER,
    "feature_tags" TEXT[],

    CONSTRAINT "authority_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_calendars" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "slots" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "signals_version" TEXT NOT NULL DEFAULT '1.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_queue" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "last_error" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publish_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasonal_signals" (
    "id" TEXT NOT NULL,
    "industry_slug" TEXT NOT NULL,
    "sub_industry" TEXT,
    "location_state" TEXT NOT NULL,
    "signal_type" TEXT NOT NULL,
    "opportunity_label" TEXT NOT NULL,
    "window_start" DATE NOT NULL,
    "window_end" DATE NOT NULL,
    "confidence_score" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "predicted_engagement" DOUBLE PRECISION,
    "cross_client_percentile_industry" INTEGER,
    "feature_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasonal_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasonal_signal_dismissals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "dismissed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seasonal_signal_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_stories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "month_year" TEXT NOT NULL,
    "story_text" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "total_reach" INTEGER NOT NULL DEFAULT 0,
    "posts_published" INTEGER NOT NULL DEFAULT 0,
    "autonomous_posts" INTEGER NOT NULL DEFAULT 0,
    "minutes_saved" INTEGER NOT NULL DEFAULT 0,
    "top_post_id" TEXT,
    "referral_clicked" BOOLEAN NOT NULL DEFAULT false,
    "dismissed_at" TIMESTAMP(3),
    "email_status" TEXT NOT NULL DEFAULT 'pending',
    "email_retry_at" TIMESTAMP(3),
    "email_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_quality_reviews" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "quality_score" INTEGER NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_quality_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_config" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "auto_approve_future" BOOLEAN NOT NULL DEFAULT false,
    "stories_reviewed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommended_actions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "actions" JSONB NOT NULL,
    "dollar_attribution" TEXT NOT NULL,
    "job_count_attribution" INTEGER NOT NULL DEFAULT 0,
    "competitor_micro_insight" TEXT,
    "geo_teaser_text" TEXT,
    "results_summary" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "attribution_context" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),

    CONSTRAINT "recommended_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_feedback" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisor_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invited_by" TEXT,
    "invitation_id" TEXT,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "last_active_at" TIMESTAMP(3),
    "last_weekly_active_fired_at" TIMESTAMP(3),

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member_page_views" (
    "id" UUID NOT NULL,
    "team_member_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "page_path" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_member_page_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_health_scores" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "overall_score" INTEGER NOT NULL,
    "dimensions" JSONB NOT NULL,
    "score_delta" INTEGER NOT NULL DEFAULT 0,
    "risk_level" TEXT,
    "shadow_dimensions" JSONB,
    "client_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_health_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_score_config" (
    "id" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_score_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_engagement_events" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_data" JSONB,
    "page_path" TEXT,
    "session_id" TEXT NOT NULL,
    "crm_client_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_engagement_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervention_config" (
    "id" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "tier_1_threshold" INTEGER NOT NULL DEFAULT 15,
    "tier_2_threshold" INTEGER NOT NULL DEFAULT 25,
    "tier_3_threshold" INTEGER NOT NULL DEFAULT 35,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "tier_3_active_from" TIMESTAMP(3),
    "tier_2_active_from" TIMESTAMP(3),
    "tier_1_active_from" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intervention_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_interventions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "current_score" INTEGER NOT NULL,
    "baseline_score" INTEGER NOT NULL,
    "decline_magnitude" INTEGER NOT NULL,
    "intervention_tier" INTEGER NOT NULL,
    "intervention_type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "template_id" TEXT,
    "observation_mode" BOOLEAN NOT NULL DEFAULT true,
    "would_have_sent_at" TIMESTAMP(3) NOT NULL,
    "actually_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervention_templates" (
    "id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "dimension" TEXT,
    "channel" TEXT NOT NULL,
    "subject_template" TEXT,
    "body_template" TEXT NOT NULL,
    "hero_metric_source" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intervention_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_outreach_queue" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "flagged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "health_score_trend" JSONB NOT NULL,
    "talking_points" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_note" TEXT,

    CONSTRAINT "founder_outreach_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_performance_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "confidence_level" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "top_topics" JSONB NOT NULL DEFAULT '[]',
    "optimal_times" JSONB NOT NULL DEFAULT '{}',
    "winning_hashtags" JSONB NOT NULL DEFAULT '[]',
    "content_format_scores" JSONB NOT NULL DEFAULT '{}',
    "industry_baseline_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_performance_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_baselines" (
    "id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "top_topics" JSONB NOT NULL DEFAULT '[]',
    "optimal_times" JSONB NOT NULL DEFAULT '{}',
    "winning_hashtags" JSONB NOT NULL DEFAULT '[]',
    "content_format_scores" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "industry_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_improvement_tracking" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "informed_avg_engagement" DOUBLE PRECISION,
    "baseline_avg_engagement" DOUBLE PRECISION,
    "improvement_rate" DOUBLE PRECISION,
    "intelligence_signals_used" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_improvement_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'enquiry',
    "contact_method" "LeadContactMethod" NOT NULL,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "captured_from" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "revenue_estimate_aud" DECIMAL(12,2),
    "verified_revenue_aud" DECIMAL(12,2),
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" TEXT,
    "attribution_window_days" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "client_id" TEXT,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_map_scans" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "input_evidence" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "fit_score" INTEGER NOT NULL,
    "fit_state" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "lead_id" TEXT,
    "consent_policy_version" TEXT,
    "consented_at" TIMESTAMP(3),
    "handoff_at" TIMESTAMP(3),
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "feedback_useful" BOOLEAN,
    "feedback_missing" TEXT,
    "feedback_submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_map_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template_id" TEXT,
    "report_type" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "date_range_type" TEXT NOT NULL DEFAULT 'last_period',
    "filters" JSONB,
    "metrics" TEXT[],
    "recipients" TEXT[],
    "webhook_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "last_run_status" TEXT,
    "last_report_id" TEXT,
    "next_run_at" TIMESTAMP(3),
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_templates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "metrics" TEXT[],
    "dimensions" TEXT[],
    "filters" JSONB,
    "visualizations" JSONB,
    "layout" JSONB,
    "branding" JSONB,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_deliveries" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "scheduled_report_id" TEXT,
    "delivery_type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_snapshots" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "followers_count" INTEGER,
    "following_count" INTEGER,
    "follower_growth" INTEGER,
    "total_posts" INTEGER,
    "avg_likes" DOUBLE PRECISION,
    "avg_comments" DOUBLE PRECISION,
    "avg_shares" DOUBLE PRECISION,
    "engagement_rate" DOUBLE PRECISION,
    "post_frequency" DOUBLE PRECISION,
    "top_hashtags" TEXT[],
    "content_types" JSONB,
    "posting_times" JSONB,
    "performance_score" DOUBLE PRECISION,
    "growth_score" DOUBLE PRECISION,
    "engagement_score" DOUBLE PRECISION,
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_source" TEXT NOT NULL DEFAULT 'api',

    CONSTRAINT "competitor_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_posts" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "external_id" TEXT,
    "post_url" TEXT,
    "content" TEXT,
    "media_urls" TEXT[],
    "media_type" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER,
    "saves" INTEGER,
    "engagement_rate" DOUBLE PRECISION,
    "sentiment" TEXT,
    "hashtags" TEXT[],
    "mentions" TEXT[],
    "topics" TEXT[],
    "is_top_performing" BOOLEAN NOT NULL DEFAULT false,
    "performance_percentile" DOUBLE PRECISION,
    "posted_at" TIMESTAMP(3),
    "tracked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "related_post_id" TEXT,
    "metrics" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "action_taken" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "competitor_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hermes_config" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "brand_slug" TEXT NOT NULL,
    "daily_quota" INTEGER NOT NULL DEFAULT 5,
    "voice_floor" INTEGER NOT NULL DEFAULT 70,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hermes_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hermes_discovery_signal" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "signal_type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'routine',
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hermes_discovery_signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hermes_gap_candidate" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "signal_ids" TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hermes_gap_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hermes_proposal" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gap_candidate_id" TEXT,
    "post_id" TEXT,
    "content" TEXT NOT NULL,
    "voice_score" INTEGER,
    "voice_gate_decision" TEXT,
    "voice_failed_rules" TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hermes_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aeo_gate_runs" (
    "id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "pass" BOOLEAN NOT NULL,
    "reasons" TEXT[],
    "evidence_urls" TEXT[],
    "candidate_hash" TEXT NOT NULL,
    "candidate_length" INTEGER NOT NULL,
    "source_of_truth_job_id" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "rule_set_version" TEXT NOT NULL DEFAULT '2026-05-16',
    "brand_config_sha" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aeo_gate_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nap_citation" (
    "id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "directory" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "source_url" TEXT NOT NULL,
    "is_canonical" BOOLEAN NOT NULL DEFAULT false,
    "last_verified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "nap_citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mention_freshness" (
    "id" UUID NOT NULL,
    "mention_id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "snippet" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mention_freshness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_content_drafts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_slug" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_approval',
    "video_provider" TEXT NOT NULL DEFAULT 'heygen',
    "video_id" TEXT,
    "video_url" TEXT,
    "platforms" JSONB NOT NULL DEFAULT '[]',
    "dedupe_key" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "studio_content_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discount_type" TEXT NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "usage_cap" INTEGER NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creators" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "platform" TEXT,
    "email" TEXT,
    "follower_count" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'prospect',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ugc_submissions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "creator_id" TEXT,
    "asset_url" TEXT,
    "caption" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ugc_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_evidence_scores" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "source_ref_id" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "scorer" TEXT NOT NULL,
    "rationale" TEXT,
    "scored_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_evidence_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_api_keys" (
    "id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_gate_verdicts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'blocked',
    "blocked_reasons" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_gate_verdicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_presets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primary_color" TEXT NOT NULL,
    "secondary_color" TEXT,
    "accent_color" TEXT,
    "font" TEXT NOT NULL,
    "logo_url" TEXT,
    "cta_text" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "users_onboarding_complete_idx" ON "users"("onboarding_complete");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "campaigns_user_id_idx" ON "campaigns"("user_id");

-- CreateIndex
CREATE INDEX "campaigns_organization_id_idx" ON "campaigns"("organization_id");

-- CreateIndex
CREATE INDEX "campaigns_deleted_at_idx" ON "campaigns"("deleted_at");

-- CreateIndex
CREATE INDEX "posts_campaign_id_created_at_idx" ON "posts"("campaign_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "posts_platform_status_idx" ON "posts"("platform", "status");

-- CreateIndex
CREATE INDEX "posts_scheduled_at_idx" ON "posts"("scheduled_at");

-- CreateIndex
CREATE INDEX "posts_deleted_at_idx" ON "posts"("deleted_at");

-- CreateIndex
CREATE INDEX "posts_source_status_idx" ON "posts"("source", "status");

-- CreateIndex
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE INDEX "projects_type_idx" ON "projects"("type");

-- CreateIndex
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");

-- CreateIndex
CREATE INDEX "api_usage_user_id_idx" ON "api_usage"("user_id");

-- CreateIndex
CREATE INDEX "api_usage_user_id_created_at_idx" ON "api_usage"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_pkce_states_state_key" ON "oauth_pkce_states"("state");

-- CreateIndex
CREATE INDEX "oauth_pkce_states_expires_at_idx" ON "oauth_pkce_states"("expires_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_created_at_idx" ON "notifications"("user_id", "read", "created_at");

-- CreateIndex
CREATE INDEX "webhook_endpoints_user_id_idx" ON "webhook_endpoints"("user_id");

-- CreateIndex
CREATE INDEX "webhook_endpoints_user_id_active_idx" ON "webhook_endpoints"("user_id", "active");

-- CreateIndex
CREATE INDEX "model_metrics_provider_week_start_idx" ON "model_metrics"("provider", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "model_metrics_model_id_content_type_week_start_key" ON "model_metrics"("model_id", "content_type", "week_start");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_category_idx" ON "audit_logs"("category");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_domain_key" ON "organizations"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_custom_domain_key" ON "organizations"("custom_domain");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "organizations_plan_idx" ON "organizations"("plan");

-- CreateIndex
CREATE INDEX "organizations_parent_org_id_idx" ON "organizations"("parent_org_id");

-- CreateIndex
CREATE INDEX "review_requests_organization_id_idx" ON "review_requests"("organization_id");

-- CreateIndex
CREATE INDEX "review_requests_organization_id_status_idx" ON "review_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "content_topic_suggestions_organization_id_idx" ON "content_topic_suggestions"("organization_id");

-- CreateIndex
CREATE INDEX "content_topic_suggestions_organization_id_used_at_idx" ON "content_topic_suggestions"("organization_id", "used_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_topic_suggestions_organization_id_keyword_key" ON "content_topic_suggestions"("organization_id", "keyword");

-- CreateIndex
CREATE INDEX "keyword_targets_organization_id_idx" ON "keyword_targets"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_targets_organization_id_keyword_key" ON "keyword_targets"("organization_id", "keyword");

-- CreateIndex
CREATE INDEX "keyword_rank_snapshots_organization_id_snapshot_date_idx" ON "keyword_rank_snapshots"("organization_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "keyword_rank_snapshots_keyword_target_id_idx" ON "keyword_rank_snapshots"("keyword_target_id");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_rank_snapshots_keyword_target_id_snapshot_date_key" ON "keyword_rank_snapshots"("keyword_target_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "follower_snapshots_organization_id_platform_captured_at_idx" ON "follower_snapshots"("organization_id", "platform", "captured_at");

-- CreateIndex
CREATE INDEX "follower_snapshots_user_id_captured_at_idx" ON "follower_snapshots"("user_id", "captured_at");

-- CreateIndex
CREATE INDEX "follower_snapshots_connection_id_captured_at_idx" ON "follower_snapshots"("connection_id", "captured_at");

-- CreateIndex
CREATE INDEX "visibility_scores_organization_id_calculated_at_idx" ON "visibility_scores"("organization_id", "calculated_at");

-- CreateIndex
CREATE INDEX "platform_connections_organization_id_platform_idx" ON "platform_connections"("organization_id", "platform");

-- CreateIndex
CREATE INDEX "platform_connections_deleted_at_idx" ON "platform_connections"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_connections_user_id_platform_organization_id_key" ON "platform_connections"("user_id", "platform", "organization_id");

-- CreateIndex
CREATE INDEX "platform_posts_deleted_at_idx" ON "platform_posts"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_posts_connection_id_platform_id_key" ON "platform_posts"("connection_id", "platform_id");

-- CreateIndex
CREATE INDEX "platform_metrics_post_id_recorded_at_idx" ON "platform_metrics"("post_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "platform_metrics_recorded_at_idx" ON "platform_metrics"("recorded_at");

-- CreateIndex
CREATE INDEX "team_invitations_email_idx" ON "team_invitations"("email");

-- CreateIndex
CREATE INDEX "team_invitations_organization_id_status_idx" ON "team_invitations"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "psychology_principles_name_key" ON "psychology_principles"("name");

-- CreateIndex
CREATE INDEX "psychology_principles_category_idx" ON "psychology_principles"("category");

-- CreateIndex
CREATE INDEX "psychology_principles_effectiveness_score_idx" ON "psychology_principles"("effectiveness_score" DESC);

-- CreateIndex
CREATE INDEX "brand_generations_user_id_idx" ON "brand_generations"("user_id");

-- CreateIndex
CREATE INDEX "brand_generations_status_idx" ON "brand_generations"("status");

-- CreateIndex
CREATE INDEX "psychology_metrics_generation_id_idx" ON "psychology_metrics"("generation_id");

-- CreateIndex
CREATE INDEX "psychology_metrics_principle_used_idx" ON "psychology_metrics"("principle_used");

-- CreateIndex
CREATE UNIQUE INDEX "user_psychology_preferences_user_id_key" ON "user_psychology_preferences"("user_id");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_idx" ON "analytics_events"("user_id");

-- CreateIndex
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events"("session_id");

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_timestamp_idx" ON "analytics_events"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "reports_user_id_idx" ON "reports"("user_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "reports"("type");

-- CreateIndex
CREATE INDEX "sentiment_analyses_user_id_idx" ON "sentiment_analyses"("user_id");

-- CreateIndex
CREATE INDEX "sentiment_analyses_content_type_content_id_idx" ON "sentiment_analyses"("content_type", "content_id");

-- CreateIndex
CREATE INDEX "sentiment_analyses_sentiment_idx" ON "sentiment_analyses"("sentiment");

-- CreateIndex
CREATE INDEX "sentiment_analyses_analyzed_at_idx" ON "sentiment_analyses"("analyzed_at");

-- CreateIndex
CREATE INDEX "quotes_category_idx" ON "quotes"("category");

-- CreateIndex
CREATE INDEX "quotes_user_id_idx" ON "quotes"("user_id");

-- CreateIndex
CREATE INDEX "quotes_tags_idx" ON "quotes"("tags");

-- CreateIndex
CREATE INDEX "quotes_ai_generated_idx" ON "quotes"("ai_generated");

-- CreateIndex
CREATE INDEX "content_library_user_id_idx" ON "content_library"("user_id");

-- CreateIndex
CREATE INDEX "content_library_user_id_content_type_idx" ON "content_library"("user_id", "content_type");

-- CreateIndex
CREATE INDEX "content_library_user_id_status_idx" ON "content_library"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "content_drafts_scheduled_post_id_key" ON "content_drafts"("scheduled_post_id");

-- CreateIndex
CREATE INDEX "content_drafts_user_id_status_idx" ON "content_drafts"("user_id", "status");

-- CreateIndex
CREATE INDEX "content_drafts_user_id_platform_idx" ON "content_drafts"("user_id", "platform");

-- CreateIndex
CREATE INDEX "content_drafts_created_at_idx" ON "content_drafts"("created_at");

-- CreateIndex
CREATE INDEX "prompt_templates_user_id_idx" ON "prompt_templates"("user_id");

-- CreateIndex
CREATE INDEX "prompt_templates_organization_id_idx" ON "prompt_templates"("organization_id");

-- CreateIndex
CREATE INDEX "prompt_templates_category_idx" ON "prompt_templates"("category");

-- CreateIndex
CREATE INDEX "prompt_templates_is_public_idx" ON "prompt_templates"("is_public");

-- CreateIndex
CREATE INDEX "prompt_templates_is_system_idx" ON "prompt_templates"("is_system");

-- CreateIndex
CREATE INDEX "tasks_user_id_idx" ON "tasks"("user_id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_idx" ON "tasks"("organization_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- CreateIndex
CREATE INDEX "tasks_user_id_status_due_date_idx" ON "tasks"("user_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_priority_idx" ON "tasks"("assignee_id", "priority");

-- CreateIndex
CREATE INDEX "tasks_organization_id_agency_task_id_idx" ON "tasks"("organization_id", "agency_task_id");

-- CreateIndex
CREATE INDEX "personas_user_id_idx" ON "personas"("user_id");

-- CreateIndex
CREATE INDEX "personas_status_idx" ON "personas"("status");

-- CreateIndex
CREATE INDEX "persona_training_data_persona_id_idx" ON "persona_training_data"("persona_id");

-- CreateIndex
CREATE INDEX "persona_training_data_source_type_idx" ON "persona_training_data"("source_type");

-- CreateIndex
CREATE UNIQUE INDEX "persona_training_data_persona_id_content_hash_key" ON "persona_training_data"("persona_id", "content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_customer_id_key" ON "subscriptions"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "dunning_states_subscription_id_key" ON "dunning_states"("subscription_id");

-- CreateIndex
CREATE INDEX "dunning_states_state_idx" ON "dunning_states"("state");

-- CreateIndex
CREATE INDEX "revenue_entries_user_id_idx" ON "revenue_entries"("user_id");

-- CreateIndex
CREATE INDEX "revenue_entries_user_id_source_idx" ON "revenue_entries"("user_id", "source");

-- CreateIndex
CREATE INDEX "revenue_entries_user_id_paid_at_idx" ON "revenue_entries"("user_id", "paid_at");

-- CreateIndex
CREATE INDEX "content_investments_user_id_idx" ON "content_investments"("user_id");

-- CreateIndex
CREATE INDEX "content_investments_user_id_type_idx" ON "content_investments"("user_id", "type");

-- CreateIndex
CREATE INDEX "content_investments_user_id_invested_at_idx" ON "content_investments"("user_id", "invested_at");

-- CreateIndex
CREATE INDEX "sponsors_user_id_idx" ON "sponsors"("user_id");

-- CreateIndex
CREATE INDEX "sponsors_user_id_status_idx" ON "sponsors"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sponsor_deals_revenue_entry_id_key" ON "sponsor_deals"("revenue_entry_id");

-- CreateIndex
CREATE INDEX "sponsor_deals_sponsor_id_idx" ON "sponsor_deals"("sponsor_id");

-- CreateIndex
CREATE INDEX "sponsor_deals_sponsor_id_stage_idx" ON "sponsor_deals"("sponsor_id", "stage");

-- CreateIndex
CREATE INDEX "deal_deliverables_deal_id_idx" ON "deal_deliverables"("deal_id");

-- CreateIndex
CREATE INDEX "deal_deliverables_deal_id_status_idx" ON "deal_deliverables"("deal_id", "status");

-- CreateIndex
CREATE INDEX "deal_deliverables_client_id_idx" ON "deal_deliverables"("client_id");

-- CreateIndex
CREATE INDEX "roles_organization_id_idx" ON "roles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_name_key" ON "roles"("organization_id", "name");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "permission_audits_organization_id_idx" ON "permission_audits"("organization_id");

-- CreateIndex
CREATE INDEX "permission_audits_performed_by_idx" ON "permission_audits"("performed_by");

-- CreateIndex
CREATE INDEX "permission_audits_created_at_idx" ON "permission_audits"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_shares_access_link_key" ON "content_shares"("access_link");

-- CreateIndex
CREATE INDEX "content_shares_content_type_content_id_idx" ON "content_shares"("content_type", "content_id");

-- CreateIndex
CREATE INDEX "content_shares_shared_with_user_id_idx" ON "content_shares"("shared_with_user_id");

-- CreateIndex
CREATE INDEX "content_shares_shared_with_team_id_idx" ON "content_shares"("shared_with_team_id");

-- CreateIndex
CREATE INDEX "content_shares_shared_by_id_idx" ON "content_shares"("shared_by_id");

-- CreateIndex
CREATE INDEX "content_shares_access_link_idx" ON "content_shares"("access_link");

-- CreateIndex
CREATE INDEX "content_comments_content_type_content_id_idx" ON "content_comments"("content_type", "content_id");

-- CreateIndex
CREATE INDEX "content_comments_author_id_idx" ON "content_comments"("author_id");

-- CreateIndex
CREATE INDEX "content_comments_parent_id_idx" ON "content_comments"("parent_id");

-- CreateIndex
CREATE INDEX "team_notifications_user_id_read_idx" ON "team_notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "team_notifications_organization_id_idx" ON "team_notifications"("organization_id");

-- CreateIndex
CREATE INDEX "team_notifications_created_at_idx" ON "team_notifications"("created_at");

-- CreateIndex
CREATE INDEX "approval_requests_submitted_by_idx" ON "approval_requests"("submitted_by");

-- CreateIndex
CREATE INDEX "approval_requests_organization_id_idx" ON "approval_requests"("organization_id");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_requests_content_id_idx" ON "approval_requests"("content_id");

-- CreateIndex
CREATE INDEX "approval_comments_approval_request_id_created_at_idx" ON "approval_comments"("approval_request_id", "created_at");

-- CreateIndex
CREATE INDEX "approval_comments_author_id_idx" ON "approval_comments"("author_id");

-- CreateIndex
CREATE INDEX "intentscape_workspaces_organization_id_state_updated_at_idx" ON "intentscape_workspaces"("organization_id", "state", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "intentscape_workspaces_created_by_id_idx" ON "intentscape_workspaces"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "intentscape_workspaces_id_org_key" ON "intentscape_workspaces"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "intentscape_artifacts_storage_path_key" ON "intentscape_artifacts"("storage_path");

-- CreateIndex
CREATE INDEX "intentscape_artifacts_organization_id_workspace_id_kind_cre_idx" ON "intentscape_artifacts"("organization_id", "workspace_id", "kind", "created_at" DESC);

-- CreateIndex
CREATE INDEX "intentscape_artifacts_organization_id_content_hash_idx" ON "intentscape_artifacts"("organization_id", "content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "intentscape_artifacts_org_workspace_path_version_key" ON "intentscape_artifacts"("organization_id", "workspace_id", "logical_path", "version");

-- CreateIndex
CREATE INDEX "intentscape_vision_runs_organization_id_workspace_id_status_idx" ON "intentscape_vision_runs"("organization_id", "workspace_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "intentscape_vision_runs_id_org_key" ON "intentscape_vision_runs"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "intentscape_vision_runs_org_workspace_context_attempt_key" ON "intentscape_vision_runs"("organization_id", "workspace_id", "context_version", "attempt");

-- CreateIndex
CREATE INDEX "intentscape_hypotheses_organization_id_workspace_id_vision__idx" ON "intentscape_hypotheses"("organization_id", "workspace_id", "vision_run_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "intentscape_hypotheses_org_workspace_run_hypothesis_version_key" ON "intentscape_hypotheses"("organization_id", "workspace_id", "vision_run_id", "hypothesis_id", "version");

-- CreateIndex
CREATE INDEX "intentscape_goal_contracts_organization_id_workspace_id_sta_idx" ON "intentscape_goal_contracts"("organization_id", "workspace_id", "status", "approved_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "intentscape_goal_contracts_org_workspace_version_key" ON "intentscape_goal_contracts"("organization_id", "workspace_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "intentscape_goal_contracts_context_hypothesis_version_key" ON "intentscape_goal_contracts"("organization_id", "workspace_id", "context_version", "hypothesis_id", "hypothesis_version");

-- CreateIndex
CREATE INDEX "intentscape_events_organization_id_workspace_id_created_at_idx" ON "intentscape_events"("organization_id", "workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "intentscape_events_organization_id_entity_type_entity_id_idx" ON "intentscape_events"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "command_packets_organization_id_status_idx" ON "command_packets"("organization_id", "status");

-- CreateIndex
CREATE INDEX "command_packets_created_by_id_idx" ON "command_packets"("created_by_id");

-- CreateIndex
CREATE INDEX "workflow_templates_organization_id_idx" ON "workflow_templates"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_templates_is_default_idx" ON "workflow_templates"("is_default");

-- CreateIndex
CREATE INDEX "workflow_templates_is_active_idx" ON "workflow_templates"("is_active");

-- CreateIndex
CREATE INDEX "calendar_posts_organization_id_scheduled_for_idx" ON "calendar_posts"("organization_id", "scheduled_for" DESC);

-- CreateIndex
CREATE INDEX "calendar_posts_user_id_status_idx" ON "calendar_posts"("user_id", "status");

-- CreateIndex
CREATE INDEX "calendar_posts_status_scheduled_for_idx" ON "calendar_posts"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "calendar_posts_campaign_id_idx" ON "calendar_posts"("campaign_id");

-- CreateIndex
CREATE INDEX "calendar_posts_parent_post_id_idx" ON "calendar_posts"("parent_post_id");

-- CreateIndex
CREATE INDEX "ab_tests_user_id_idx" ON "ab_tests"("user_id");

-- CreateIndex
CREATE INDEX "ab_tests_organization_id_idx" ON "ab_tests"("organization_id");

-- CreateIndex
CREATE INDEX "ab_tests_status_idx" ON "ab_tests"("status");

-- CreateIndex
CREATE INDEX "ab_test_variants_test_id_idx" ON "ab_test_variants"("test_id");

-- CreateIndex
CREATE INDEX "ab_test_results_test_id_idx" ON "ab_test_results"("test_id");

-- CreateIndex
CREATE INDEX "ab_test_results_variant_id_idx" ON "ab_test_results"("variant_id");

-- CreateIndex
CREATE INDEX "ab_test_results_timestamp_idx" ON "ab_test_results"("timestamp");

-- CreateIndex
CREATE INDEX "tracked_competitors_user_id_idx" ON "tracked_competitors"("user_id");

-- CreateIndex
CREATE INDEX "tracked_competitors_is_active_idx" ON "tracked_competitors"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_competitors_user_id_domain_key" ON "tracked_competitors"("user_id", "domain");

-- CreateIndex
CREATE INDEX "competitor_keyword_gaps_organization_id_snapshot_date_idx" ON "competitor_keyword_gaps"("organization_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "competitor_keyword_gaps_competitor_id_idx" ON "competitor_keyword_gaps"("competitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_keyword_gaps_competitor_id_keyword_snapshot_date_key" ON "competitor_keyword_gaps"("competitor_id", "keyword", "snapshot_date");

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_updated_at_idx" ON "ai_conversations"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "ai_conversations_status_idx" ON "ai_conversations"("status");

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_messages_role_idx" ON "ai_messages"("role");

-- CreateIndex
CREATE INDEX "ai_weekly_digests_user_id_created_at_idx" ON "ai_weekly_digests"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_weekly_digests_user_id_week_start_key" ON "ai_weekly_digests"("user_id", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "user_health_scores_user_id_key" ON "user_health_scores"("user_id");

-- CreateIndex
CREATE INDEX "user_health_scores_score_idx" ON "user_health_scores"("score");

-- CreateIndex
CREATE INDEX "user_health_scores_risk_level_idx" ON "user_health_scores"("risk_level");

-- CreateIndex
CREATE UNIQUE INDEX "user_streaks_user_id_key" ON "user_streaks"("user_id");

-- CreateIndex
CREATE INDEX "user_achievements_user_id_category_idx" ON "user_achievements"("user_id", "category");

-- CreateIndex
CREATE INDEX "user_achievements_unlocked_at_idx" ON "user_achievements"("unlocked_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_user_id_achievement_id_key" ON "user_achievements"("user_id", "achievement_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referee_id_key" ON "referrals"("referee_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");

-- CreateIndex
CREATE INDEX "referrals_referrer_id_idx" ON "referrals"("referrer_id");

-- CreateIndex
CREATE INDEX "referrals_referee_email_idx" ON "referrals"("referee_email");

-- CreateIndex
CREATE INDEX "referrals_status_idx" ON "referrals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_loyalty_tiers_user_id_key" ON "user_loyalty_tiers"("user_id");

-- CreateIndex
CREATE INDEX "user_loyalty_tiers_tier_idx" ON "user_loyalty_tiers"("tier");

-- CreateIndex
CREATE INDEX "feedback_surveys_user_id_idx" ON "feedback_surveys"("user_id");

-- CreateIndex
CREATE INDEX "feedback_surveys_type_idx" ON "feedback_surveys"("type");

-- CreateIndex
CREATE INDEX "feedback_surveys_score_idx" ON "feedback_surveys"("score");

-- CreateIndex
CREATE INDEX "feedback_surveys_created_at_idx" ON "feedback_surveys"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "author_profiles_slug_key" ON "author_profiles"("slug");

-- CreateIndex
CREATE INDEX "author_profiles_user_id_idx" ON "author_profiles"("user_id");

-- CreateIndex
CREATE INDEX "seo_audits_user_id_idx" ON "seo_audits"("user_id");

-- CreateIndex
CREATE INDEX "seo_audits_user_id_created_at_idx" ON "seo_audits"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "seo_audits_audit_type_idx" ON "seo_audits"("audit_type");

-- CreateIndex
CREATE INDEX "scheduled_audit_targets_user_id_idx" ON "scheduled_audit_targets"("user_id");

-- CreateIndex
CREATE INDEX "scheduled_audit_targets_enabled_frequency_idx" ON "scheduled_audit_targets"("enabled", "frequency");

-- CreateIndex
CREATE INDEX "geo_analyses_user_id_idx" ON "geo_analyses"("user_id");

-- CreateIndex
CREATE INDEX "geo_analyses_platform_idx" ON "geo_analyses"("platform");

-- CreateIndex
CREATE INDEX "geo_analyses_overall_score_idx" ON "geo_analyses"("overall_score");

-- CreateIndex
CREATE UNIQUE INDEX "entity_analyses_geo_analysis_id_key" ON "entity_analyses"("geo_analysis_id");

-- CreateIndex
CREATE INDEX "entity_analyses_user_id_idx" ON "entity_analyses"("user_id");

-- CreateIndex
CREATE INDEX "entity_analyses_coherence_score_idx" ON "entity_analyses"("coherence_score");

-- CreateIndex
CREATE UNIQUE INDEX "geo_research_reports_slug_key" ON "geo_research_reports"("slug");

-- CreateIndex
CREATE INDEX "geo_research_reports_user_id_idx" ON "geo_research_reports"("user_id");

-- CreateIndex
CREATE INDEX "geo_research_reports_organization_id_idx" ON "geo_research_reports"("organization_id");

-- CreateIndex
CREATE INDEX "geo_research_reports_status_idx" ON "geo_research_reports"("status");

-- CreateIndex
CREATE INDEX "visual_assets_user_id_idx" ON "visual_assets"("user_id");

-- CreateIndex
CREATE INDEX "visual_assets_report_id_idx" ON "visual_assets"("report_id");

-- CreateIndex
CREATE INDEX "visual_assets_type_idx" ON "visual_assets"("type");

-- CreateIndex
CREATE UNIQUE INDEX "local_case_studies_slug_key" ON "local_case_studies"("slug");

-- CreateIndex
CREATE INDEX "local_case_studies_user_id_idx" ON "local_case_studies"("user_id");

-- CreateIndex
CREATE INDEX "local_case_studies_city_state_idx" ON "local_case_studies"("city", "state");

-- CreateIndex
CREATE INDEX "article_authors_post_id_idx" ON "article_authors"("post_id");

-- CreateIndex
CREATE INDEX "article_authors_author_id_idx" ON "article_authors"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_authors_post_id_author_id_key" ON "article_authors"("post_id", "author_id");

-- CreateIndex
CREATE INDEX "business_ownerships_owner_id_idx" ON "business_ownerships"("owner_id");

-- CreateIndex
CREATE INDEX "business_ownerships_organization_id_idx" ON "business_ownerships"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_ownerships_owner_id_organization_id_key" ON "business_ownerships"("owner_id", "organization_id");

-- CreateIndex
CREATE INDEX "tracked_keywords_user_id_idx" ON "tracked_keywords"("user_id");

-- CreateIndex
CREATE INDEX "tracked_keywords_organization_id_idx" ON "tracked_keywords"("organization_id");

-- CreateIndex
CREATE INDEX "tracked_keywords_keyword_idx" ON "tracked_keywords"("keyword");

-- CreateIndex
CREATE INDEX "tracked_keywords_is_active_idx" ON "tracked_keywords"("is_active");

-- CreateIndex
CREATE INDEX "social_mentions_keyword_id_idx" ON "social_mentions"("keyword_id");

-- CreateIndex
CREATE INDEX "social_mentions_user_id_idx" ON "social_mentions"("user_id");

-- CreateIndex
CREATE INDEX "social_mentions_platform_idx" ON "social_mentions"("platform");

-- CreateIndex
CREATE INDEX "social_mentions_sentiment_idx" ON "social_mentions"("sentiment");

-- CreateIndex
CREATE INDEX "social_mentions_posted_at_idx" ON "social_mentions"("posted_at");

-- CreateIndex
CREATE INDEX "social_mentions_is_read_idx" ON "social_mentions"("is_read");

-- CreateIndex
CREATE UNIQUE INDEX "social_mentions_platform_platform_post_id_key" ON "social_mentions"("platform", "platform_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "link_bio_pages_slug_key" ON "link_bio_pages"("slug");

-- CreateIndex
CREATE INDEX "link_bio_pages_user_id_idx" ON "link_bio_pages"("user_id");

-- CreateIndex
CREATE INDEX "link_bio_pages_slug_idx" ON "link_bio_pages"("slug");

-- CreateIndex
CREATE INDEX "link_bio_links_page_id_idx" ON "link_bio_links"("page_id");

-- CreateIndex
CREATE INDEX "link_bio_links_page_id_order_idx" ON "link_bio_links"("page_id", "order");

-- CreateIndex
CREATE INDEX "affiliate_networks_user_id_idx" ON "affiliate_networks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_networks_user_id_slug_key" ON "affiliate_networks"("user_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_links_short_code_key" ON "affiliate_links"("short_code");

-- CreateIndex
CREATE INDEX "affiliate_links_user_id_idx" ON "affiliate_links"("user_id");

-- CreateIndex
CREATE INDEX "affiliate_links_network_id_idx" ON "affiliate_links"("network_id");

-- CreateIndex
CREATE INDEX "affiliate_links_short_code_idx" ON "affiliate_links"("short_code");

-- CreateIndex
CREATE INDEX "affiliate_links_auto_insert_idx" ON "affiliate_links"("auto_insert");

-- CreateIndex
CREATE INDEX "affiliate_link_clicks_link_id_idx" ON "affiliate_link_clicks"("link_id");

-- CreateIndex
CREATE INDEX "affiliate_link_clicks_link_id_created_at_idx" ON "affiliate_link_clicks"("link_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_link_clicks_created_at_idx" ON "affiliate_link_clicks"("created_at");

-- CreateIndex
CREATE INDEX "business_vetting_results_user_id_idx" ON "business_vetting_results"("user_id");

-- CreateIndex
CREATE INDEX "business_vetting_results_status_idx" ON "business_vetting_results"("status");

-- CreateIndex
CREATE UNIQUE INDEX "business_vetting_results_user_id_organization_id_key" ON "business_vetting_results"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "api_credentials_user_id_idx" ON "api_credentials"("user_id");

-- CreateIndex
CREATE INDEX "api_credentials_provider_idx" ON "api_credentials"("provider");

-- CreateIndex
CREATE INDEX "api_credentials_is_active_idx" ON "api_credentials"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "api_credentials_user_id_provider_organization_id_key" ON "api_credentials"("user_id", "provider", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_oauth_credentials_platform_key" ON "platform_oauth_credentials"("platform");

-- CreateIndex
CREATE INDEX "platform_oauth_credentials_platform_idx" ON "platform_oauth_credentials"("platform");

-- CreateIndex
CREATE INDEX "platform_oauth_credentials_is_active_idx" ON "platform_oauth_credentials"("is_active");

-- CreateIndex
CREATE INDEX "onboarding_progress_user_id_idx" ON "onboarding_progress"("user_id");

-- CreateIndex
CREATE INDEX "onboarding_progress_currentStage_idx" ON "onboarding_progress"("currentStage");

-- CreateIndex
CREATE INDEX "onboarding_progress_status_idx" ON "onboarding_progress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_user_id_organization_id_key" ON "onboarding_progress"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "video_generations_user_id_status_idx" ON "video_generations"("user_id", "status");

-- CreateIndex
CREATE INDEX "video_generations_organization_id_idx" ON "video_generations"("organization_id");

-- CreateIndex
CREATE INDEX "video_generations_created_at_idx" ON "video_generations"("created_at" DESC);

-- CreateIndex
CREATE INDEX "video_generations_provider_job_id_idx" ON "video_generations"("provider_job_id");

-- CreateIndex
CREATE INDEX "video_generations_batch_group_id_idx" ON "video_generations"("batch_group_id");

-- CreateIndex
CREATE INDEX "image_generations_organization_id_created_at_idx" ON "image_generations"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "image_generations_batch_group_id_idx" ON "image_generations"("batch_group_id");

-- CreateIndex
CREATE INDEX "image_generations_user_id_idx" ON "image_generations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_provider_attempts_attempt_key_key" ON "media_provider_attempts"("attempt_key");

-- CreateIndex
CREATE INDEX "media_provider_attempts_hold_id_idx" ON "media_provider_attempts"("hold_id");

-- CreateIndex
CREATE INDEX "media_provider_attempts_organization_id_window_at_idx" ON "media_provider_attempts"("organization_id", "window_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_spend_events_event_key_key" ON "media_spend_events"("event_key");

-- CreateIndex
CREATE INDEX "media_spend_events_organization_id_window_at_idx" ON "media_spend_events"("organization_id", "window_at");

-- CreateIndex
CREATE INDEX "media_spend_events_hold_id_idx" ON "media_spend_events"("hold_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_video_quotas_organization_id_key" ON "organization_video_quotas"("organization_id");

-- CreateIndex
CREATE INDEX "marketing_agency_campaigns_organization_id_status_idx" ON "marketing_agency_campaigns"("organization_id", "status");

-- CreateIndex
CREATE INDEX "marketing_agency_campaigns_created_by_id_idx" ON "marketing_agency_campaigns"("created_by_id");

-- CreateIndex
CREATE INDEX "marketing_agency_campaigns_created_at_idx" ON "marketing_agency_campaigns"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_agency_campaigns_organization_id_slug_key" ON "marketing_agency_campaigns"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "marketing_agency_source_refs_organization_id_campaign_id_idx" ON "marketing_agency_source_refs"("organization_id", "campaign_id");

-- CreateIndex
CREATE INDEX "marketing_agency_source_refs_created_by_id_idx" ON "marketing_agency_source_refs"("created_by_id");

-- CreateIndex
CREATE INDEX "marketing_agency_claims_organization_id_campaign_id_idx" ON "marketing_agency_claims"("organization_id", "campaign_id");

-- CreateIndex
CREATE INDEX "marketing_agency_claims_organization_id_approval_status_idx" ON "marketing_agency_claims"("organization_id", "approval_status");

-- CreateIndex
CREATE INDEX "marketing_agency_claims_source_ref_id_idx" ON "marketing_agency_claims"("source_ref_id");

-- CreateIndex
CREATE INDEX "marketing_agency_claims_created_by_id_idx" ON "marketing_agency_claims"("created_by_id");

-- CreateIndex
CREATE INDEX "marketing_agency_assets_organization_id_campaign_id_idx" ON "marketing_agency_assets"("organization_id", "campaign_id");

-- CreateIndex
CREATE INDEX "marketing_agency_assets_provider_provider_asset_id_idx" ON "marketing_agency_assets"("provider", "provider_asset_id");

-- CreateIndex
CREATE INDEX "marketing_agency_assets_created_by_id_idx" ON "marketing_agency_assets"("created_by_id");

-- CreateIndex
CREATE INDEX "marketing_agency_qa_reports_organization_id_campaign_id_idx" ON "marketing_agency_qa_reports"("organization_id", "campaign_id");

-- CreateIndex
CREATE INDEX "marketing_agency_qa_reports_status_idx" ON "marketing_agency_qa_reports"("status");

-- CreateIndex
CREATE INDEX "marketing_agency_qa_reports_created_by_id_idx" ON "marketing_agency_qa_reports"("created_by_id");

-- CreateIndex
CREATE INDEX "marketing_agency_export_packages_organization_id_campaign_i_idx" ON "marketing_agency_export_packages"("organization_id", "campaign_id");

-- CreateIndex
CREATE INDEX "marketing_agency_export_packages_status_idx" ON "marketing_agency_export_packages"("status");

-- CreateIndex
CREATE INDEX "marketing_agency_export_packages_created_by_id_idx" ON "marketing_agency_export_packages"("created_by_id");

-- CreateIndex
CREATE INDEX "marketing_agency_signals_organization_id_status_idx" ON "marketing_agency_signals"("organization_id", "status");

-- CreateIndex
CREATE INDEX "marketing_agency_signals_organization_id_approval_status_idx" ON "marketing_agency_signals"("organization_id", "approval_status");

-- CreateIndex
CREATE INDEX "marketing_agency_signals_organization_id_risk_state_idx" ON "marketing_agency_signals"("organization_id", "risk_state");

-- CreateIndex
CREATE INDEX "marketing_agency_signals_organization_id_captured_at_idx" ON "marketing_agency_signals"("organization_id", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "marketing_agency_signals_campaign_id_idx" ON "marketing_agency_signals"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_agency_signals_id_organization_id_key" ON "marketing_agency_signals"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_agency_signals_organization_id_external_id_key" ON "marketing_agency_signals"("organization_id", "external_id");

-- CreateIndex
CREATE INDEX "marketing_agency_opportunities_organization_id_status_idx" ON "marketing_agency_opportunities"("organization_id", "status");

-- CreateIndex
CREATE INDEX "marketing_agency_opportunities_organization_id_approval_sta_idx" ON "marketing_agency_opportunities"("organization_id", "approval_status");

-- CreateIndex
CREATE INDEX "marketing_agency_opportunities_signal_id_idx" ON "marketing_agency_opportunities"("signal_id");

-- CreateIndex
CREATE INDEX "marketing_agency_opportunities_campaign_id_idx" ON "marketing_agency_opportunities"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_agency_opportunities_id_organization_id_key" ON "marketing_agency_opportunities"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_agency_opportunities_organization_id_external_id_key" ON "marketing_agency_opportunities"("organization_id", "external_id");

-- CreateIndex
CREATE INDEX "marketing_agency_outcome_events_organization_id_event_type_idx" ON "marketing_agency_outcome_events"("organization_id", "event_type");

-- CreateIndex
CREATE INDEX "marketing_agency_outcome_events_organization_id_recorded_at_idx" ON "marketing_agency_outcome_events"("organization_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "marketing_agency_outcome_events_signal_id_idx" ON "marketing_agency_outcome_events"("signal_id");

-- CreateIndex
CREATE INDEX "marketing_agency_outcome_events_opportunity_id_idx" ON "marketing_agency_outcome_events"("opportunity_id");

-- CreateIndex
CREATE INDEX "marketing_agency_outcome_events_campaign_id_idx" ON "marketing_agency_outcome_events"("campaign_id");

-- CreateIndex
CREATE INDEX "marketing_agents_organization_id_status_idx" ON "marketing_agents"("organization_id", "status");

-- CreateIndex
CREATE INDEX "marketing_agents_created_by_id_idx" ON "marketing_agents"("created_by_id");

-- CreateIndex
CREATE INDEX "marketing_agent_runs_agent_id_started_at_idx" ON "marketing_agent_runs"("agent_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "marketing_agent_runs_organization_id_status_idx" ON "marketing_agent_runs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "marketing_agent_runs_triggered_by_id_idx" ON "marketing_agent_runs"("triggered_by_id");

-- CreateIndex
CREATE INDEX "workflow_executions_organization_id_idx" ON "workflow_executions"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_executions_organization_id_status_idx" ON "workflow_executions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "workflow_executions_batch_id_idx" ON "workflow_executions"("batch_id");

-- CreateIndex
CREATE INDEX "step_executions_workflow_execution_id_idx" ON "step_executions"("workflow_execution_id");

-- CreateIndex
CREATE INDEX "step_executions_workflow_execution_id_step_index_idx" ON "step_executions"("workflow_execution_id", "step_index");

-- CreateIndex
CREATE INDEX "AuthorityAnalysis_userId_idx" ON "AuthorityAnalysis"("userId");

-- CreateIndex
CREATE INDEX "AuthorityAnalysis_orgId_idx" ON "AuthorityAnalysis"("orgId");

-- CreateIndex
CREATE INDEX "AuthorityCitation_analysisId_idx" ON "AuthorityCitation"("analysisId");

-- CreateIndex
CREATE INDEX "CitationMonitor_userId_idx" ON "CitationMonitor"("userId");

-- CreateIndex
CREATE INDEX "CitationMonitor_orgId_idx" ON "CitationMonitor"("orgId");

-- CreateIndex
CREATE INDEX "VoiceProfile_userId_idx" ON "VoiceProfile"("userId");

-- CreateIndex
CREATE INDEX "VoiceProfile_orgId_idx" ON "VoiceProfile"("orgId");

-- CreateIndex
CREATE INDEX "ContentCapsule_userId_idx" ON "ContentCapsule"("userId");

-- CreateIndex
CREATE INDEX "ContentCapsule_orgId_idx" ON "ContentCapsule"("orgId");

-- CreateIndex
CREATE INDEX "ContentQualityAudit_userId_idx" ON "ContentQualityAudit"("userId");

-- CreateIndex
CREATE INDEX "ContentQualityAudit_orgId_idx" ON "ContentQualityAudit"("orgId");

-- CreateIndex
CREATE INDEX "EEATAudit_userId_idx" ON "EEATAudit"("userId");

-- CreateIndex
CREATE INDEX "EEATAudit_orgId_idx" ON "EEATAudit"("orgId");

-- CreateIndex
CREATE INDEX "BrandIdentity_userId_idx" ON "BrandIdentity"("userId");

-- CreateIndex
CREATE INDEX "BrandIdentity_orgId_idx" ON "BrandIdentity"("orgId");

-- CreateIndex
CREATE INDEX "BrandCredential_brandId_idx" ON "BrandCredential"("brandId");

-- CreateIndex
CREATE INDEX "BrandMention_brandId_idx" ON "BrandMention"("brandId");

-- CreateIndex
CREATE INDEX "BrandMention_userId_idx" ON "BrandMention"("userId");

-- CreateIndex
CREATE INDEX "BrandMention_publishedAt_idx" ON "BrandMention"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrandMention_urlHash_brandId_key" ON "BrandMention"("urlHash", "brandId");

-- CreateIndex
CREATE INDEX "JournalistContact_orgId_idx" ON "JournalistContact"("orgId");

-- CreateIndex
CREATE INDEX "JournalistContact_userId_idx" ON "JournalistContact"("userId");

-- CreateIndex
CREATE INDEX "JournalistContact_outletDomain_idx" ON "JournalistContact"("outletDomain");

-- CreateIndex
CREATE INDEX "JournalistContact_tier_idx" ON "JournalistContact"("tier");

-- CreateIndex
CREATE INDEX "PRPitch_orgId_idx" ON "PRPitch"("orgId");

-- CreateIndex
CREATE INDEX "PRPitch_userId_idx" ON "PRPitch"("userId");

-- CreateIndex
CREATE INDEX "PRPitch_journalistId_idx" ON "PRPitch"("journalistId");

-- CreateIndex
CREATE INDEX "PRPitch_status_idx" ON "PRPitch"("status");

-- CreateIndex
CREATE INDEX "PRPitch_followUpAt_idx" ON "PRPitch"("followUpAt");

-- CreateIndex
CREATE INDEX "MediaCoverage_orgId_idx" ON "MediaCoverage"("orgId");

-- CreateIndex
CREATE INDEX "MediaCoverage_pitchId_idx" ON "MediaCoverage"("pitchId");

-- CreateIndex
CREATE INDEX "MediaCoverage_journalistId_idx" ON "MediaCoverage"("journalistId");

-- CreateIndex
CREATE INDEX "MediaCoverage_publishedAt_idx" ON "MediaCoverage"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaCoverage_urlHash_orgId_key" ON "MediaCoverage"("urlHash", "orgId");

-- CreateIndex
CREATE INDEX "PressRelease_orgId_idx" ON "PressRelease"("orgId");

-- CreateIndex
CREATE INDEX "PressRelease_status_idx" ON "PressRelease"("status");

-- CreateIndex
CREATE INDEX "PressRelease_datePublished_idx" ON "PressRelease"("datePublished");

-- CreateIndex
CREATE UNIQUE INDEX "PressRelease_orgId_slug_key" ON "PressRelease"("orgId", "slug");

-- CreateIndex
CREATE INDEX "PRDistribution_releaseId_idx" ON "PRDistribution"("releaseId");

-- CreateIndex
CREATE INDEX "AwardListing_userId_idx" ON "AwardListing"("userId");

-- CreateIndex
CREATE INDEX "AwardListing_deadline_idx" ON "AwardListing"("deadline");

-- CreateIndex
CREATE INDEX "DirectoryListing_userId_idx" ON "DirectoryListing"("userId");

-- CreateIndex
CREATE INDEX "DirectoryListing_status_idx" ON "DirectoryListing"("status");

-- CreateIndex
CREATE INDEX "SubmissionTracker_userId_idx" ON "SubmissionTracker"("userId");

-- CreateIndex
CREATE INDEX "SubmissionTracker_dueDate_idx" ON "SubmissionTracker"("dueDate");

-- CreateIndex
CREATE INDEX "BacklinkProspect_userId_idx" ON "BacklinkProspect"("userId");

-- CreateIndex
CREATE INDEX "BacklinkProspect_orgId_idx" ON "BacklinkProspect"("orgId");

-- CreateIndex
CREATE INDEX "BacklinkProspect_opportunityType_idx" ON "BacklinkProspect"("opportunityType");

-- CreateIndex
CREATE INDEX "BacklinkProspect_status_idx" ON "BacklinkProspect"("status");

-- CreateIndex
CREATE INDEX "BacklinkAnalysis_userId_idx" ON "BacklinkAnalysis"("userId");

-- CreateIndex
CREATE INDEX "BacklinkAnalysis_orgId_idx" ON "BacklinkAnalysis"("orgId");

-- CreateIndex
CREATE INDEX "PromptTracker_userId_idx" ON "PromptTracker"("userId");

-- CreateIndex
CREATE INDEX "PromptTracker_orgId_idx" ON "PromptTracker"("orgId");

-- CreateIndex
CREATE INDEX "PromptTracker_status_idx" ON "PromptTracker"("status");

-- CreateIndex
CREATE INDEX "PromptTracker_promptCategory_idx" ON "PromptTracker"("promptCategory");

-- CreateIndex
CREATE INDEX "PromptResult_trackerId_idx" ON "PromptResult"("trackerId");

-- CreateIndex
CREATE INDEX "algorithm_updates_announcedAt_idx" ON "algorithm_updates"("announcedAt");

-- CreateIndex
CREATE INDEX "site_health_snapshots_userId_idx" ON "site_health_snapshots"("userId");

-- CreateIndex
CREATE INDEX "site_health_snapshots_orgId_idx" ON "site_health_snapshots"("orgId");

-- CreateIndex
CREATE INDEX "site_health_snapshots_siteUrl_snapshotDate_idx" ON "site_health_snapshots"("siteUrl", "snapshotDate");

-- CreateIndex
CREATE INDEX "sentinel_alerts_userId_idx" ON "sentinel_alerts"("userId");

-- CreateIndex
CREATE INDEX "sentinel_alerts_orgId_idx" ON "sentinel_alerts"("orgId");

-- CreateIndex
CREATE INDEX "sentinel_alerts_createdAt_idx" ON "sentinel_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "seo_experiments_userId_idx" ON "seo_experiments"("userId");

-- CreateIndex
CREATE INDEX "seo_experiments_orgId_idx" ON "seo_experiments"("orgId");

-- CreateIndex
CREATE INDEX "experiment_observations_experimentId_idx" ON "experiment_observations"("experimentId");

-- CreateIndex
CREATE INDEX "healing_actions_userId_idx" ON "healing_actions"("userId");

-- CreateIndex
CREATE INDEX "healing_actions_orgId_idx" ON "healing_actions"("orgId");

-- CreateIndex
CREATE INDEX "bo_spaces_org_id_idx" ON "bo_spaces"("org_id");

-- CreateIndex
CREATE INDEX "bo_spaces_user_id_idx" ON "bo_spaces"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bo_spaces_org_id_surface_key" ON "bo_spaces"("org_id", "surface");

-- CreateIndex
CREATE INDEX "bo_observations_space_id_idx" ON "bo_observations"("space_id");

-- CreateIndex
CREATE INDEX "bo_observations_recorded_at_idx" ON "bo_observations"("recorded_at");

-- CreateIndex
CREATE INDEX "bo_optimisation_runs_space_id_idx" ON "bo_optimisation_runs"("space_id");

-- CreateIndex
CREATE INDEX "bo_optimisation_runs_org_id_idx" ON "bo_optimisation_runs"("org_id");

-- CreateIndex
CREATE INDEX "bo_optimisation_runs_status_idx" ON "bo_optimisation_runs"("status");

-- CreateIndex
CREATE INDEX "forecast_models_org_id_idx" ON "forecast_models"("org_id");

-- CreateIndex
CREATE INDEX "forecast_models_status_idx" ON "forecast_models"("status");

-- CreateIndex
CREATE UNIQUE INDEX "forecast_models_org_id_metric_platform_key" ON "forecast_models"("org_id", "metric", "platform");

-- CreateIndex
CREATE INDEX "forecasts_model_id_idx" ON "forecasts"("model_id");

-- CreateIndex
CREATE INDEX "forecasts_org_id_idx" ON "forecasts"("org_id");

-- CreateIndex
CREATE INDEX "spatiotemporal_models_org_id_idx" ON "spatiotemporal_models"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "spatiotemporal_models_org_id_name_key" ON "spatiotemporal_models"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE INDEX "invite_codes_code_idx" ON "invite_codes"("code");

-- CreateIndex
CREATE INDEX "invite_codes_email_idx" ON "invite_codes"("email");

-- CreateIndex
CREATE INDEX "invite_codes_is_active_idx" ON "invite_codes"("is_active");

-- CreateIndex
CREATE INDEX "vault_secrets_organization_id_secret_type_idx" ON "vault_secrets"("organization_id", "secret_type");

-- CreateIndex
CREATE INDEX "vault_secrets_organization_id_provider_idx" ON "vault_secrets"("organization_id", "provider");

-- CreateIndex
CREATE INDEX "vault_secrets_organization_id_is_active_idx" ON "vault_secrets"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "vault_secrets_expires_at_idx" ON "vault_secrets"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "vault_secrets_organization_id_slug_key" ON "vault_secrets"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "vault_access_logs_vault_secret_id_idx" ON "vault_access_logs"("vault_secret_id");

-- CreateIndex
CREATE INDEX "vault_access_logs_organization_id_created_at_idx" ON "vault_access_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "vault_access_logs_actor_idx" ON "vault_access_logs"("actor");

-- CreateIndex
CREATE INDEX "vault_access_logs_action_idx" ON "vault_access_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "brand_dna_organizationId_key" ON "brand_dna"("organizationId");

-- CreateIndex
CREATE INDEX "brand_dna_organizationId_idx" ON "brand_dna"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_operating_system_organizationId_key" ON "brand_operating_system"("organizationId");

-- CreateIndex
CREATE INDEX "brand_operating_system_organizationId_idx" ON "brand_operating_system"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "client_profile_organizationId_key" ON "client_profile"("organizationId");

-- CreateIndex
CREATE INDEX "client_profile_organizationId_idx" ON "client_profile"("organizationId");

-- CreateIndex
CREATE INDEX "auto_research_runs_organizationId_idx" ON "auto_research_runs"("organizationId");

-- CreateIndex
CREATE INDEX "auto_research_runs_status_idx" ON "auto_research_runs"("status");

-- CreateIndex
CREATE INDEX "auto_research_runs_startedAt_idx" ON "auto_research_runs"("startedAt");

-- CreateIndex
CREATE INDEX "trend_insights_organizationId_idx" ON "trend_insights"("organizationId");

-- CreateIndex
CREATE INDEX "trend_insights_platform_category_idx" ON "trend_insights"("platform", "category");

-- CreateIndex
CREATE INDEX "trend_insights_runId_idx" ON "trend_insights"("runId");

-- CreateIndex
CREATE INDEX "trend_insights_confidence_idx" ON "trend_insights"("confidence");

-- CreateIndex
CREATE INDEX "gsc_properties_organization_id_idx" ON "gsc_properties"("organization_id");

-- CreateIndex
CREATE INDEX "gsc_properties_connection_id_idx" ON "gsc_properties"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "gsc_properties_organization_id_site_url_key" ON "gsc_properties"("organization_id", "site_url");

-- CreateIndex
CREATE INDEX "ga4_properties_organization_id_idx" ON "ga4_properties"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ga4_properties_organization_id_property_id_key" ON "ga4_properties"("organization_id", "property_id");

-- CreateIndex
CREATE INDEX "gsc_snapshots_organization_id_site_url_idx" ON "gsc_snapshots"("organization_id", "site_url");

-- CreateIndex
CREATE INDEX "gsc_snapshots_date_idx" ON "gsc_snapshots"("date");

-- CreateIndex
CREATE UNIQUE INDEX "gsc_snapshots_organization_id_site_url_date_key" ON "gsc_snapshots"("organization_id", "site_url", "date");

-- CreateIndex
CREATE INDEX "gbp_locations_organization_id_idx" ON "gbp_locations"("organization_id");

-- CreateIndex
CREATE INDEX "gbp_locations_connection_id_idx" ON "gbp_locations"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "gbp_locations_organization_id_location_id_key" ON "gbp_locations"("organization_id", "location_id");

-- CreateIndex
CREATE INDEX "idx_geo_citation_user_date" ON "geo_citation_events"("user_id", "query_date");

-- CreateIndex
CREATE INDEX "idx_geo_citation_engine" ON "geo_citation_events"("search_engine");

-- CreateIndex
CREATE INDEX "idx_geo_citation_mentioned" ON "geo_citation_events"("brand_mentioned");

-- CreateIndex
CREATE INDEX "gbp_reviews_organization_id_idx" ON "gbp_reviews"("organization_id");

-- CreateIndex
CREATE INDEX "gbp_reviews_location_id_idx" ON "gbp_reviews"("location_id");

-- CreateIndex
CREATE INDEX "gbp_reviews_rating_idx" ON "gbp_reviews"("rating");

-- CreateIndex
CREATE INDEX "gbp_reviews_review_time_idx" ON "gbp_reviews"("review_time");

-- CreateIndex
CREATE INDEX "gbp_reviews_organization_id_status_review_time_idx" ON "gbp_reviews"("organization_id", "status", "review_time" DESC);

-- CreateIndex
CREATE INDEX "gbp_reviews_organization_id_display_on_widget_is_featured_idx" ON "gbp_reviews"("organization_id", "display_on_widget", "is_featured");

-- CreateIndex
CREATE UNIQUE INDEX "gbp_reviews_organization_id_gbp_review_id_key" ON "gbp_reviews"("organization_id", "gbp_review_id");

-- CreateIndex
CREATE INDEX "gbp_snapshots_organization_id_location_id_idx" ON "gbp_snapshots"("organization_id", "location_id");

-- CreateIndex
CREATE INDEX "gbp_snapshots_date_idx" ON "gbp_snapshots"("date");

-- CreateIndex
CREATE UNIQUE INDEX "gbp_snapshots_organization_id_location_id_date_key" ON "gbp_snapshots"("organization_id", "location_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "autopilot_configs_organization_id_key" ON "autopilot_configs"("organization_id");

-- CreateIndex
CREATE INDEX "autopilot_configs_enabled_next_run_at_idx" ON "autopilot_configs"("enabled", "next_run_at");

-- CreateIndex
CREATE INDEX "autopilot_runs_organization_id_started_at_idx" ON "autopilot_runs"("organization_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "autopilot_runs_run_type_idx" ON "autopilot_runs"("run_type");

-- CreateIndex
CREATE INDEX "autopilot_runs_status_idx" ON "autopilot_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "testimonial_requests_token_key" ON "testimonial_requests"("token");

-- CreateIndex
CREATE INDEX "testimonial_requests_organization_id_idx" ON "testimonial_requests"("organization_id");

-- CreateIndex
CREATE INDEX "testimonial_requests_token_idx" ON "testimonial_requests"("token");

-- CreateIndex
CREATE INDEX "testimonials_organization_id_idx" ON "testimonials"("organization_id");

-- CreateIndex
CREATE INDEX "testimonials_request_id_idx" ON "testimonials"("request_id");

-- CreateIndex
CREATE INDEX "testimonials_status_idx" ON "testimonials"("status");

-- CreateIndex
CREATE INDEX "generated_content_founder_id_idx" ON "generated_content"("founder_id");

-- CreateIndex
CREATE INDEX "generated_content_founder_id_status_created_at_idx" ON "generated_content"("founder_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "video_assets_founder_id_idx" ON "video_assets"("founder_id");

-- CreateIndex
CREATE INDEX "video_assets_founder_id_status_idx" ON "video_assets"("founder_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "video_series_slug_key" ON "video_series"("slug");

-- CreateIndex
CREATE INDEX "video_series_series_type_status_idx" ON "video_series"("series_type", "status");

-- CreateIndex
CREATE INDEX "video_series_organisation_id_idx" ON "video_series"("organisation_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_episodes_slug_key" ON "video_episodes"("slug");

-- CreateIndex
CREATE INDEX "video_episodes_series_id_status_idx" ON "video_episodes"("series_id", "status");

-- CreateIndex
CREATE INDEX "video_episodes_status_scheduled_at_idx" ON "video_episodes"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "video_episodes_youtube_video_id_idx" ON "video_episodes"("youtube_video_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_episodes_series_id_episode_number_key" ON "video_episodes"("series_id", "episode_number");

-- CreateIndex
CREATE INDEX "video_topic_queue_series_id_status_priority_idx" ON "video_topic_queue"("series_id", "status", "priority");

-- CreateIndex
CREATE INDEX "social_engagements_founder_id_idx" ON "social_engagements"("founder_id");

-- CreateIndex
CREATE INDEX "social_engagements_founder_id_platform_recorded_at_idx" ON "social_engagements"("founder_id", "platform", "recorded_at");

-- CreateIndex
CREATE INDEX "email_campaigns_founder_id_idx" ON "email_campaigns"("founder_id");

-- CreateIndex
CREATE INDEX "email_campaigns_founder_id_status_created_at_idx" ON "email_campaigns"("founder_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "platform_analytics_founder_id_idx" ON "platform_analytics"("founder_id");

-- CreateIndex
CREATE INDEX "platform_analytics_founder_id_platform_period_date_idx" ON "platform_analytics"("founder_id", "platform", "period_date");

-- CreateIndex
CREATE INDEX "advisory_cases_founder_id_idx" ON "advisory_cases"("founder_id");

-- CreateIndex
CREATE INDEX "advisory_cases_approval_queue_id_idx" ON "advisory_cases"("approval_queue_id");

-- CreateIndex
CREATE INDEX "advisory_cases_founder_id_status_idx" ON "advisory_cases"("founder_id", "status");

-- CreateIndex
CREATE INDEX "experiments_founder_id_status_created_at_idx" ON "experiments"("founder_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "experiment_results_experiment_id_period_date_idx" ON "experiment_results"("experiment_id", "period_date");

-- CreateIndex
CREATE INDEX "credentials_vault_founder_id_service_idx" ON "credentials_vault"("founder_id", "service");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_vault_founder_id_service_key" ON "credentials_vault"("founder_id", "service");

-- CreateIndex
CREATE INDEX "nexus_databases_founder_id_page_id_idx" ON "nexus_databases"("founder_id", "page_id");

-- CreateIndex
CREATE INDEX "bookkeeper_transactions_founder_id_idx" ON "bookkeeper_transactions"("founder_id");

-- CreateIndex
CREATE INDEX "bookkeeper_transactions_transaction_date_idx" ON "bookkeeper_transactions"("transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "bookkeeper_transactions_founder_id_xero_transaction_id_key" ON "bookkeeper_transactions"("founder_id", "xero_transaction_id");

-- CreateIndex
CREATE INDEX "connected_projects_founder_id_idx" ON "connected_projects"("founder_id");

-- CreateIndex
CREATE INDEX "invoices_organization_id_status_idx" ON "invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "invoices_organization_id_idx" ON "invoices"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_invoice_number_key" ON "invoices"("organization_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "marketplace_products_org_id_idx" ON "marketplace_products"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_products_org_id_sku_key" ON "marketplace_products"("org_id", "sku");

-- CreateIndex
CREATE INDEX "marketplace_channel_listings_org_id_idx" ON "marketplace_channel_listings"("org_id");

-- CreateIndex
CREATE INDEX "marketplace_channel_listings_product_id_idx" ON "marketplace_channel_listings"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_channel_listings_org_id_channel_id_channel_list_key" ON "marketplace_channel_listings"("org_id", "channel_id", "channel_listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_organization_id_idx" ON "push_subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "industry_templates_industry_idx" ON "industry_templates"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_profiles_organization_id_key" ON "onboarding_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "onboarding_profiles_organization_id_idx" ON "onboarding_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "onboarding_profiles_user_id_idx" ON "onboarding_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_email_key" ON "waitlist_entries"("email");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_published_at_idx" ON "blog_posts"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "blog_posts_status_category_published_at_idx" ON "blog_posts"("status", "category", "published_at" DESC);

-- CreateIndex
CREATE INDEX "blog_posts_created_at_idx" ON "blog_posts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "pipeline_cost_ledger_pipeline_name_created_at_idx" ON "pipeline_cost_ledger"("pipeline_name", "created_at" DESC);

-- CreateIndex
CREATE INDEX "pipeline_cost_ledger_client_id_created_at_idx" ON "pipeline_cost_ledger"("client_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "org_budget_policies_organization_id_key" ON "org_budget_policies"("organization_id");

-- CreateIndex
CREATE INDEX "edge_function_logs_function_name_created_at_idx" ON "edge_function_logs"("function_name", "created_at" DESC);

-- CreateIndex
CREATE INDEX "authority_scores_client_id_computed_at_idx" ON "authority_scores"("client_id", "computed_at" DESC);

-- CreateIndex
CREATE INDEX "content_calendars_organization_id_week_start_idx" ON "content_calendars"("organization_id", "week_start" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "content_calendars_organization_id_week_start_key" ON "content_calendars"("organization_id", "week_start");

-- CreateIndex
CREATE INDEX "publish_queue_status_scheduled_at_idx" ON "publish_queue"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "publish_queue_organization_id_status_idx" ON "publish_queue"("organization_id", "status");

-- CreateIndex
CREATE INDEX "publish_queue_calendar_id_idx" ON "publish_queue"("calendar_id");

-- CreateIndex
CREATE INDEX "seasonal_signals_industry_slug_location_state_idx" ON "seasonal_signals"("industry_slug", "location_state");

-- CreateIndex
CREATE INDEX "seasonal_signals_window_start_idx" ON "seasonal_signals"("window_start");

-- CreateIndex
CREATE INDEX "seasonal_signals_confidence_score_idx" ON "seasonal_signals"("confidence_score");

-- CreateIndex
CREATE UNIQUE INDEX "seasonal_signals_industry_slug_location_state_window_start__key" ON "seasonal_signals"("industry_slug", "location_state", "window_start", "source");

-- CreateIndex
CREATE INDEX "seasonal_signal_dismissals_organization_id_idx" ON "seasonal_signal_dismissals"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "seasonal_signal_dismissals_organization_id_signal_id_key" ON "seasonal_signal_dismissals"("organization_id", "signal_id");

-- CreateIndex
CREATE INDEX "monthly_stories_organization_id_idx" ON "monthly_stories"("organization_id");

-- CreateIndex
CREATE INDEX "monthly_stories_delivered_at_idx" ON "monthly_stories"("delivered_at");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_stories_organization_id_month_year_key" ON "monthly_stories"("organization_id", "month_year");

-- CreateIndex
CREATE INDEX "story_quality_reviews_story_id_idx" ON "story_quality_reviews"("story_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_config_organization_id_key" ON "story_config"("organization_id");

-- CreateIndex
CREATE INDEX "recommended_actions_organization_id_created_at_idx" ON "recommended_actions"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "recommended_actions_status_idx" ON "recommended_actions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "recommended_actions_organization_id_week_start_key" ON "recommended_actions"("organization_id", "week_start");

-- CreateIndex
CREATE INDEX "advisor_feedback_organization_id_idx" ON "advisor_feedback"("organization_id");

-- CreateIndex
CREATE INDEX "advisor_feedback_week_start_idx" ON "advisor_feedback"("week_start");

-- CreateIndex
CREATE UNIQUE INDEX "advisor_feedback_organization_id_week_start_key" ON "advisor_feedback"("organization_id", "week_start");

-- CreateIndex
CREATE INDEX "team_members_organization_id_idx" ON "team_members"("organization_id");

-- CreateIndex
CREATE INDEX "team_members_role_idx" ON "team_members"("role");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_user_id_organization_id_key" ON "team_members"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "team_member_page_views_team_member_id_idx" ON "team_member_page_views"("team_member_id");

-- CreateIndex
CREATE INDEX "team_member_page_views_organization_id_idx" ON "team_member_page_views"("organization_id");

-- CreateIndex
CREATE INDEX "team_member_page_views_viewed_at_idx" ON "team_member_page_views"("viewed_at");

-- CreateIndex
CREATE INDEX "team_member_page_views_organization_id_page_path_idx" ON "team_member_page_views"("organization_id", "page_path");

-- CreateIndex
CREATE INDEX "client_health_scores_organization_id_idx" ON "client_health_scores"("organization_id");

-- CreateIndex
CREATE INDEX "client_health_scores_week_start_idx" ON "client_health_scores"("week_start");

-- CreateIndex
CREATE INDEX "client_health_scores_risk_level_idx" ON "client_health_scores"("risk_level");

-- CreateIndex
CREATE INDEX "client_health_scores_client_id_idx" ON "client_health_scores"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_health_scores_organization_id_week_start_key" ON "client_health_scores"("organization_id", "week_start");

-- CreateIndex
CREATE INDEX "client_engagement_events_client_id_event_type_created_at_idx" ON "client_engagement_events"("client_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "client_engagement_events_client_id_created_at_idx" ON "client_engagement_events"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "client_engagement_events_crm_client_id_idx" ON "client_engagement_events"("crm_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "intervention_config_dimension_key" ON "intervention_config"("dimension");

-- CreateIndex
CREATE INDEX "health_interventions_organization_id_created_at_idx" ON "health_interventions"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "health_interventions_dimension_created_at_idx" ON "health_interventions"("dimension", "created_at");

-- CreateIndex
CREATE INDEX "health_interventions_observation_mode_idx" ON "health_interventions"("observation_mode");

-- CreateIndex
CREATE UNIQUE INDEX "intervention_templates_tier_dimension_channel_key" ON "intervention_templates"("tier", "dimension", "channel");

-- CreateIndex
CREATE INDEX "founder_outreach_queue_organization_id_idx" ON "founder_outreach_queue"("organization_id");

-- CreateIndex
CREATE INDEX "founder_outreach_queue_flagged_at_idx" ON "founder_outreach_queue"("flagged_at");

-- CreateIndex
CREATE INDEX "founder_outreach_queue_resolved_at_idx" ON "founder_outreach_queue"("resolved_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_performance_profiles_organization_id_key" ON "content_performance_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "content_performance_profiles_organization_id_idx" ON "content_performance_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "content_performance_profiles_updated_at_idx" ON "content_performance_profiles"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "industry_baselines_industry_key" ON "industry_baselines"("industry");

-- CreateIndex
CREATE INDEX "industry_baselines_industry_idx" ON "industry_baselines"("industry");

-- CreateIndex
CREATE INDEX "content_improvement_tracking_organization_id_week_start_idx" ON "content_improvement_tracking"("organization_id", "week_start" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "content_improvement_tracking_organization_id_week_start_key" ON "content_improvement_tracking"("organization_id", "week_start");

-- CreateIndex
CREATE INDEX "leads_organization_id_occurred_at_idx" ON "leads"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "leads_organization_id_stage_idx" ON "leads"("organization_id", "stage");

-- CreateIndex
CREATE INDEX "leads_client_id_idx" ON "leads"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_map_scans_lead_id_key" ON "opportunity_map_scans"("lead_id");

-- CreateIndex
CREATE INDEX "opportunity_map_scans_fit_state_completed_at_idx" ON "opportunity_map_scans"("fit_state", "completed_at" DESC);

-- CreateIndex
CREATE INDEX "opportunity_map_scans_status_completed_at_idx" ON "opportunity_map_scans"("status", "completed_at" DESC);

-- CreateIndex
CREATE INDEX "contacts_organization_id_idx" ON "contacts"("organization_id");

-- CreateIndex
CREATE INDEX "contacts_client_id_idx" ON "contacts"("client_id");

-- CreateIndex
CREATE INDEX "scheduled_reports_user_id_idx" ON "scheduled_reports"("user_id");

-- CreateIndex
CREATE INDEX "scheduled_reports_is_active_next_run_at_idx" ON "scheduled_reports"("is_active", "next_run_at");

-- CreateIndex
CREATE INDEX "scheduled_reports_organization_id_idx" ON "scheduled_reports"("organization_id");

-- CreateIndex
CREATE INDEX "report_templates_user_id_idx" ON "report_templates"("user_id");

-- CreateIndex
CREATE INDEX "report_templates_organization_id_idx" ON "report_templates"("organization_id");

-- CreateIndex
CREATE INDEX "report_templates_is_system_idx" ON "report_templates"("is_system");

-- CreateIndex
CREATE INDEX "report_templates_category_idx" ON "report_templates"("category");

-- CreateIndex
CREATE INDEX "report_deliveries_report_id_idx" ON "report_deliveries"("report_id");

-- CreateIndex
CREATE INDEX "report_deliveries_scheduled_report_id_idx" ON "report_deliveries"("scheduled_report_id");

-- CreateIndex
CREATE INDEX "report_deliveries_status_idx" ON "report_deliveries"("status");

-- CreateIndex
CREATE INDEX "competitor_snapshots_competitor_id_idx" ON "competitor_snapshots"("competitor_id");

-- CreateIndex
CREATE INDEX "competitor_snapshots_competitor_id_snapshot_at_idx" ON "competitor_snapshots"("competitor_id", "snapshot_at");

-- CreateIndex
CREATE INDEX "competitor_snapshots_platform_idx" ON "competitor_snapshots"("platform");

-- CreateIndex
CREATE INDEX "competitor_snapshots_snapshot_at_idx" ON "competitor_snapshots"("snapshot_at");

-- CreateIndex
CREATE INDEX "competitor_posts_competitor_id_idx" ON "competitor_posts"("competitor_id");

-- CreateIndex
CREATE INDEX "competitor_posts_platform_idx" ON "competitor_posts"("platform");

-- CreateIndex
CREATE INDEX "competitor_posts_posted_at_idx" ON "competitor_posts"("posted_at");

-- CreateIndex
CREATE INDEX "competitor_posts_is_top_performing_idx" ON "competitor_posts"("is_top_performing");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_posts_competitor_id_platform_external_id_key" ON "competitor_posts"("competitor_id", "platform", "external_id");

-- CreateIndex
CREATE INDEX "competitor_alerts_user_id_idx" ON "competitor_alerts"("user_id");

-- CreateIndex
CREATE INDEX "competitor_alerts_competitor_id_idx" ON "competitor_alerts"("competitor_id");

-- CreateIndex
CREATE INDEX "competitor_alerts_is_read_idx" ON "competitor_alerts"("is_read");

-- CreateIndex
CREATE INDEX "competitor_alerts_created_at_idx" ON "competitor_alerts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "hermes_config_organization_id_key" ON "hermes_config"("organization_id");

-- CreateIndex
CREATE INDEX "hermes_config_organization_id_idx" ON "hermes_config"("organization_id");

-- CreateIndex
CREATE INDEX "hermes_discovery_signal_organization_id_created_at_idx" ON "hermes_discovery_signal"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "hermes_discovery_signal_organization_id_signal_type_idx" ON "hermes_discovery_signal"("organization_id", "signal_type");

-- CreateIndex
CREATE INDEX "hermes_gap_candidate_organization_id_status_priority_idx" ON "hermes_gap_candidate"("organization_id", "status", "priority" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "hermes_proposal_post_id_key" ON "hermes_proposal"("post_id");

-- CreateIndex
CREATE INDEX "hermes_proposal_organization_id_status_created_at_idx" ON "hermes_proposal"("organization_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "aeo_gate_runs_brand_created_at_idx" ON "aeo_gate_runs"("brand", "created_at" DESC);

-- CreateIndex
CREATE INDEX "aeo_gate_runs_surface_created_at_idx" ON "aeo_gate_runs"("surface", "created_at" DESC);

-- CreateIndex
CREATE INDEX "aeo_gate_runs_pass_created_at_idx" ON "aeo_gate_runs"("pass", "created_at" DESC);

-- CreateIndex
CREATE INDEX "aeo_gate_runs_source_of_truth_job_id_idx" ON "aeo_gate_runs"("source_of_truth_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_nap_citation_brand_directory" ON "nap_citation"("brand", "directory");

-- CreateIndex
CREATE UNIQUE INDEX "mention_freshness_mention_id_key" ON "mention_freshness"("mention_id");

-- CreateIndex
CREATE INDEX "mention_freshness_brand_last_seen_at_idx" ON "mention_freshness"("brand", "last_seen_at" DESC);

-- CreateIndex
CREATE INDEX "mention_freshness_source_last_seen_at_idx" ON "mention_freshness"("source", "last_seen_at" DESC);

-- CreateIndex
CREATE INDEX "studio_content_drafts_organization_id_client_slug_status_idx" ON "studio_content_drafts"("organization_id", "client_slug", "status");

-- CreateIndex
CREATE INDEX "studio_content_drafts_organization_id_status_idx" ON "studio_content_drafts"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "studio_content_drafts_org_client_dedupe_key" ON "studio_content_drafts"("organization_id", "client_slug", "dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "promo_codes_organization_id_active_idx" ON "promo_codes"("organization_id", "active");

-- CreateIndex
CREATE INDEX "creators_organization_id_status_idx" ON "creators"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ugc_submissions_organization_id_status_idx" ON "ugc_submissions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ugc_submissions_creator_id_idx" ON "ugc_submissions"("creator_id");

-- CreateIndex
CREATE INDEX "claim_evidence_scores_organization_id_claim_id_idx" ON "claim_evidence_scores"("organization_id", "claim_id");

-- CreateIndex
CREATE INDEX "claim_evidence_scores_source_ref_id_idx" ON "claim_evidence_scores"("source_ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "claim_evidence_scores_claim_id_source_ref_id_scorer_key" ON "claim_evidence_scores"("claim_id", "source_ref_id", "scorer");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_api_keys_key_hash_key" ON "mcp_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "mcp_api_keys_organization_id_idx" ON "mcp_api_keys"("organization_id");

-- CreateIndex
CREATE INDEX "video_gate_verdicts_ref_gate_created_at_idx" ON "video_gate_verdicts"("ref", "gate", "created_at" DESC);

-- CreateIndex
CREATE INDEX "video_gate_verdicts_organization_id_idx" ON "video_gate_verdicts"("organization_id");

-- CreateIndex
CREATE INDEX "brand_presets_organization_id_idx" ON "brand_presets"("organization_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_org_id_fkey" FOREIGN KEY ("parent_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_topic_suggestions" ADD CONSTRAINT "content_topic_suggestions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_targets" ADD CONSTRAINT "keyword_targets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_rank_snapshots" ADD CONSTRAINT "keyword_rank_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_rank_snapshots" ADD CONSTRAINT "keyword_rank_snapshots_keyword_target_id_fkey" FOREIGN KEY ("keyword_target_id") REFERENCES "keyword_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_scores" ADD CONSTRAINT "visibility_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_posts" ADD CONSTRAINT "platform_posts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "platform_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_metrics" ADD CONSTRAINT "platform_metrics_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "platform_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_generations" ADD CONSTRAINT "brand_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psychology_metrics" ADD CONSTRAINT "psychology_metrics_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "brand_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_psychology_preferences" ADD CONSTRAINT "user_psychology_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitive_analyses" ADD CONSTRAINT "competitive_analyses_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "brand_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_library" ADD CONSTRAINT "content_library_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_training_data" ADD CONSTRAINT "persona_training_data_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_investments" ADD CONSTRAINT "content_investments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor_deals" ADD CONSTRAINT "sponsor_deals_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor_deals" ADD CONSTRAINT "sponsor_deals_revenue_entry_id_fkey" FOREIGN KEY ("revenue_entry_id") REFERENCES "revenue_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_deliverables" ADD CONSTRAINT "deal_deliverables_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "sponsor_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentscape_artifacts" ADD CONSTRAINT "intentscape_artifacts_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id", "organization_id") REFERENCES "intentscape_workspaces"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentscape_vision_runs" ADD CONSTRAINT "intentscape_vision_runs_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id", "organization_id") REFERENCES "intentscape_workspaces"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentscape_hypotheses" ADD CONSTRAINT "intentscape_hypotheses_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id", "organization_id") REFERENCES "intentscape_workspaces"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentscape_hypotheses" ADD CONSTRAINT "intentscape_hypotheses_vision_run_id_organization_id_fkey" FOREIGN KEY ("vision_run_id", "organization_id") REFERENCES "intentscape_vision_runs"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentscape_goal_contracts" ADD CONSTRAINT "intentscape_goal_contracts_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id", "organization_id") REFERENCES "intentscape_workspaces"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentscape_goal_contracts" ADD CONSTRAINT "intentscape_goal_contracts_vision_run_id_organization_id_fkey" FOREIGN KEY ("vision_run_id", "organization_id") REFERENCES "intentscape_vision_runs"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentscape_events" ADD CONSTRAINT "intentscape_events_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id", "organization_id") REFERENCES "intentscape_workspaces"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_posts" ADD CONSTRAINT "calendar_posts_parent_post_id_fkey" FOREIGN KEY ("parent_post_id") REFERENCES "calendar_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_test_variants" ADD CONSTRAINT "ab_test_variants_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "ab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_test_results" ADD CONSTRAINT "ab_test_results_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "ab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_keyword_gaps" ADD CONSTRAINT "competitor_keyword_gaps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_keyword_gaps" ADD CONSTRAINT "competitor_keyword_gaps_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_weekly_digests" ADD CONSTRAINT "ai_weekly_digests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_health_scores" ADD CONSTRAINT "user_health_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_fkey" FOREIGN KEY ("referee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_loyalty_tiers" ADD CONSTRAINT "user_loyalty_tiers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_surveys" ADD CONSTRAINT "feedback_surveys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_profiles" ADD CONSTRAINT "author_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_audits" ADD CONSTRAINT "seo_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_audit_targets" ADD CONSTRAINT "scheduled_audit_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_analyses" ADD CONSTRAINT "geo_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_analyses" ADD CONSTRAINT "geo_analyses_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "author_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_analyses" ADD CONSTRAINT "entity_analyses_geo_analysis_id_fkey" FOREIGN KEY ("geo_analysis_id") REFERENCES "geo_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_analyses" ADD CONSTRAINT "entity_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_research_reports" ADD CONSTRAINT "geo_research_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_research_reports" ADD CONSTRAINT "geo_research_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visual_assets" ADD CONSTRAINT "visual_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visual_assets" ADD CONSTRAINT "visual_assets_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "geo_research_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_case_studies" ADD CONSTRAINT "local_case_studies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_authors" ADD CONSTRAINT "article_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "author_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_ownerships" ADD CONSTRAINT "business_ownerships_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_ownerships" ADD CONSTRAINT "business_ownerships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_keywords" ADD CONSTRAINT "tracked_keywords_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_keywords" ADD CONSTRAINT "tracked_keywords_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_mentions" ADD CONSTRAINT "social_mentions_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "tracked_keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_mentions" ADD CONSTRAINT "social_mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_bio_pages" ADD CONSTRAINT "link_bio_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_bio_links" ADD CONSTRAINT "link_bio_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "link_bio_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_networks" ADD CONSTRAINT "affiliate_networks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "affiliate_networks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_link_clicks" ADD CONSTRAINT "affiliate_link_clicks_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "affiliate_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_vetting_results" ADD CONSTRAINT "business_vetting_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_vetting_results" ADD CONSTRAINT "business_vetting_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_oauth_credentials" ADD CONSTRAINT "platform_oauth_credentials_configured_by_user_id_fkey" FOREIGN KEY ("configured_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_video_quotas" ADD CONSTRAINT "organization_video_quotas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_campaigns" ADD CONSTRAINT "marketing_agency_campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_campaigns" ADD CONSTRAINT "marketing_agency_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_source_refs" ADD CONSTRAINT "marketing_agency_source_refs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_source_refs" ADD CONSTRAINT "marketing_agency_source_refs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_source_refs" ADD CONSTRAINT "marketing_agency_source_refs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_agency_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_claims" ADD CONSTRAINT "marketing_agency_claims_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_claims" ADD CONSTRAINT "marketing_agency_claims_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_claims" ADD CONSTRAINT "marketing_agency_claims_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_agency_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_claims" ADD CONSTRAINT "marketing_agency_claims_source_ref_id_fkey" FOREIGN KEY ("source_ref_id") REFERENCES "marketing_agency_source_refs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_assets" ADD CONSTRAINT "marketing_agency_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_assets" ADD CONSTRAINT "marketing_agency_assets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_assets" ADD CONSTRAINT "marketing_agency_assets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_agency_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_qa_reports" ADD CONSTRAINT "marketing_agency_qa_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_qa_reports" ADD CONSTRAINT "marketing_agency_qa_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_qa_reports" ADD CONSTRAINT "marketing_agency_qa_reports_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_agency_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_export_packages" ADD CONSTRAINT "marketing_agency_export_packages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_export_packages" ADD CONSTRAINT "marketing_agency_export_packages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_export_packages" ADD CONSTRAINT "marketing_agency_export_packages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_agency_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_signals" ADD CONSTRAINT "marketing_agency_signals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_signals" ADD CONSTRAINT "marketing_agency_signals_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_agency_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_opportunities" ADD CONSTRAINT "marketing_agency_opportunities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_opportunities" ADD CONSTRAINT "marketing_agency_opportunities_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_agency_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_opportunities" ADD CONSTRAINT "marketing_agency_opportunities_signal_id_organization_id_fkey" FOREIGN KEY ("signal_id", "organization_id") REFERENCES "marketing_agency_signals"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_outcome_events" ADD CONSTRAINT "marketing_agency_outcome_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_outcome_events" ADD CONSTRAINT "marketing_agency_outcome_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_agency_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_outcome_events" ADD CONSTRAINT "marketing_agency_outcome_events_signal_id_organization_id_fkey" FOREIGN KEY ("signal_id", "organization_id") REFERENCES "marketing_agency_signals"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agency_outcome_events" ADD CONSTRAINT "marketing_agency_outcome_events_opportunity_id_organizatio_fkey" FOREIGN KEY ("opportunity_id", "organization_id") REFERENCES "marketing_agency_opportunities"("id", "organization_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agents" ADD CONSTRAINT "marketing_agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agents" ADD CONSTRAINT "marketing_agents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agent_runs" ADD CONSTRAINT "marketing_agent_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "marketing_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agent_runs" ADD CONSTRAINT "marketing_agent_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agent_runs" ADD CONSTRAINT "marketing_agent_runs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_agent_runs" ADD CONSTRAINT "marketing_agent_runs_qa_report_id_fkey" FOREIGN KEY ("qa_report_id") REFERENCES "marketing_agency_qa_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_executions" ADD CONSTRAINT "step_executions_workflow_execution_id_fkey" FOREIGN KEY ("workflow_execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorityAnalysis" ADD CONSTRAINT "AuthorityAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorityCitation" ADD CONSTRAINT "AuthorityCitation_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AuthorityAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationMonitor" ADD CONSTRAINT "CitationMonitor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceProfile" ADD CONSTRAINT "VoiceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCapsule" ADD CONSTRAINT "ContentCapsule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentQualityAudit" ADD CONSTRAINT "ContentQualityAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EEATAudit" ADD CONSTRAINT "EEATAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandIdentity" ADD CONSTRAINT "BrandIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCredential" ADD CONSTRAINT "BrandCredential_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMention" ADD CONSTRAINT "BrandMention_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalistContact" ADD CONSTRAINT "JournalistContact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalistContact" ADD CONSTRAINT "JournalistContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRPitch" ADD CONSTRAINT "PRPitch_journalistId_fkey" FOREIGN KEY ("journalistId") REFERENCES "JournalistContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRPitch" ADD CONSTRAINT "PRPitch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRPitch" ADD CONSTRAINT "PRPitch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaCoverage" ADD CONSTRAINT "MediaCoverage_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "PRPitch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaCoverage" ADD CONSTRAINT "MediaCoverage_journalistId_fkey" FOREIGN KEY ("journalistId") REFERENCES "JournalistContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaCoverage" ADD CONSTRAINT "MediaCoverage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaCoverage" ADD CONSTRAINT "MediaCoverage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressRelease" ADD CONSTRAINT "PressRelease_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressRelease" ADD CONSTRAINT "PressRelease_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRDistribution" ADD CONSTRAINT "PRDistribution_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "PressRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardListing" ADD CONSTRAINT "AwardListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectoryListing" ADD CONSTRAINT "DirectoryListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionTracker" ADD CONSTRAINT "SubmissionTracker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacklinkProspect" ADD CONSTRAINT "BacklinkProspect_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacklinkAnalysis" ADD CONSTRAINT "BacklinkAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptTracker" ADD CONSTRAINT "PromptTracker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptResult" ADD CONSTRAINT "PromptResult_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "PromptTracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_health_snapshots" ADD CONSTRAINT "site_health_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel_alerts" ADD CONSTRAINT "sentinel_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_experiments" ADD CONSTRAINT "seo_experiments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_observations" ADD CONSTRAINT "experiment_observations_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "seo_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "healing_actions" ADD CONSTRAINT "healing_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bo_spaces" ADD CONSTRAINT "bo_spaces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bo_observations" ADD CONSTRAINT "bo_observations_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "bo_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bo_optimisation_runs" ADD CONSTRAINT "bo_optimisation_runs_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "bo_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bo_optimisation_runs" ADD CONSTRAINT "bo_optimisation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_models" ADD CONSTRAINT "forecast_models_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "forecast_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spatiotemporal_models" ADD CONSTRAINT "spatiotemporal_models_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_secrets" ADD CONSTRAINT "vault_secrets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_secrets" ADD CONSTRAINT "vault_secrets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_access_logs" ADD CONSTRAINT "vault_access_logs_vault_secret_id_fkey" FOREIGN KEY ("vault_secret_id") REFERENCES "vault_secrets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_access_logs" ADD CONSTRAINT "vault_access_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_dna" ADD CONSTRAINT "brand_dna_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_operating_system" ADD CONSTRAINT "brand_operating_system_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profile" ADD CONSTRAINT "client_profile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_research_runs" ADD CONSTRAINT "auto_research_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trend_insights" ADD CONSTRAINT "trend_insights_runId_fkey" FOREIGN KEY ("runId") REFERENCES "auto_research_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trend_insights" ADD CONSTRAINT "trend_insights_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsc_properties" ADD CONSTRAINT "gsc_properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ga4_properties" ADD CONSTRAINT "ga4_properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsc_snapshots" ADD CONSTRAINT "gsc_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gbp_locations" ADD CONSTRAINT "gbp_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_citation_events" ADD CONSTRAINT "geo_citation_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gbp_reviews" ADD CONSTRAINT "gbp_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gbp_reviews" ADD CONSTRAINT "gbp_reviews_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "gbp_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gbp_snapshots" ADD CONSTRAINT "gbp_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autopilot_configs" ADD CONSTRAINT "autopilot_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autopilot_runs" ADD CONSTRAINT "autopilot_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonial_requests" ADD CONSTRAINT "testimonial_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "testimonial_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_content" ADD CONSTRAINT "generated_content_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_series" ADD CONSTRAINT "video_series_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_episodes" ADD CONSTRAINT "video_episodes_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "video_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_topic_queue" ADD CONSTRAINT "video_topic_queue_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "video_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_engagements" ADD CONSTRAINT "social_engagements_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_analytics" ADD CONSTRAINT "platform_analytics_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisory_cases" ADD CONSTRAINT "advisory_cases_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisory_cases" ADD CONSTRAINT "advisory_cases_approval_queue_id_fkey" FOREIGN KEY ("approval_queue_id") REFERENCES "approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_results" ADD CONSTRAINT "experiment_results_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials_vault" ADD CONSTRAINT "credentials_vault_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexus_databases" ADD CONSTRAINT "nexus_databases_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connected_projects" ADD CONSTRAINT "connected_projects_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_channel_listings" ADD CONSTRAINT "marketplace_channel_listings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "marketplace_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authority_scores" ADD CONSTRAINT "authority_scores_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_calendars" ADD CONSTRAINT "content_calendars_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_queue" ADD CONSTRAINT "publish_queue_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_queue" ADD CONSTRAINT "publish_queue_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "content_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasonal_signal_dismissals" ADD CONSTRAINT "seasonal_signal_dismissals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasonal_signal_dismissals" ADD CONSTRAINT "seasonal_signal_dismissals_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "seasonal_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_stories" ADD CONSTRAINT "monthly_stories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_quality_reviews" ADD CONSTRAINT "story_quality_reviews_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "monthly_stories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_config" ADD CONSTRAINT "story_config_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommended_actions" ADD CONSTRAINT "recommended_actions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_feedback" ADD CONSTRAINT "advisor_feedback_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member_page_views" ADD CONSTRAINT "team_member_page_views_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_health_scores" ADD CONSTRAINT "client_health_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_interventions" ADD CONSTRAINT "health_interventions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_outreach_queue" ADD CONSTRAINT "founder_outreach_queue_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_performance_profiles" ADD CONSTRAINT "content_performance_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_performance_profiles" ADD CONSTRAINT "content_performance_profiles_industry_baseline_id_fkey" FOREIGN KEY ("industry_baseline_id") REFERENCES "industry_baselines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_improvement_tracking" ADD CONSTRAINT "content_improvement_tracking_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_map_scans" ADD CONSTRAINT "opportunity_map_scans_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "report_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_snapshots" ADD CONSTRAINT "competitor_snapshots_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_posts" ADD CONSTRAINT "competitor_posts_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_alerts" ADD CONSTRAINT "competitor_alerts_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hermes_config" ADD CONSTRAINT "hermes_config_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hermes_discovery_signal" ADD CONSTRAINT "hermes_discovery_signal_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hermes_gap_candidate" ADD CONSTRAINT "hermes_gap_candidate_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hermes_proposal" ADD CONSTRAINT "hermes_proposal_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hermes_proposal" ADD CONSTRAINT "hermes_proposal_gap_candidate_id_fkey" FOREIGN KEY ("gap_candidate_id") REFERENCES "hermes_gap_candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hermes_proposal" ADD CONSTRAINT "hermes_proposal_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ugc_submissions" ADD CONSTRAINT "ugc_submissions_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence_scores" ADD CONSTRAINT "claim_evidence_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence_scores" ADD CONSTRAINT "claim_evidence_scores_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "marketing_agency_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence_scores" ADD CONSTRAINT "claim_evidence_scores_source_ref_id_fkey" FOREIGN KEY ("source_ref_id") REFERENCES "marketing_agency_source_refs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_presets" ADD CONSTRAINT "brand_presets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
