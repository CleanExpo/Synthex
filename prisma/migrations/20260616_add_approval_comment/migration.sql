-- Migration: Approval threaded comments (backlog #12 — approvals collaboration).
--
-- Adds ONE table that records first-class threaded comments on an ApprovalRequest,
-- replacing today's JSON-embedded comments on approval_requests.steps. Each row
-- carries the @-mention targets parsed from the body so the comment route can fire
-- a notification to each mentioned user via the existing notifications mechanism.
--
-- Org-scoping is enforced at the query layer through the parent approval (the route
-- checks approval.organization_id === caller's org OR approval.submitted_by ===
-- caller), so this table has NO denormalised organization_id column and NO DB FK to
-- organizations (which carries a known TEXT/UUID FK-mismatch hazard — see
-- .claude/rules/database/supabase-migrations.md and the 20260615_add_follower_snapshot
-- migration, which skips that FK for the same reason).
--
-- The two FKs it DOES carry are unambiguous TEXT→TEXT references and match the
-- pattern of the marketing_agency_* core tables (20260524): both approval_requests.id
-- and users.id are TEXT (cuid) primary keys.
--
-- Additive only: a single CREATE TABLE + two indexes + RLS enablement and an
-- org-isolation policy mirroring the marketing_agency_* tables (20260524). No DROP,
-- no RENAME, no column type change.
--
-- NOT YET APPLIED to production. The orchestrator applies it out-of-band to
-- znyjoyjsvjotlzjppzal via the Supabase MCP apply_migration tool ON MERGE.
--
-- To apply elsewhere with the Prisma 7 CLI (.env is dotenvx-encrypted, so run through
-- dotenvx; db execute no longer takes --url — it reads DIRECT_URL from prisma.config.ts):
--   npx dotenvx run -- npx prisma@7.7.0 db execute \
--     --file prisma/migrations/20260616_add_approval_comment/migration.sql
-- Additive + IF NOT EXISTS — safe to re-run.

CREATE TABLE IF NOT EXISTS public.approval_comments (
  "id"                  TEXT          NOT NULL,
  "approval_request_id" TEXT          NOT NULL,
  "author_id"           TEXT          NOT NULL,
  "body"                TEXT          NOT NULL,
  "mentions"            TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at"          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approval_comments_approval_request_id_fkey" FOREIGN KEY ("approval_request_id")
    REFERENCES public.approval_requests("id") ON DELETE CASCADE,
  CONSTRAINT "approval_comments_author_id_fkey" FOREIGN KEY ("author_id")
    REFERENCES public.users("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "approval_comments_approval_request_id_created_at_idx"
  ON public.approval_comments ("approval_request_id", "created_at");

CREATE INDEX IF NOT EXISTS "approval_comments_author_id_idx"
  ON public.approval_comments ("author_id");

-- RLS: a comment is visible to anyone who can see its parent approval. We delegate
-- the org-isolation check to approval_requests rather than re-deriving org membership
-- here (the route also enforces it). Enable RLS and add a permissive-to-parent policy.
ALTER TABLE public.approval_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'approval_comments'
      AND policyname = 'approval_comments_parent_visibility'
  ) THEN
    CREATE POLICY approval_comments_parent_visibility ON public.approval_comments
      USING (
        approval_request_id IN (SELECT id FROM public.approval_requests)
      )
      WITH CHECK (
        approval_request_id IN (SELECT id FROM public.approval_requests)
      );
  END IF;
END $$;
