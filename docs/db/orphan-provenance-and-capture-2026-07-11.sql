-- =============================================================================
-- ORPHAN-TABLE PROVENANCE + REVERSIBILITY CAPTURE — 2026-07-11
-- Synthex prod znyjoyjsvjotlzjppzal. Read-only capture; NOTHING here was applied.
-- Spec: docs/specs/spm-parity-remediation-2026-07-11.md (C3 / phase P0 + 5b).
--
-- Purpose: the 5 tables the parity audit called "unknown-origin (no CREATE TABLE
-- anywhere in the repo)" are NOT truly unknown. A supabase_migrations.schema_migrations
-- lookup (2026-07-11) resolved every one to a named SYN ticket applied via
-- `supabase db push`, whose migration FILE was later removed from supabase/migrations/.
-- They are abandoned-feature tables, all 0 rows (re-verified 2026-07-11), RLS-on.
-- This file is the recovery record so a rename/DROP is reversible even though the
-- original migration files are gone.
-- =============================================================================

-- PROVENANCE (supabase CLI ledger, 2026-07-11):
--   ad_accounts                 <- 20260615090040  20260615_ppc_ad_accounts        (PPC ads spike)
--   ad_performance_snapshots    <- 20260615090040  20260615_ppc_ad_accounts        (same migration)
--   client_churn_risk           <- 20260408225959  syn618_client_churn_risk        (SYN-618, churn-scorer)
--   intervention_logs           <- 20260408150300  syn620_intervention_logs_shadow_mode (SYN-620)
--   post_performance_events     <- 20260404152802  syn658_post_performance_events  (SYN-658)
-- Related live intervention tables (KEEP — not orphans): syn614_intervention_config,
--   syn614_health_interventions, syn614_intervention_templates_and_founder_queue.

-- SECURITY NOTE (feeds the rename/drop rationale): client_churn_risk and
-- post_performance_events carry `TO public` policies (client_churn_risk has public
-- INSERT/UPDATE/DELETE) — an anon-reachable write surface on empty tables. Removing
-- them from the public API surface is a net security gain.

-- -----------------------------------------------------------------------------
-- CAPTURED SHAPE (recovery DDL — recreate an object here only if a drop must be undone)
-- -----------------------------------------------------------------------------

-- ad_accounts (0 rows) — policies: authenticated select/insert/update/delete
CREATE TABLE IF NOT EXISTS "ad_accounts" (
  "id" text NOT NULL DEFAULT (gen_random_uuid())::text,
  "organization_id" text NOT NULL,
  "user_id" text NOT NULL,
  "platform" text NOT NULL,
  "external_id" text NOT NULL,
  "name" text NOT NULL,
  "currency_code" text NOT NULL DEFAULT 'AUD'::text,
  "time_zone" text NOT NULL DEFAULT 'Australia/Sydney'::text,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "token_expires_at" timestamptz,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ad_accounts_pkey" PRIMARY KEY ("id")
);
-- indexes: ad_accounts_platform_external_org_unique, ad_accounts_org_platform_idx, ad_accounts_user_id_idx

-- ad_performance_snapshots (0 rows) — policies: authenticated select/insert
CREATE TABLE IF NOT EXISTS "ad_performance_snapshots" (
  "id" text NOT NULL DEFAULT (gen_random_uuid())::text,
  "ad_account_id" text NOT NULL,
  "date_start" date NOT NULL,
  "date_end" date NOT NULL,
  "impressions" integer,
  "clicks" integer,
  "spend" numeric,
  "conversions" numeric,
  "revenue" numeric,
  "roas" numeric,
  "ctr" numeric,
  "cpc" numeric,
  "cpm" numeric,
  "cpa" numeric,
  "campaign_id" text,
  "campaign_name" text,
  "raw_payload" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ad_performance_snapshots_pkey" PRIMARY KEY ("id")
);
-- indexes: ad_perf_snapshots_account_date_campaign_unique, ad_perf_snapshots_account_date_idx

-- client_churn_risk (0 rows) — policies: PUBLIC select/insert/update/delete + service_role ALL  [!! anon write surface]
CREATE TABLE IF NOT EXISTS "client_churn_risk" (
  "id" text NOT NULL DEFAULT (gen_random_uuid())::text,
  "organization_id" text NOT NULL,
  "client_id" text NOT NULL,
  "risk_score" integer NOT NULL DEFAULT 0,
  "risk_tier" text NOT NULL DEFAULT 'low'::text,
  "churn_probability_30d" numeric NOT NULL DEFAULT 0,
  "churn_probability_90d" numeric NOT NULL DEFAULT 0,
  "revenue_at_risk" numeric NOT NULL DEFAULT 0,
  "days_since_last_engagement" integer NOT NULL DEFAULT 0,
  "attribution_event_count_30d" integer NOT NULL DEFAULT 0,
  "attribution_event_count_90d" integer NOT NULL DEFAULT 0,
  "model_inputs" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "client_churn_risk_pkey" PRIMARY KEY ("id")
);
-- indexes: client_churn_risk_organization_id_client_id_key (unique), client_churn_risk_org_idx, client_churn_risk_updated_idx, client_churn_risk_tier_org_idx

-- intervention_logs (0 rows) — policies: service_role_all_il [ALL to service_role]
CREATE TABLE IF NOT EXISTS "intervention_logs" (
  "id" text NOT NULL DEFAULT (gen_random_uuid())::text,
  "client_id" text NOT NULL,
  "logged_at" timestamptz NOT NULL DEFAULT now(),
  "risk_tier" text NOT NULL,
  "intervention_probability" numeric NOT NULL,
  "channel" text NOT NULL,
  "mode" text NOT NULL DEFAULT 'shadow'::text,
  "dimension" text,
  "intervention_tier" integer,
  "template_id" text,
  "health_score" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "intervention_logs_pkey" PRIMARY KEY ("id")
);
-- indexes: idx_intervention_logs_logged_at, idx_intervention_logs_client_id, idx_intervention_logs_risk_tier, idx_intervention_logs_mode

-- post_performance_events (0 rows) — policies: PUBLIC select + service_role ALL(to public)  [!! anon-visible]
CREATE TABLE IF NOT EXISTS "post_performance_events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL,
  "post_id" text NOT NULL,
  "metric" text NOT NULL,
  "value" double precision NOT NULL,
  "client_percentile" integer,
  "event_type" text,
  "notified_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "post_performance_events_pkey" PRIMARY KEY ("id")
);
-- indexes: post_performance_events_client_id_idx, post_performance_events_notified_at_idx

-- =============================================================================
-- REVERSIBLE DEPRECATION (spec 5b — founder gate F1; NOT run here). Rename in-place,
-- keeping RLS/policies (they travel with the table OID); 90-day zero-access burn-in
-- via logs, then a separate founder-gated DROP decision:
--   ALTER TABLE public.ad_accounts              RENAME TO zzz_deprecated_ad_accounts;
--   ALTER TABLE public.ad_performance_snapshots RENAME TO zzz_deprecated_ad_performance_snapshots;
--   ALTER TABLE public.client_churn_risk        RENAME TO zzz_deprecated_client_churn_risk;
--   ALTER TABLE public.intervention_logs        RENAME TO zzz_deprecated_intervention_logs;
--   ALTER TABLE public.post_performance_events  RENAME TO zzz_deprecated_post_performance_events;
-- Reverse at any time with RENAME TO <original>. Recreate from the DDL above if dropped.
-- =============================================================================
