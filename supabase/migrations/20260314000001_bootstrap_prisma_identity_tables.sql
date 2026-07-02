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

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "parent_org_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan" TEXT DEFAULT 'free';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "settings" JSONB;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "first_win_detected" BOOLEAN DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "domain" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "custom_domain" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "abn" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "team_size" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "phone_number" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "ai_generated_data" JSONB;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "social_handles" JSONB;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "logo" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "primary_color" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "favicon" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billing_email" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billing_status" TEXT DEFAULT 'active';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "max_users" INTEGER DEFAULT 5;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "max_posts" INTEGER DEFAULT 500;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "max_campaigns" INTEGER DEFAULT 10;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "streakCount" INTEGER DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "lastApprovedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "longestStreak" INTEGER DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'Australia/Sydney';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "calendar_mode" TEXT DEFAULT 'shadow';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "auto_publish_paused" BOOLEAN DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "live_mode_tier" INTEGER DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "live_mode_activated_at" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "perpetual_reviewer" BOOLEAN DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "shadow_mode_approval_rate" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "consecutive_threshold_passes" INTEGER DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "nudge_dismissed_at" JSONB;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billing_anchor_date" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "invite_prompt_dismissed_at" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "invite_prompt_dismiss_count" INTEGER DEFAULT 0;

UPDATE "organizations"
SET
  "name" = COALESCE("name", "id"),
  "slug" = COALESCE("slug", "id"),
  "plan" = COALESCE("plan", 'free'),
  "status" = COALESCE("status", 'active'),
  "first_win_detected" = COALESCE("first_win_detected", false),
  "created_at" = COALESCE("created_at", CURRENT_TIMESTAMP),
  "updated_at" = COALESCE("updated_at", CURRENT_TIMESTAMP),
  "billing_status" = COALESCE("billing_status", 'active'),
  "max_users" = COALESCE("max_users", 5),
  "max_posts" = COALESCE("max_posts", 500),
  "max_campaigns" = COALESCE("max_campaigns", 10),
  "streakCount" = COALESCE("streakCount", 0),
  "longestStreak" = COALESCE("longestStreak", 0),
  "timezone" = COALESCE("timezone", 'Australia/Sydney'),
  "calendar_mode" = COALESCE("calendar_mode", 'shadow'),
  "auto_publish_paused" = COALESCE("auto_publish_paused", false),
  "live_mode_tier" = COALESCE("live_mode_tier", 0),
  "perpetual_reviewer" = COALESCE("perpetual_reviewer", false),
  "shadow_mode_approval_rate" = COALESCE("shadow_mode_approval_rate", 0),
  "consecutive_threshold_passes" = COALESCE("consecutive_threshold_passes", 0),
  "invite_prompt_dismiss_count" = COALESCE("invite_prompt_dismiss_count", 0);

ALTER TABLE "organizations" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "plan" SET DEFAULT 'free';
ALTER TABLE "organizations" ALTER COLUMN "plan" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "status" SET DEFAULT 'active';
ALTER TABLE "organizations" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "first_win_detected" SET DEFAULT false;
ALTER TABLE "organizations" ALTER COLUMN "first_win_detected" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organizations" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organizations" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "billing_status" SET DEFAULT 'active';
ALTER TABLE "organizations" ALTER COLUMN "billing_status" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "max_users" SET DEFAULT 5;
ALTER TABLE "organizations" ALTER COLUMN "max_users" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "max_posts" SET DEFAULT 500;
ALTER TABLE "organizations" ALTER COLUMN "max_posts" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "max_campaigns" SET DEFAULT 10;
ALTER TABLE "organizations" ALTER COLUMN "max_campaigns" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "streakCount" SET DEFAULT 0;
ALTER TABLE "organizations" ALTER COLUMN "streakCount" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "longestStreak" SET DEFAULT 0;
ALTER TABLE "organizations" ALTER COLUMN "longestStreak" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "timezone" SET DEFAULT 'Australia/Sydney';
ALTER TABLE "organizations" ALTER COLUMN "timezone" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "calendar_mode" SET DEFAULT 'shadow';
ALTER TABLE "organizations" ALTER COLUMN "calendar_mode" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "auto_publish_paused" SET DEFAULT false;
ALTER TABLE "organizations" ALTER COLUMN "auto_publish_paused" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "live_mode_tier" SET DEFAULT 0;
ALTER TABLE "organizations" ALTER COLUMN "live_mode_tier" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "perpetual_reviewer" SET DEFAULT false;
ALTER TABLE "organizations" ALTER COLUMN "perpetual_reviewer" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "shadow_mode_approval_rate" SET DEFAULT 0;
ALTER TABLE "organizations" ALTER COLUMN "shadow_mode_approval_rate" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "consecutive_threshold_passes" SET DEFAULT 0;
ALTER TABLE "organizations" ALTER COLUMN "consecutive_threshold_passes" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "invite_prompt_dismiss_count" SET DEFAULT 0;
ALTER TABLE "organizations" ALTER COLUMN "invite_prompt_dismiss_count" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "organizations"
    ADD CONSTRAINT "organizations_parent_org_id_fkey"
    FOREIGN KEY ("parent_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" TEXT DEFAULT 'local';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "openrouter_api_key" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "anthropic_api_key" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "openai_api_key" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gemini_api_key" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_role" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "social_links" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferences" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_settings" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_code" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_code_expires" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_expires" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verification_code" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verification_expires" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_multi_business_owner" BOOLEAN DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active_organization_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_complete" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_step" INTEGER DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "business_profile_complete" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "api_key_configured" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "api_key_valid" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "api_key_last_validated" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'Australia/Brisbane';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" TEXT;

UPDATE "users"
SET
  "email" = COALESCE("email", "id" || '@synthex.local'),
  "created_at" = COALESCE("created_at", CURRENT_TIMESTAMP),
  "updated_at" = COALESCE("updated_at", CURRENT_TIMESTAMP),
  "auth_provider" = COALESCE("auth_provider", 'local'),
  "is_multi_business_owner" = COALESCE("is_multi_business_owner", true),
  "onboarding_complete" = COALESCE("onboarding_complete", false),
  "onboarding_step" = COALESCE("onboarding_step", 0),
  "business_profile_complete" = COALESCE("business_profile_complete", false),
  "api_key_configured" = COALESCE("api_key_configured", false),
  "api_key_valid" = COALESCE("api_key_valid", false),
  "timezone" = COALESCE("timezone", 'Australia/Brisbane');

ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "auth_provider" SET DEFAULT 'local';
ALTER TABLE "users" ALTER COLUMN "auth_provider" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "is_multi_business_owner" SET DEFAULT true;
ALTER TABLE "users" ALTER COLUMN "is_multi_business_owner" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "onboarding_complete" SET DEFAULT false;
ALTER TABLE "users" ALTER COLUMN "onboarding_complete" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "onboarding_step" SET DEFAULT 0;
ALTER TABLE "users" ALTER COLUMN "onboarding_step" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "business_profile_complete" SET DEFAULT false;
ALTER TABLE "users" ALTER COLUMN "business_profile_complete" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "api_key_configured" SET DEFAULT false;
ALTER TABLE "users" ALTER COLUMN "api_key_configured" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "api_key_valid" SET DEFAULT false;
ALTER TABLE "users" ALTER COLUMN "api_key_valid" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "timezone" SET DEFAULT 'Australia/Brisbane';
ALTER TABLE "users" ALTER COLUMN "timezone" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users"("google_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_key" ON "users"("referral_code");
CREATE INDEX IF NOT EXISTS "users_organization_id_idx" ON "users"("organization_id");
CREATE INDEX IF NOT EXISTS "users_onboarding_complete_idx" ON "users"("onboarding_complete");
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users"("deleted_at");
