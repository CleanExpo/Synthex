# NodeJS-Starter-V1 SQL Analysis
# Date: 17/03/2026
# Analyst: database/SQL integration review

## Source Files Reviewed

| File | Purpose |
|------|---------|
| `scripts/init-db.sql` | Base auth, contractors, pgvector documents schema |
| `scripts/workflow-schema.sql` | Workflow builder with nodes/edges/executions |
| `scripts/seed-dev.sql` | Local dev seed — bcrypt admin user |
| `SETUP_SUPABASE.sql` | Contractor availability system for Supabase |
| `supabase/migrations/00000000000001_auth_schema.sql` | Profiles table extending `auth.users` with RLS |
| `supabase/migrations/00000000000003_state_tables.sql` | Conversations + tasks with user-scoped RLS |
| `supabase/migrations/00000000000004_audit_evidence.sql` | Audit evidence, verification results, friction analyses |
| `supabase/migrations/00000000000005_copywriting_consistency.sql` | Business NAP, platform listings, content pieces |
| `supabase/migrations/00000000000006_agent_runs_realtime.sql` | Agent execution tracking with realtime publication |
| `supabase/migrations/00000000000007_domain_memory.sql` | pgvector-powered domain memory with semantic search |
| `supabase/migrations/00000000000008_workflows.sql` | Visual workflow builder with complete RLS |
| `supabase/migrations/00000000000009_rag_pipeline.sql` | Document chunking, hybrid vector+keyword search |
| `supabase/migrations/00000000000010_analytics.sql` | Hourly metrics, API cost tracking, alerts |
| `supabase/migrations/20251230050841_agent_task_queue.sql` | Agent task queue with priority and status tracking |
| `supabase/migrations/20260106000002_add_rls_policies.sql` | RLS for contractor/availability tables |

## Synthex Context

Synthex uses **Prisma** as the schema source of truth (91+ models). Raw SQL tables
are only created for Supabase-native features that Prisma cannot manage:

- Auth via `auth.users` (Supabase Auth — not in Prisma)
- Realtime subscriptions (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`)
- pgvector indexes (`USING ivfflat`)
- RLS policies (`ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`)
- Generated columns (`GENERATED ALWAYS AS ... STORED`)
- Triggers on `auth.users` (`on_auth_user_created`)

Synthex's existing Supabase migrations live in `supabase/migrations/`:
- `20250115000001_unified_schema.sql` — profiles, personas, content tables
- `20260215000001_security_hardening.sql` — RLS on team_members, viral_patterns
- `20260215000002_performance_indexes.sql` — composite indexes
- `20260315000001_vault_secrets_management.sql` — vault secrets

## What Was Integrated

### RLS Migration Created
**File**: `supabase/migrations/20260317000001_agent_runs_and_workflow_rls.sql`

This migration was created from two high-value NodeJS-Starter migrations that are
directly relevant to Phase 118 (Headless Task-Runner) and Synthex's agentic layer.

#### Source: `00000000000006_agent_runs_realtime.sql`
Patterns extracted:
- `agent_runs` table — full execution tracking with status transitions
- Status history trigger — appends `{from, to, timestamp}` to `metadata.status_history` on status changes
- `notify_agent_run_status_change()` function — tracks state transitions automatically
- `get_active_agent_runs(p_user_id)` helper function — returns in-progress runs
- `agent_run_summaries` view — joins with tasks for dashboard display
- Realtime publication — `ALTER PUBLICATION supabase_realtime ADD TABLE`
- Service-role bypass RLS — `auth.jwt() ->> 'role' = 'service_role'`

#### Source: `20251230050841_agent_task_queue.sql`
Patterns extracted:
- `agent_task_queue` table — tracks task lifecycle (pending → in_progress → completed/failed)
- Priority-based indexing (`priority DESC`) — essential for queue ordering
- Explicit `TO authenticated` / `TO service_role` role targeting in policies
- Explicit `GRANT` statements for `authenticated`, `anon`, `service_role` roles
- Transaction wrapping (`BEGIN` / `COMMIT`) — for atomic migration

## What Was Skipped and Why

### Contractor/Availability System (`init-db.sql`, `SETUP_SUPABASE.sql`, `20260106000002_add_rls_policies.sql`)
**Skipped**: Domain-specific to NodeJS-Starter's contractor availability business logic.
The `contractors`, `availability_slots`, `australian_state` enum are irrelevant to
Synthex's marketing automation domain. The `USING (true)` RLS policies (public read/write)
represent a development placeholder, not a pattern Synthex should adopt.

### Copywriting/Business Tables (`00000000000005_copywriting_consistency.sql`)
**Skipped**: Synthex has its own marketing content models in Prisma (`Campaign`, `Post`,
`ContentLibrary`, `ContentDraft`, etc.). The `businesses`, `platform_listings`,
`content_pieces`, `brand_guidelines` tables would duplicate Synthex's existing structure.
The RLS patterns here (join-based ownership via `EXISTS (SELECT 1 FROM businesses WHERE ...)`)
are already covered in `20260215000001_security_hardening.sql`.

### Domain Memory System (`00000000000007_domain_memory.sql`)
**Skipped from migration**: This is a highly valuable pattern but requires the pgvector
extension and careful integration with Synthex's existing `User` and `Project` Prisma models.
The `find_similar_memories()` and `prune_stale_memories()` functions are excellent but
should be introduced as part of a dedicated RAG/memory phase with proper Prisma model
additions. See recommendation below.

### RAG Pipeline (`00000000000009_rag_pipeline.sql`)
**Skipped from migration**: Same reasoning as domain memory. Excellent `hybrid_search()`
function combining IVFFlat vector search with tsvector keyword search. Should be a
dedicated phase — Synthex has no existing pgvector infrastructure in the current
supabase migrations.

### Workflow Tables (`00000000000008_workflows.sql`, `workflow-schema.sql`)
**Skipped from migration**: Synthex already has `WorkflowExecution` and `StepExecution`
in Prisma. The NodeJS-Starter Supabase-native workflow tables (`workflows`,
`workflow_executions`) would conflict. The RLS patterns for published/template visibility
(`USING (auth.uid() = user_id OR is_published = TRUE)`) are a useful reference but
would need to target the Prisma-managed tables, which is done via separate RLS-only
migrations (not table creation).

### Analytics/Observability (`00000000000010_analytics.sql`)
**Skipped from migration**: References `agent_runs` table (added in the integrated
migration) but also creates `api_usage` and `tool_usage_events` tables that would
conflict with Synthex's existing `ApiUsage` Prisma model. The
`aggregate_hourly_metrics()` function is a good reference if an observability phase
is planned. Should be integrated after confirming Synthex's `ApiUsage` table name.

### Audit Evidence (`00000000000004_audit_evidence.sql`)
**Skipped from migration**: Synthex has `AuditLog` in Prisma. The `audit_evidence`,
`verification_results`, `audit_runs`, `friction_analyses`, `route_audit_results`
tables are for a different auditing concern (autonomous agent verification) and could
be added in a dedicated Phase 118 follow-on. The `cleanup_expired_evidence()` retention
function is a good pattern to adopt.

### Seed Data (`scripts/seed-dev.sql`)
**Skipped entirely**: Dev-only bcrypt admin seed. Synthex uses Supabase Auth for user
creation. The well-known credentials (`admin@local.dev` / `admin123`) must never be
used outside NodeJS-Starter's local Docker environment.

### Auth Schema (`00000000000001_auth_schema.sql`)
**Skipped**: Synthex already has a profiles table in `20250115000001_unified_schema.sql`
and uses `auth.users` via the same pattern. The `handle_new_user()` trigger pattern is
already established in Synthex.

## Recommendations for Future Phases

### Recommendation 1: pgvector + Domain Memory (High Value)
When Phase 119+ introduces a knowledge/memory layer for the autonomous task runner,
adopt the domain memory pattern from `00000000000007_domain_memory.sql`:
- `domain_memories` with `vector(1536)` embedding + IVFFlat index
- `find_similar_memories()` semantic search function
- `prune_stale_memories()` retention function
- Link to Synthex `User` via `user_id`

### Recommendation 2: RAG Pipeline (High Value)
If Synthex adds document ingestion for AI context, use the hybrid search pattern
from `00000000000009_rag_pipeline.sql`:
- `hybrid_search()` — weighted vector + keyword scoring with `ts_rank`
- `document_chunks.content_tsvector` auto-populated via trigger
- Parent-child chunk hierarchy for context retrieval

### Recommendation 3: Audit Evidence Retention (Medium Value)
The `cleanup_expired_evidence()` pattern from `00000000000004_audit_evidence.sql`
can be adapted for Synthex's `AuditLog` retention (currently controlled by
`AUDIT_LOG_RETENTION_DAYS` env var). A cron-based cleanup function in Supabase
would be more reliable than application-level pruning.

### Recommendation 4: Prisma Models Missing from NodeJS-Starter Patterns
The following NodeJS-Starter SQL tables represent concepts NOT yet in Synthex's
Prisma schema. They are relevant to Phase 118 (Headless Task-Runner):

| NodeJS-Starter Table | Relevance to Synthex | Action |
|----------------------|----------------------|--------|
| `agent_task_queue` | Direct match: `AUTONOMOUS_TASKS` queue (Phase 118) | Add Prisma model `AutonomousTask` |
| `agent_runs` | Agent execution tracking for headless runner | Add Prisma model `AgentRun` |
| `verification_results` | Task verification for autonomous operations | Add Prisma model `VerificationResult` |
| `domain_memories` | Persistent context for AI agents | Add Prisma model `AgentMemory` (future phase) |

These are recommendations only — schema.prisma is managed by the database-prisma agent.

## Integration Summary

| Component | Status | File |
|-----------|--------|------|
| Agent runs RLS + realtime + status tracking | Integrated | `supabase/migrations/20260317000001_agent_runs_and_workflow_rls.sql` |
| Agent task queue RLS + grants | Integrated | `supabase/migrations/20260317000001_agent_runs_and_workflow_rls.sql` |
| Domain memory / RAG pipeline | Deferred | Recommendation 1 & 2 above |
| Contractor availability system | Skipped | Domain-specific, not applicable |
| Copywriting business tables | Skipped | Conflicts with Prisma models |
| Analytics observability | Deferred | Conflicts with `ApiUsage` Prisma model |
| Audit evidence | Deferred | Recommendation 3 above |
