-- SYN-598: team_members table — RBAC foundation (Owner + Collaborator)
-- References public.users (NOT auth.users) per project convention.

CREATE TABLE IF NOT EXISTS team_members (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- 'owner' | 'collaborator' | 'viewer' (viewer reserved for Sprint 5)
  role            TEXT        NOT NULL CHECK (role IN ('owner', 'collaborator', 'viewer')),
  invited_by      TEXT        REFERENCES users(id) ON DELETE SET NULL,
  invitation_id   TEXT        REFERENCES team_invitations(id) ON DELETE SET NULL,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ DEFAULT NULL,
  last_active_at  TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT team_members_user_org UNIQUE (user_id, organization_id)
);

-- Indexes — wrapped because Preview's team_members may inherit the
-- unified_schema UUID-based shape lacking organization_id / role columns.
DO $$ BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_team_members_org  ON team_members (organization_id)';
EXCEPTION WHEN undefined_column THEN NULL; WHEN undefined_table THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id)';
EXCEPTION WHEN undefined_column THEN NULL; WHEN undefined_table THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members (role)';
EXCEPTION WHEN undefined_column THEN NULL; WHEN undefined_table THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

ALTER TABLE IF EXISTS team_members ENABLE ROW LEVEL SECURITY;

-- Owners: full read/write for their organisation
DO $$ BEGIN
  CREATE POLICY "owners full access"
    ON team_members TO authenticated
    USING (
      organization_id IN (
        SELECT tm2.organization_id FROM team_members tm2
        WHERE tm2.user_id = auth.uid()::text
          AND tm2.role = 'owner'
      )
    )
    WITH CHECK (
      organization_id IN (
        SELECT tm2.organization_id FROM team_members tm2
        WHERE tm2.user_id = auth.uid()::text
          AND tm2.role = 'owner'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- Collaborators: read-only for their organisation rows
DO $$ BEGIN
  CREATE POLICY "collaborators read"
    ON team_members FOR SELECT TO authenticated
    USING (
      organization_id IN (
        SELECT tm2.organization_id FROM team_members tm2
        WHERE tm2.user_id = auth.uid()::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- Users can update their own last_active_at and accepted_at
DO $$ BEGIN
  CREATE POLICY "users update own row"
    ON team_members FOR UPDATE TO authenticated
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;

-- Service role full access
DO $$ BEGIN
  CREATE POLICY "service role full access"
    ON team_members TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN datatype_mismatch THEN NULL; WHEN undefined_function THEN NULL; END $$;
