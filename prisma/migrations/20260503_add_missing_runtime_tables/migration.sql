-- Migration: Add 7 runtime tables missing from production.
-- Generated 2026-05-03 in response to OAuth failure (oauth_pkce_states missing
-- caused PKCE state to fall through to in-memory storage and be lost between
-- Vercel lambdas) and 404s on /rest/v1/{profiles,auth_events,user_settings,
-- analytics_summary,analytics_metrics,anomaly_detection_configs}.
--
-- All tables are additive. FKs target public.users(id) — never auth.users (P4002).
-- public.users.id is TEXT, so all user_id FKs are TEXT.

-- ============================================================================
-- 1. oauth_pkce_states — PKCE state for custom OAuth flow (CRITICAL)
-- Matches Prisma model OAuthPKCEState in prisma/schema.prisma
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.oauth_pkce_states (
  id              TEXT        PRIMARY KEY,
  state           TEXT        NOT NULL UNIQUE,
  code_verifier   TEXT        NOT NULL,
  provider        TEXT        NOT NULL,
  redirect_uri    TEXT        NOT NULL,
  link_to_user_id TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_pkce_states_expires_at_idx
  ON public.oauth_pkce_states (expires_at);

-- ============================================================================
-- 2. profiles — onboarding flag + display info, written by OAuth callback
-- Columns from app/api/auth/oauth/google/callback/route.ts:285 ensureProfileExists
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                    TEXT        PRIMARY KEY,
  email                 TEXT        NOT NULL,
  name                  TEXT,
  avatar_url            TEXT,
  onboarding_completed  BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id)
    REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);

-- ============================================================================
-- 3. auth_events — audit log written by lib/auth/monitoring.ts
-- Columns from lib/auth/monitoring.ts:269 insert payload
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.auth_events (
  id           BIGSERIAL   PRIMARY KEY,
  type         TEXT        NOT NULL,
  method       TEXT,
  provider     TEXT,
  email        TEXT,
  error        TEXT,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  environment  TEXT,
  session_id   TEXT,
  ip_address   TEXT,
  user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS auth_events_email_timestamp_idx
  ON public.auth_events (email, timestamp DESC);
CREATE INDEX IF NOT EXISTS auth_events_type_timestamp_idx
  ON public.auth_events (type, timestamp DESC);

-- ============================================================================
-- 4. user_settings — per-user app settings (timezone, active workspace, etc.)
-- Columns from lib/services/client-management.ts:619,658 + content-engine.ts:831
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id            TEXT        PRIMARY KEY,
  timezone           TEXT,
  active_client_id   TEXT,
  preferences        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 5. analytics_summary — daily per-platform aggregates
-- Columns from competitive-intel.ts:863 + content-engine.ts:811
-- Numeric metrics use NUMERIC for divisions to work; growth/rate columns
-- accommodate negative values. JSONB `extras` for unknown fields.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.analytics_summary (
  id                  BIGSERIAL   PRIMARY KEY,
  user_id             TEXT        NOT NULL,
  platform            TEXT        NOT NULL,
  date                DATE        NOT NULL,
  followers           NUMERIC     DEFAULT 0,
  followers_growth    NUMERIC     DEFAULT 0,
  impressions         NUMERIC     DEFAULT 0,
  reach               NUMERIC     DEFAULT 0,
  engagement_rate     NUMERIC     DEFAULT 0,
  clicks              NUMERIC     DEFAULT 0,
  conversions         NUMERIC     DEFAULT 0,
  shares              NUMERIC     DEFAULT 0,
  saves               NUMERIC     DEFAULT 0,
  comments            NUMERIC     DEFAULT 0,
  likes               NUMERIC     DEFAULT 0,
  video_views         NUMERIC     DEFAULT 0,
  watch_time          NUMERIC     DEFAULT 0,
  sentiment_score     NUMERIC,
  response_time       NUMERIC,
  unfollows           NUMERIC     DEFAULT 0,
  extras              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_summary_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT analytics_summary_unique_user_platform_date
    UNIQUE (user_id, platform, date)
);

CREATE INDEX IF NOT EXISTS analytics_summary_user_date_idx
  ON public.analytics_summary (user_id, date DESC);
CREATE INDEX IF NOT EXISTS analytics_summary_user_platform_date_idx
  ON public.analytics_summary (user_id, platform, date DESC);

-- ============================================================================
-- 6. analytics_metrics — time-series metric points (anomaly detector input)
-- Columns from lib/analytics/anomaly-detector.ts:683
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.analytics_metrics (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  metric_type  TEXT        NOT NULL,
  value        NUMERIC     NOT NULL,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  platform     TEXT,
  account_id   TEXT,
  metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT analytics_metrics_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS analytics_metrics_user_metric_recorded_idx
  ON public.analytics_metrics (user_id, metric_type, recorded_at);
CREATE INDEX IF NOT EXISTS analytics_metrics_user_platform_recorded_idx
  ON public.analytics_metrics (user_id, platform, recorded_at);

-- ============================================================================
-- 7. anomaly_detection_configs — per-user, per-metric detector config
-- Columns from lib/analytics/anomaly-detector.ts:642 (read shape)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.anomaly_detection_configs (
  id                BIGSERIAL   PRIMARY KEY,
  user_id           TEXT        NOT NULL,
  metric_type       TEXT        NOT NULL,
  enabled           BOOLEAN     NOT NULL DEFAULT true,
  sensitivity       TEXT        NOT NULL DEFAULT 'medium',
  min_data_points   INTEGER     NOT NULL DEFAULT 30,
  lookback_window   INTEGER     NOT NULL DEFAULT 30,
  thresholds        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  alert_channels    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT anomaly_detection_configs_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT anomaly_detection_configs_unique_user_metric
    UNIQUE (user_id, metric_type)
);

-- ============================================================================
-- RLS — enable on all 7 tables. Service role bypasses RLS, so the OAuth
-- callback (which uses SUPABASE_SERVICE_ROLE_KEY) keeps working. We add a
-- permissive "owner reads/writes own row" policy for non-service-role access.
-- ============================================================================
ALTER TABLE public.oauth_pkce_states          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_events                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_summary          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_metrics          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_detection_configs  ENABLE ROW LEVEL SECURITY;

-- oauth_pkce_states: service role only (no anon/authenticated access).
-- profiles: a user can read/update their own row.
DROP POLICY IF EXISTS "profiles_self_read"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_read"   ON public.profiles
  FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid()::text = id);

-- user_settings: a user can read/upsert their own row.
DROP POLICY IF EXISTS "user_settings_self_all" ON public.user_settings;
CREATE POLICY "user_settings_self_all" ON public.user_settings
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- analytics_summary / analytics_metrics / anomaly_detection_configs:
-- a user can read their own rows (service role inserts).
DROP POLICY IF EXISTS "analytics_summary_self_read"        ON public.analytics_summary;
DROP POLICY IF EXISTS "analytics_metrics_self_read"        ON public.analytics_metrics;
DROP POLICY IF EXISTS "anomaly_detection_configs_self_all" ON public.anomaly_detection_configs;
CREATE POLICY "analytics_summary_self_read" ON public.analytics_summary
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "analytics_metrics_self_read" ON public.analytics_metrics
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "anomaly_detection_configs_self_all" ON public.anomaly_detection_configs
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- auth_events / oauth_pkce_states: no public policies — service role only.

-- ============================================================================
-- Updated_at triggers (idempotent helper)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at        ON public.profiles;
DROP TRIGGER IF EXISTS user_settings_set_updated_at   ON public.user_settings;
DROP TRIGGER IF EXISTS anomaly_configs_set_updated_at ON public.anomaly_detection_configs;

CREATE TRIGGER profiles_set_updated_at        BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
CREATE TRIGGER user_settings_set_updated_at   BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
CREATE TRIGGER anomaly_configs_set_updated_at BEFORE UPDATE ON public.anomaly_detection_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
