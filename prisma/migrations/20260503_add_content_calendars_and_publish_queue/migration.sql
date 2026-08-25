-- Migration: Add content_calendars + publish_queue (SYN-521 / SYN-523).
-- Source of truth: prisma/schema.prisma models ContentCalendar (line 5403)
-- and PublishQueueItem (line 5434).
--
-- Why: production logs are spamming
--   ERROR: relation "public.publish_queue" does not exist
-- on every dashboard load because the auto-publish worker queries this on
-- a poll. content_calendars is its parent (FK from publish_queue → content_calendars)
-- so both must be created together in this order.
--
-- Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260503_add_content_calendars_and_publish_queue/migration.sql \
--     --url "$DIRECT_URL"

-- ── 1. content_calendars ───────────────────────────────────────────────────
-- One AI-generated content calendar per organisation per week.
-- Slots are JSONB (CalendarSlot[] from lib/calendar/types.ts).
-- status flow: draft → approved → published.
CREATE TABLE IF NOT EXISTS public.content_calendars (
  id              TEXT        PRIMARY KEY,
  organization_id TEXT        NOT NULL,
  week_start      DATE        NOT NULL,
  week_end        DATE        NOT NULL,
  slots           JSONB       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft',
  signals_version TEXT        NOT NULL DEFAULT '1.0',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_calendars_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT content_calendars_unique_org_week UNIQUE (organization_id, week_start)
);

CREATE INDEX IF NOT EXISTS content_calendars_org_week_idx
  ON public.content_calendars (organization_id, week_start DESC);

-- ── 2. publish_queue ───────────────────────────────────────────────────────
-- One row per calendar slot awaiting (or having completed) auto-publish.
-- Retry policy: 12 attempts × 4-hour intervals = 48 hours, then status=held.
CREATE TABLE IF NOT EXISTS public.publish_queue (
  id              TEXT        PRIMARY KEY,
  organization_id TEXT        NOT NULL,
  calendar_id     TEXT        NOT NULL,
  slot_id         TEXT        NOT NULL,
  platform        TEXT        NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  attempts        INTEGER     NOT NULL DEFAULT 0,
  next_retry_at   TIMESTAMPTZ,
  last_error      TEXT,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT publish_queue_organization_id_fkey FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT publish_queue_calendar_id_fkey FOREIGN KEY (calendar_id)
    REFERENCES public.content_calendars(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS publish_queue_status_scheduled_idx
  ON public.publish_queue (status, scheduled_at);
CREATE INDEX IF NOT EXISTS publish_queue_org_status_idx
  ON public.publish_queue (organization_id, status);
CREATE INDEX IF NOT EXISTS publish_queue_calendar_idx
  ON public.publish_queue (calendar_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Service role bypasses RLS, so the publish worker (uses SUPABASE_SERVICE_ROLE_KEY)
-- keeps working. Authenticated users see only rows for orgs they belong to —
-- enforced via business_ownerships.
ALTER TABLE public.content_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_queue     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_calendars_org_member_read"  ON public.content_calendars;
DROP POLICY IF EXISTS "content_calendars_org_member_write" ON public.content_calendars;
CREATE POLICY "content_calendars_org_member_read" ON public.content_calendars
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.business_ownerships
       WHERE owner_id = auth.uid()::text AND is_active = true
    )
  );
CREATE POLICY "content_calendars_org_member_write" ON public.content_calendars
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.business_ownerships
       WHERE owner_id = auth.uid()::text AND is_active = true
    )
  ) WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.business_ownerships
       WHERE owner_id = auth.uid()::text AND is_active = true
    )
  );

DROP POLICY IF EXISTS "publish_queue_org_member_read" ON public.publish_queue;
CREATE POLICY "publish_queue_org_member_read" ON public.publish_queue
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.business_ownerships
       WHERE owner_id = auth.uid()::text AND is_active = true
    )
  );
-- publish_queue writes are service-role only (the publish worker), no INSERT/UPDATE policy.

-- ── Updated_at triggers (reuse existing helper from earlier migration) ─────
DROP TRIGGER IF EXISTS content_calendars_set_updated_at ON public.content_calendars;
DROP TRIGGER IF EXISTS publish_queue_set_updated_at     ON public.publish_queue;

CREATE TRIGGER content_calendars_set_updated_at BEFORE UPDATE ON public.content_calendars
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
CREATE TRIGGER publish_queue_set_updated_at     BEFORE UPDATE ON public.publish_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- ── Verification ───────────────────────────────────────────────────────────
-- After applying, both should return true:
--   SELECT
--     EXISTS (SELECT 1 FROM information_schema.tables
--              WHERE table_schema='public' AND table_name='content_calendars') AS cc,
--     EXISTS (SELECT 1 FROM information_schema.tables
--              WHERE table_schema='public' AND table_name='publish_queue') AS pq;
