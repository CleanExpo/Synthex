-- Migration: Add anomalies.
-- Not in prisma/schema.prisma — accessed only via Supabase REST client from
-- lib/analytics/anomaly-detector.ts (insert / cooldown-check / list /
-- acknowledge / resolve).
--
-- Why: production logs show repeated
--   ERROR: relation "public.anomalies" does not exist
-- on every analytics page that runs anomaly detection. The detector pairs
-- with anomaly_detection_configs (already created earlier today) and
-- analytics_metrics (already created) — anomalies is the missing third leg.
--
-- Columns derived from the actual code paths:
--   - lib/analytics/anomaly-detector.ts:787   (insert payload — full shape)
--   - lib/analytics/anomaly-detector.ts:768   (cooldown SELECT)
--   - lib/analytics/anomaly-detector.ts:994   (acknowledge UPDATE)
--   - lib/analytics/anomaly-detector.ts:1021  (resolve UPDATE)
--
-- Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260503_add_anomalies/migration.sql \
--     --url "$DIRECT_URL"

CREATE TABLE IF NOT EXISTS public.anomalies (
  id                 TEXT        PRIMARY KEY,
  user_id            TEXT        NOT NULL,
  account_id         TEXT,
  platform           TEXT,
  metric_type        TEXT        NOT NULL,
  anomaly_type       TEXT        NOT NULL,
  severity           TEXT        NOT NULL,
  -- Detected vs. expected metric values + how far off
  value              NUMERIC     NOT NULL,
  expected_value     NUMERIC,
  deviation          NUMERIC,
  deviation_percent  NUMERIC,
  -- timestamp = when the metric data point happened
  -- detected_at = when the detector flagged it
  timestamp          TIMESTAMPTZ NOT NULL,
  detected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Diagnostic payloads (free-form, JSONB so the detector can expand them
  -- without further migrations)
  context            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  possible_causes    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  recommendations    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- Workflow state
  acknowledged       BOOLEAN     NOT NULL DEFAULT false,
  resolved_at        TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT anomalies_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE
);

-- Hot paths from anomaly-detector.ts:
--   cooldown check: (user_id, metric_type, detected_at >= cooldownStart)
--   list / acknowledge / resolve: (id, user_id)
--   inbox view: (user_id, acknowledged=false, detected_at desc)
CREATE INDEX IF NOT EXISTS anomalies_user_metric_detected_idx
  ON public.anomalies (user_id, metric_type, detected_at DESC);
CREATE INDEX IF NOT EXISTS anomalies_user_unacked_detected_idx
  ON public.anomalies (user_id, detected_at DESC)
  WHERE acknowledged = false;
CREATE INDEX IF NOT EXISTS anomalies_user_platform_detected_idx
  ON public.anomalies (user_id, platform, detected_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Service role (the detector worker) bypasses RLS to insert.
-- Authenticated users can read / acknowledge / resolve only their own rows.
ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anomalies_self_read"   ON public.anomalies;
DROP POLICY IF EXISTS "anomalies_self_update" ON public.anomalies;
CREATE POLICY "anomalies_self_read" ON public.anomalies
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "anomalies_self_update" ON public.anomalies
  FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
-- INSERTs are service-role only (the detector). No public INSERT policy.

-- ── Updated_at trigger (reuses helper) ────────────────────────────────────
DROP TRIGGER IF EXISTS anomalies_set_updated_at ON public.anomalies;
CREATE TRIGGER anomalies_set_updated_at BEFORE UPDATE ON public.anomalies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- ── Verification ──────────────────────────────────────────────────────────
-- After applying, should return true:
--   SELECT EXISTS (
--     SELECT 1 FROM information_schema.tables
--      WHERE table_schema='public' AND table_name='anomalies'
--   );
