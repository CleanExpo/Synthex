-- Migration: Add scheduled_posts.
-- Not in prisma/schema.prisma — accessed only via Supabase REST client from
-- the social post handlers (facebook/twitter/instagram/linkedin/tiktok/
-- threads/reddit/pinterest) and from app/api/optimize/auto-schedule/route.ts.
--
-- Why: production logs are spamming
--   ERROR: relation "public.scheduled_posts" does not exist
-- on every social post attempt and every optimisation run. This is what's
-- breaking the post-scheduler and probably part of why GA4-adjacent flows
-- look "stuck" — anything that touches the scheduling pipeline 500s.
--
-- Columns derived from the actual insert/update payloads in the codebase:
--   - app/api/social/facebook/post/route.ts:264   (full payload)
--   - app/api/social/twitter/post/route.ts:114    (media_ids variant)
--   - app/api/optimize/auto-schedule/route.ts:421 (update path)
--
-- Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260503_add_scheduled_posts/migration.sql \
--     --url "$DIRECT_URL"

CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id                     TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id                TEXT        NOT NULL,
  platform               TEXT        NOT NULL,
  content                TEXT,
  -- Platform-side IDs (filled in after the actual post lands)
  post_id                TEXT,
  link_url               TEXT,
  media_urls             JSONB       NOT NULL DEFAULT '[]'::jsonb,
  media_ids              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  scheduled_time         TIMESTAMPTZ,
  status                 TEXT        NOT NULL DEFAULT 'pending',
  metadata               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  optimization_metadata  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduled_posts_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE
);

-- Hot paths from the handlers:
--   filter by (user_id, status='pending', scheduled_time <= NOW())
--   filter by (user_id, platform)
CREATE INDEX IF NOT EXISTS scheduled_posts_user_status_time_idx
  ON public.scheduled_posts (user_id, status, scheduled_time);
CREATE INDEX IF NOT EXISTS scheduled_posts_user_platform_idx
  ON public.scheduled_posts (user_id, platform);
CREATE INDEX IF NOT EXISTS scheduled_posts_status_time_idx
  ON public.scheduled_posts (status, scheduled_time)
  WHERE status IN ('pending', 'scheduled');

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Service role (the publish worker) bypasses RLS. Authenticated users
-- read/write only their own rows.
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_posts_self_all" ON public.scheduled_posts;
CREATE POLICY "scheduled_posts_self_all" ON public.scheduled_posts
  FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- ── Updated_at trigger (reuses helper from earlier migration) ─────────────
DROP TRIGGER IF EXISTS scheduled_posts_set_updated_at ON public.scheduled_posts;
CREATE TRIGGER scheduled_posts_set_updated_at BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- ── Verification ──────────────────────────────────────────────────────────
-- After applying, should return true:
--   SELECT EXISTS (
--     SELECT 1 FROM information_schema.tables
--      WHERE table_schema='public' AND table_name='scheduled_posts'
--   );
