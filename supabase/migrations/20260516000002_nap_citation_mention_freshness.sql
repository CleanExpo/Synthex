-- =============================================================================
-- SYN-824 Phase A baseline tables for VG-AEO-1 (NAP) + VG-AEO-2 (freshness).
-- Spec: docs/aeo/brand-voice-enforce-spec-2026-05-16.md §3 R6/R7.
-- Mandate: 27e98e38-a6fd-4269-b223-db00f5e0e629.
--
-- These tables back the lookups that brand-voice-enforce R6 + R7 consume.
-- Until A4/A5 (Whitespark / BrightLocal / mention-poller) ingest data, the
-- gate skips-with-evidence (verified by lib/aeo tests).
-- =============================================================================

-- 1. nap_citation — canonical NAP per brand per directory.
--    Used by R6 to verify candidate SMS / pages cite the same NAP as
--    the brand's verified directory entries.

CREATE TABLE IF NOT EXISTS public.nap_citation (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand           TEXT NOT NULL,
    directory       TEXT NOT NULL,
    business_name   TEXT NOT NULL,
    address         TEXT,
    phone           TEXT,
    source_url      TEXT NOT NULL,
    is_canonical    BOOLEAN NOT NULL DEFAULT FALSE,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT nap_citation_directory_check
        CHECK (directory IN ('yelp', 'facebook', 'angie', 'foursquare', 'bing-places', 'gbp', 'app-store', 'manual'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nap_citation_brand_directory
    ON public.nap_citation(brand, directory);
CREATE INDEX IF NOT EXISTS idx_nap_citation_canonical
    ON public.nap_citation(brand) WHERE is_canonical IS TRUE;

ALTER TABLE public.nap_citation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nap_citation_admin_select ON public.nap_citation;
CREATE POLICY nap_citation_admin_select
    ON public.nap_citation FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()::text AND role = 'admin'));
DROP POLICY IF EXISTS nap_citation_service_role_all ON public.nap_citation;
CREATE POLICY nap_citation_service_role_all
    ON public.nap_citation FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

COMMENT ON TABLE public.nap_citation IS
    'SYN-824 A4 — canonical NAP per brand per directory. Read by lib/aeo/rules.ts R6 via lookupCanonicalNap dep.';

-- 2. mention_freshness — last-seen timestamp per mention, used by R7 to
--    reject outreach drafts whose source mention is older than 24h.

CREATE TABLE IF NOT EXISTS public.mention_freshness (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mention_id      TEXT NOT NULL UNIQUE,
    brand           TEXT NOT NULL,
    source          TEXT NOT NULL,
    source_url      TEXT NOT NULL,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    title           TEXT,
    snippet         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT mention_freshness_source_check
        CHECK (source IN ('google-news', 'bing-news', 'reddit', 'trade-press', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_mention_freshness_brand_last_seen
    ON public.mention_freshness(brand, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_mention_freshness_source
    ON public.mention_freshness(source, last_seen_at DESC);

ALTER TABLE public.mention_freshness ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mention_freshness_admin_select ON public.mention_freshness;
CREATE POLICY mention_freshness_admin_select
    ON public.mention_freshness FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()::text AND role = 'admin'));
DROP POLICY IF EXISTS mention_freshness_service_role_all ON public.mention_freshness;
CREATE POLICY mention_freshness_service_role_all
    ON public.mention_freshness FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

COMMENT ON TABLE public.mention_freshness IS
    'SYN-824 A5 — non-directory mention baseline. Read by lib/aeo/rules.ts R7 via lookupMentionFreshness dep.';
