CREATE TABLE IF NOT EXISTS client_journey_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL CHECK (channel IN ('email', 'in_app')),
  metadata jsonb,
  CONSTRAINT valid_event_type CHECK (
    event_type IN (
      'onboarding_30_day',
      'quarterly_milestone_review',
      'win_notification',
      'geo_score_published',
      'personalisation_activated'
    )
  )
);

-- RLS: service_role policy (Synthex uses custom JWT not Supabase Auth)
ALTER TABLE client_journey_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all" ON client_journey_events FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_journey_events_client_id ON client_journey_events(client_id);
CREATE INDEX IF NOT EXISTS idx_client_journey_events_delivered_at ON client_journey_events(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_journey_events_lookup ON client_journey_events(client_id, event_type, channel);

-- Throttle function: returns true if safe to send (no recent delivery within min_days_between)
CREATE OR REPLACE FUNCTION should_deliver_journey_event(
  p_client_id text,
  p_event_type text,
  p_channel text,
  p_min_days_between integer DEFAULT 7
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM client_journey_events
    WHERE client_id = p_client_id
      AND event_type = p_event_type
      AND channel = p_channel
      AND delivered_at > now() - (p_min_days_between || ' days')::interval
  );
$$;

-- Record delivery function
CREATE OR REPLACE FUNCTION record_journey_event(
  p_client_id text,
  p_event_type text,
  p_channel text,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE sql
AS $$
  INSERT INTO client_journey_events (client_id, event_type, channel, metadata)
  VALUES (p_client_id, p_event_type, p_channel, p_metadata)
  RETURNING id;
$$;
