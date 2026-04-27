-- AlterTable
ALTER TABLE "public"."testimonial_requests" ALTER COLUMN "token" SET DEFAULT gen_random_uuid()::text;



-- CreateTable
CREATE TABLE "public"."model_metrics" (
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
CREATE TABLE "public"."competitor_keyword_gaps" (
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

-- CreateIndex
CREATE INDEX "model_metrics_provider_week_start_idx" ON "public"."model_metrics"("provider", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "model_metrics_model_id_content_type_week_start_key" ON "public"."model_metrics"("model_id", "content_type", "week_start");

-- CreateIndex
CREATE INDEX "competitor_keyword_gaps_organization_id_snapshot_date_idx" ON "public"."competitor_keyword_gaps"("organization_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "competitor_keyword_gaps_competitor_id_idx" ON "public"."competitor_keyword_gaps"("competitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_keyword_gaps_competitor_id_keyword_snapshot_date_key" ON "public"."competitor_keyword_gaps"("competitor_id", "keyword", "snapshot_date");

-- AddForeignKey
ALTER TABLE "public"."review_requests" ADD CONSTRAINT "review_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_topic_suggestions" ADD CONSTRAINT "content_topic_suggestions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."keyword_targets" ADD CONSTRAINT "keyword_targets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."keyword_rank_snapshots" ADD CONSTRAINT "keyword_rank_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."keyword_rank_snapshots" ADD CONSTRAINT "keyword_rank_snapshots_keyword_target_id_fkey" FOREIGN KEY ("keyword_target_id") REFERENCES "public"."keyword_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."visibility_scores" ADD CONSTRAINT "visibility_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_keyword_gaps" ADD CONSTRAINT "competitor_keyword_gaps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_keyword_gaps" ADD CONSTRAINT "competitor_keyword_gaps_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."tracked_competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."geo_research_reports" ADD CONSTRAINT "geo_research_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BrandIdentity" ADD CONSTRAINT "BrandIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auto_research_runs" ADD CONSTRAINT "auto_research_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trend_insights" ADD CONSTRAINT "trend_insights_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."auto_research_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trend_insights" ADD CONSTRAINT "trend_insights_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gsc_properties" ADD CONSTRAINT "gsc_properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gsc_snapshots" ADD CONSTRAINT "gsc_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gbp_locations" ADD CONSTRAINT "gbp_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gbp_reviews" ADD CONSTRAINT "gbp_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gbp_reviews" ADD CONSTRAINT "gbp_reviews_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."gbp_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gbp_snapshots" ADD CONSTRAINT "gbp_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."autopilot_configs" ADD CONSTRAINT "autopilot_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."autopilot_runs" ADD CONSTRAINT "autopilot_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."testimonial_requests" ADD CONSTRAINT "testimonial_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."testimonials" ADD CONSTRAINT "testimonials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."testimonials" ADD CONSTRAINT "testimonials_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."testimonial_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."generated_content" ADD CONSTRAINT "generated_content_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_assets" ADD CONSTRAINT "video_assets_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_engagements" ADD CONSTRAINT "social_engagements_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_campaigns" ADD CONSTRAINT "email_campaigns_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."platform_analytics" ADD CONSTRAINT "platform_analytics_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."advisory_cases" ADD CONSTRAINT "advisory_cases_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."advisory_cases" ADD CONSTRAINT "advisory_cases_approval_queue_id_fkey" FOREIGN KEY ("approval_queue_id") REFERENCES "public"."approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."experiments" ADD CONSTRAINT "experiments_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."experiment_results" ADD CONSTRAINT "experiment_results_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credentials_vault" ADD CONSTRAINT "credentials_vault_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nexus_databases" ADD CONSTRAINT "nexus_databases_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."connected_projects" ADD CONSTRAINT "connected_projects_founder_id_fkey" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."marketplace_channel_listings" ADD CONSTRAINT "marketplace_channel_listings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."marketplace_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

