-- Migration: SYN-631 Content Learning Loop
-- Creates industry_baselines and content_performance_profiles tables.
-- Apply via: npx prisma db execute --file prisma/migration-2026-04-03-syn631.sql --url "$DIRECT_URL"
--
-- If FK constraints fail (TEXT vs UUID mismatch on organizations.id), run:
--   grep -v "ADD CONSTRAINT.*FOREIGN KEY" prisma/migration-2026-04-03-syn631.sql \
--     | grep -v "^-- AddForeignKey" > prisma/migration-2026-04-03-syn631-no-fk.sql
--   npx prisma db execute --file prisma/migration-2026-04-03-syn631-no-fk.sql --url "$DIRECT_URL"

-- Step 1: industry_baselines (must exist before content_performance_profiles FK)
CREATE TABLE IF NOT EXISTS "industry_baselines" (
    "id"                    TEXT             NOT NULL,
    "industry"              TEXT             NOT NULL,
    "sample_size"           INTEGER          NOT NULL DEFAULT 0,
    "top_topics"            JSONB            NOT NULL DEFAULT '[]',
    "optimal_times"         JSONB            NOT NULL DEFAULT '{}',
    "winning_hashtags"      JSONB            NOT NULL DEFAULT '[]',
    "content_format_scores" JSONB            NOT NULL DEFAULT '{}',
    "updated_at"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "industry_baselines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "industry_baselines_industry_key"
    ON "industry_baselines"("industry");

CREATE INDEX IF NOT EXISTS "industry_baselines_industry_idx"
    ON "industry_baselines"("industry");

-- Step 2: content_performance_profiles
CREATE TABLE IF NOT EXISTS "content_performance_profiles" (
    "id"                    TEXT             NOT NULL,
    "organization_id"       TEXT             NOT NULL,
    "post_count"            INTEGER          NOT NULL DEFAULT 0,
    "confidence_level"      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "top_topics"            JSONB            NOT NULL DEFAULT '[]',
    "optimal_times"         JSONB            NOT NULL DEFAULT '{}',
    "winning_hashtags"      JSONB            NOT NULL DEFAULT '[]',
    "content_format_scores" JSONB            NOT NULL DEFAULT '{}',
    "industry_baseline_id"  TEXT,
    "updated_at"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_performance_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_performance_profiles_organization_id_key"
    ON "content_performance_profiles"("organization_id");

CREATE INDEX IF NOT EXISTS "content_performance_profiles_organization_id_idx"
    ON "content_performance_profiles"("organization_id");

CREATE INDEX IF NOT EXISTS "content_performance_profiles_updated_at_idx"
    ON "content_performance_profiles"("updated_at");

-- AddForeignKey: content_performance_profiles -> organizations
ALTER TABLE "content_performance_profiles"
    ADD CONSTRAINT "content_performance_profiles_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: content_performance_profiles -> industry_baselines
ALTER TABLE "content_performance_profiles"
    ADD CONSTRAINT "content_performance_profiles_industry_baseline_id_fkey"
    FOREIGN KEY ("industry_baseline_id")
    REFERENCES "industry_baselines"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
