-- CreateTable: industry_templates (SYN-408 Industry Modes)
-- Stores content scenario templates grouped by industry vertical.

CREATE TABLE IF NOT EXISTS "industry_templates" (
    "id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "scenario_name" TEXT NOT NULL,
    "prompt_template" TEXT NOT NULL,
    "example_output" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "industry_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "industry_templates_industry_idx" ON "industry_templates"("industry");

-- CreateTable: onboarding_profiles (SYN-408 Voice Onboarding)
-- Captures answers from the 5-question onboarding wizard per organisation.

CREATE TABLE IF NOT EXISTS "onboarding_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "target_customer" TEXT NOT NULL,
    "differentiator" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "first_post_topic" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_profiles_organization_id_key" ON "onboarding_profiles"("organization_id");
CREATE INDEX IF NOT EXISTS "onboarding_profiles_organization_id_idx" ON "onboarding_profiles"("organization_id");
CREATE INDEX IF NOT EXISTS "onboarding_profiles_user_id_idx" ON "onboarding_profiles"("user_id");
