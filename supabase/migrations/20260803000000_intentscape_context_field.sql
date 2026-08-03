-- ============================================================================
-- IntentScape durable Context Field and Vision Expansion state (SYN-1120)
--
-- Canonical content lives as immutable, hash-addressed Markdown objects in the
-- private `intentscape-wiki` bucket. PostgreSQL retains tenant-scoped lookup,
-- lineage, run, hypothesis, approval and event metadata only.
--
-- Additive only. Do not apply with `prisma db push`.
-- ============================================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'intentscape-wiki',
  'intentscape-wiki',
  false,
  524288,
  ARRAY['text/markdown']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.intentscape_workspaces (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  created_by_id TEXT NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  retention_class TEXT NOT NULL DEFAULT 'standard',
  origin_signal_hash TEXT NOT NULL,
  active_context_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT intentscape_workspaces_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT intentscape_workspaces_state_check CHECK (
    state IN ('draft', 'context_ready', 'expanding', 'awaiting_approval', 'approved', 'blocked', 'failed', 'archived')
  ),
  CONSTRAINT intentscape_workspaces_retention_check CHECK (
    retention_class IN ('standard', 'prospect', 'legal_hold')
  ),
  CONSTRAINT intentscape_workspaces_origin_hash_check CHECK (
    origin_signal_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT intentscape_workspaces_context_version_check CHECK (active_context_version >= 0)
);

CREATE TABLE IF NOT EXISTS public.intentscape_artifacts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  logical_path TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  version INTEGER NOT NULL,
  parent_version INTEGER,
  evidence_state TEXT NOT NULL DEFAULT 'unverified',
  lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT intentscape_artifacts_storage_path_key UNIQUE (storage_path),
  CONSTRAINT intentscape_artifacts_org_workspace_path_version_key
    UNIQUE (organization_id, workspace_id, logical_path, version),
  CONSTRAINT intentscape_artifacts_workspace_fk
    FOREIGN KEY (workspace_id, organization_id)
    REFERENCES public.intentscape_workspaces (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT intentscape_artifacts_kind_check CHECK (
    kind IN (
      'origin-signal', 'context-field', 'signal-ledger', 'contradictions',
      'vision-attempt', 'anchoring-audit', 'independent-evaluation',
      'accepted-vision', 'research-branch', 'hypothesis-selection',
      'goal-contract', 'capability-activation', 'work-packet'
    )
  ),
  CONSTRAINT intentscape_artifacts_logical_path_check CHECK (
    logical_path ~ '^[A-Za-z0-9][A-Za-z0-9/_-]*[.]md$'
    AND logical_path NOT LIKE '%..%'
  ),
  CONSTRAINT intentscape_artifacts_storage_scope_check CHECK (
    storage_path LIKE organization_id || '/' || workspace_id || '/%'
    AND storage_path NOT LIKE '%..%'
  ),
  CONSTRAINT intentscape_artifacts_hash_check CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT intentscape_artifacts_byte_size_check CHECK (byte_size BETWEEN 1 AND 524288),
  CONSTRAINT intentscape_artifacts_version_check CHECK (version > 0),
  CONSTRAINT intentscape_artifacts_parent_version_check CHECK (
    parent_version IS NULL OR (parent_version > 0 AND parent_version < version)
  ),
  CONSTRAINT intentscape_artifacts_evidence_state_check CHECK (
    evidence_state IN ('verified', 'inferred', 'opinion', 'assumption', 'contradicted', 'missing', 'unverified')
  )
);

CREATE TABLE IF NOT EXISTS public.intentscape_vision_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  context_version INTEGER NOT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  model TEXT,
  confidence DOUBLE PRECISION,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_micros INTEGER NOT NULL DEFAULT 0,
  vision_artifact_id TEXT,
  anchoring_artifact_id TEXT,
  evaluation_artifact_id TEXT,
  rejection_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT intentscape_vision_runs_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT intentscape_vision_runs_org_workspace_context_attempt_key
    UNIQUE (organization_id, workspace_id, context_version, attempt),
  CONSTRAINT intentscape_vision_runs_workspace_fk
    FOREIGN KEY (workspace_id, organization_id)
    REFERENCES public.intentscape_workspaces (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT intentscape_vision_runs_context_version_check CHECK (context_version > 0),
  CONSTRAINT intentscape_vision_runs_attempt_check CHECK (attempt BETWEEN 1 AND 2),
  CONSTRAINT intentscape_vision_runs_status_check CHECK (
    status IN ('pending', 'expanding', 'evaluating', 'awaiting_approval', 'rejected', 'blocked', 'failed', 'approved')
  ),
  CONSTRAINT intentscape_vision_runs_confidence_check CHECK (
    confidence IS NULL OR confidence BETWEEN 0 AND 1
  ),
  CONSTRAINT intentscape_vision_runs_usage_check CHECK (
    prompt_tokens >= 0 AND completion_tokens >= 0 AND total_tokens >= 0 AND cost_micros >= 0
  )
);

CREATE TABLE IF NOT EXISTS public.intentscape_hypotheses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  vision_run_id TEXT NOT NULL,
  hypothesis_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  causal_mechanism TEXT NOT NULL,
  desired_change TEXT NOT NULL,
  affected_stakeholders JSONB NOT NULL,
  evidence_for JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_against JSONB NOT NULL DEFAULT '[]'::jsonb,
  invalidating_assumption TEXT NOT NULL,
  main_risk TEXT NOT NULL,
  adjacent_value TEXT NOT NULL,
  research_branch_ids JSONB NOT NULL,
  rank INTEGER NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT intentscape_hypotheses_org_workspace_hypothesis_version_key
    UNIQUE (organization_id, workspace_id, hypothesis_id, version),
  CONSTRAINT intentscape_hypotheses_workspace_fk
    FOREIGN KEY (workspace_id, organization_id)
    REFERENCES public.intentscape_workspaces (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT intentscape_hypotheses_vision_run_fk
    FOREIGN KEY (vision_run_id, organization_id)
    REFERENCES public.intentscape_vision_runs (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT intentscape_hypotheses_version_check CHECK (version > 0),
  CONSTRAINT intentscape_hypotheses_rank_check CHECK (rank > 0),
  CONSTRAINT intentscape_hypotheses_confidence_check CHECK (confidence BETWEEN 0 AND 1),
  CONSTRAINT intentscape_hypotheses_stakeholders_check CHECK (jsonb_typeof(affected_stakeholders) = 'array'),
  CONSTRAINT intentscape_hypotheses_evidence_for_check CHECK (jsonb_typeof(evidence_for) = 'array'),
  CONSTRAINT intentscape_hypotheses_evidence_against_check CHECK (jsonb_typeof(evidence_against) = 'array'),
  CONSTRAINT intentscape_hypotheses_branches_check CHECK (jsonb_typeof(research_branch_ids) = 'array')
);

CREATE TABLE IF NOT EXISTS public.intentscape_goal_contracts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  vision_run_id TEXT NOT NULL,
  hypothesis_id TEXT NOT NULL,
  hypothesis_version INTEGER NOT NULL,
  version INTEGER NOT NULL,
  context_version INTEGER NOT NULL,
  desired_change TEXT NOT NULL,
  primary_stakeholder TEXT NOT NULL,
  acceptance_criteria JSONB NOT NULL,
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  authority_boundaries JSONB NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'approved',
  approved_by TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  artifact_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT intentscape_goal_contracts_org_workspace_version_key
    UNIQUE (organization_id, workspace_id, version),
  CONSTRAINT intentscape_goal_contracts_hypothesis_version_key
    UNIQUE (organization_id, workspace_id, hypothesis_id, hypothesis_version),
  CONSTRAINT intentscape_goal_contracts_workspace_fk
    FOREIGN KEY (workspace_id, organization_id)
    REFERENCES public.intentscape_workspaces (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT intentscape_goal_contracts_vision_run_fk
    FOREIGN KEY (vision_run_id, organization_id)
    REFERENCES public.intentscape_vision_runs (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT intentscape_goal_contracts_version_check CHECK (version > 0),
  CONSTRAINT intentscape_goal_contracts_hypothesis_version_check CHECK (hypothesis_version > 0),
  CONSTRAINT intentscape_goal_contracts_context_version_check CHECK (context_version > 0),
  CONSTRAINT intentscape_goal_contracts_status_check CHECK (status = 'approved'),
  CONSTRAINT intentscape_goal_contracts_acceptance_check CHECK (jsonb_typeof(acceptance_criteria) = 'array'),
  CONSTRAINT intentscape_goal_contracts_exclusions_check CHECK (jsonb_typeof(exclusions) = 'array'),
  CONSTRAINT intentscape_goal_contracts_authority_check CHECK (jsonb_typeof(authority_boundaries) = 'array'),
  CONSTRAINT intentscape_goal_contracts_evidence_check CHECK (jsonb_typeof(evidence_refs) = 'array')
);

CREATE TABLE IF NOT EXISTS public.intentscape_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  artifact_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT intentscape_events_workspace_fk
    FOREIGN KEY (workspace_id, organization_id)
    REFERENCES public.intentscape_workspaces (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT intentscape_events_payload_check CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS intentscape_workspaces_org_state_updated_idx
  ON public.intentscape_workspaces (organization_id, state, updated_at DESC);
CREATE INDEX IF NOT EXISTS intentscape_workspaces_creator_idx
  ON public.intentscape_workspaces (created_by_id);
CREATE INDEX IF NOT EXISTS intentscape_artifacts_org_workspace_kind_created_idx
  ON public.intentscape_artifacts (organization_id, workspace_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS intentscape_artifacts_org_hash_idx
  ON public.intentscape_artifacts (organization_id, content_hash);
CREATE INDEX IF NOT EXISTS intentscape_vision_runs_org_workspace_status_created_idx
  ON public.intentscape_vision_runs (organization_id, workspace_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS intentscape_vision_runs_one_accepted_context_idx
  ON public.intentscape_vision_runs (organization_id, workspace_id, context_version)
  WHERE status IN ('awaiting_approval', 'approved');
CREATE INDEX IF NOT EXISTS intentscape_hypotheses_org_workspace_run_rank_idx
  ON public.intentscape_hypotheses (organization_id, workspace_id, vision_run_id, rank);
CREATE INDEX IF NOT EXISTS intentscape_goal_contracts_org_workspace_status_approved_idx
  ON public.intentscape_goal_contracts (organization_id, workspace_id, status, approved_at DESC);
CREATE INDEX IF NOT EXISTS intentscape_events_org_workspace_created_idx
  ON public.intentscape_events (organization_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intentscape_events_org_entity_idx
  ON public.intentscape_events (organization_id, entity_type, entity_id);

DROP TRIGGER IF EXISTS intentscape_workspaces_touch_updated_at ON public.intentscape_workspaces;
CREATE TRIGGER intentscape_workspaces_touch_updated_at
BEFORE UPDATE ON public.intentscape_workspaces
FOR EACH ROW EXECUTE FUNCTION public.synthex_touch_updated_at();

DROP TRIGGER IF EXISTS intentscape_vision_runs_touch_updated_at ON public.intentscape_vision_runs;
CREATE TRIGGER intentscape_vision_runs_touch_updated_at
BEFORE UPDATE ON public.intentscape_vision_runs
FOR EACH ROW EXECUTE FUNCTION public.synthex_touch_updated_at();

ALTER TABLE public.intentscape_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentscape_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentscape_vision_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentscape_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentscape_goal_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentscape_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'intentscape_workspaces',
    'intentscape_artifacts',
    'intentscape_vision_runs',
    'intentscape_hypotheses',
    'intentscape_goal_contracts',
    'intentscape_events'
  ]
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        table_name || '_service_role_all',
        table_name
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_team_member(organization_id))',
        table_name || '_tenant_select',
        table_name
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

DO $$
BEGIN
  CREATE POLICY intentscape_wiki_tenant_select
    ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'intentscape-wiki'
      AND public.is_team_member((storage.foldername(name))[1])
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
