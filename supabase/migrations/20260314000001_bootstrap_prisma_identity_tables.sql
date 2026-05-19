-- ==============================================================================
-- SYNTHEX Prisma Identity Table Bootstrap
-- Generated: 2026-03-14
--
-- Supabase preview branches replay migrations from an empty database. The Prisma
-- schema owns public.users and public.organizations, but later Supabase
-- migrations reference them for vault, team, and organization-scoped features.
-- This bootstrap keeps the migration chain replayable without changing older
-- applied migrations.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "organizations" (
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
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organizations_parent_org_id_fkey"
        FOREIGN KEY ("parent_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_key" ON "organizations"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_domain_key" ON "organizations"("domain");
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_custom_domain_key" ON "organizations"("custom_domain");
CREATE INDEX IF NOT EXISTS "organizations_slug_idx" ON "organizations"("slug");
CREATE INDEX IF NOT EXISTS "organizations_status_idx" ON "organizations"("status");
CREATE INDEX IF NOT EXISTS "organizations_plan_idx" ON "organizations"("plan");
CREATE INDEX IF NOT EXISTS "organizations_parent_org_id_idx" ON "organizations"("parent_org_id");

CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "google_id" TEXT,
    "avatar" TEXT,
    "auth_provider" TEXT NOT NULL DEFAULT 'local',
    "email_verified" BOOLEAN DEFAULT false,
    "last_login" TIMESTAMP(3),
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
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users"("google_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_key" ON "users"("referral_code");
CREATE INDEX IF NOT EXISTS "users_organization_id_idx" ON "users"("organization_id");
CREATE INDEX IF NOT EXISTS "users_onboarding_complete_idx" ON "users"("onboarding_complete");
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users"("deleted_at");
