-- Migration: SYN-MCP-001 — separate claim approval from evidence verification.
--
-- Adds an independent human-approval axis to marketing_agency_claims:
--   approval_status  TEXT NOT NULL DEFAULT 'pending'   ('pending'|'approved'|'rejected')
--   approved_by_id   TEXT NULL                          (userId of the approver)
--   approved_at      TIMESTAMPTZ NULL
--
-- evidence_status becomes derived-only (written solely by
-- lib/marketing-agency/evidence-policy.ts). The approve/reject verbs write
-- ONLY approval_status (+ approver provenance); they never touch
-- evidence_status directly.
--
-- RLS NOTE (deliberate — no policy DDL here): marketing_agency_claims already
-- has ROW LEVEL SECURITY enabled with the org-isolation policy
-- marketing_agency_claims_org_isolation (see
-- 20260524_add_marketing_agency_core_tables/migration.sql). RLS is row-level,
-- so the existing policy automatically covers these additive columns; adding
-- new/duplicate policies would be create-only-violating churn.
--
-- BACKFILL (idempotent — safe to re-run):
--   * Legacy evidence_status='verified' rows are GRANDFATHERED: they gain
--     approval_status='approved' + metadata.migratedLegacyVerified=true and
--     their evidence_status is NOT re-derived (the v1 policy would call a
--     source-less row 'blocked'; SYN-MCP-006 re-scores them). approved_by_id /
--     approved_at stay NULL — no fabricated approver; the metadata flag is the
--     sole provenance marker.
--   * Legacy evidence_status='disputed' rows (the old reject verb wrote this)
--     → approval_status='rejected' + metadata.migratedLegacyDisputed=true;
--     evidence_status untouched.
--   * 'blocked' / 'pending_evidence' rows are untouched (stay 'pending').
--
-- FOUNDER APPLIES MANUALLY (SYN-1085) — never run by CI or agents. Apply with:
--   npx prisma db execute \
--     --file prisma/migrations/20260710100000_add_claim_approval_status/migration.sql \
--     --url "$DIRECT_URL"
-- or
--   supabase db query --linked -f prisma/migrations/20260710100000_add_claim_approval_status/migration.sql

-- ============================================================
-- Columns (create-only, idempotent)
-- ============================================================
ALTER TABLE public.marketing_agency_claims
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.marketing_agency_claims
  ADD COLUMN IF NOT EXISTS approved_by_id TEXT;

ALTER TABLE public.marketing_agency_claims
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS marketing_agency_claims_org_approval_status_idx
  ON public.marketing_agency_claims (organization_id, approval_status);

-- ============================================================
-- Backfill (idempotent: the approval_status='pending' guard makes
-- every re-run a no-op)
-- ============================================================
UPDATE public.marketing_agency_claims
   SET approval_status = 'approved',
       metadata        = COALESCE(metadata, '{}'::jsonb)
                         || '{"migratedLegacyVerified": true}'::jsonb
 WHERE evidence_status  = 'verified'
   AND approval_status  = 'pending';

UPDATE public.marketing_agency_claims
   SET approval_status = 'rejected',
       metadata        = COALESCE(metadata, '{}'::jsonb)
                         || '{"migratedLegacyDisputed": true}'::jsonb
 WHERE evidence_status  = 'disputed'
   AND approval_status  = 'pending';
