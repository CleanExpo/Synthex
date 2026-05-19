-- SYN-674: effect_reports table
-- Quarterly AI-generated client synthesis documents.
-- Applied to production on 2026-04-05.

CREATE TABLE IF NOT EXISTS public.effect_reports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID        NOT NULL,
  period_start    DATE        NOT NULL,
  period_end      DATE        NOT NULL,
  report_data     JSONB       NOT NULL DEFAULT '{}',
  png_url         TEXT,
  pdf_url         TEXT,
  pdf_generated_at TIMESTAMPTZ,
  email_sent_at   TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Efficient lookups by client + period
CREATE INDEX IF NOT EXISTS idx_effect_reports_client_period
  ON public.effect_reports (client_id, period_start DESC);

-- RLS: clients can only read their own reports
ALTER TABLE public.effect_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'effect_reports' AND policyname = 'client_read_own_effect_reports'
  ) THEN
    CREATE POLICY client_read_own_effect_reports
      ON public.effect_reports
      FOR SELECT
      USING (client_id = auth.uid());
  END IF;
END$$;

-- Service role can INSERT and UPDATE (generation pipeline)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'effect_reports' AND policyname = 'service_role_manage_effect_reports'
  ) THEN
    CREATE POLICY service_role_manage_effect_reports
      ON public.effect_reports
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END$$;
