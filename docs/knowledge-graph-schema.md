# Knowledge Graph Schema — SYN-648 + SYN-654

**Supabase project:** `znyjoyjsvjotlzjppzal`
**Applied:** 2026-04-04
**Migration file:** `prisma/migration-2026-04-04-syn648-654-knowledge-graph.sql`
**TypeScript types:** `lib/knowledge-graph/types.ts`

---

## Overview

The per-client knowledge graph stores intelligence that Synthex has accumulated about each client — topics they perform on, platforms where they win, algorithms that favour their content, and pipeline run history. It is a dual-structure:

- **Entities** (`client_knowledge_entities`) — nodes: a topic, a platform, a competitor, etc.
- **Edges** (`client_knowledge_edges`) — directed relationships between nodes with a strength weight

Each entity optionally carries a `vector(1536)` embedding (text-embedding-3-small) enabling semantic similarity queries via pgvector. Edges carry evidence JSON so the downstream AI Advisor can explain *why* a recommendation was made.

Inspired by the dual-graph architecture in RAG-Anything (arXiv 2510.12323), re-implemented natively in TypeScript + Supabase without a separate graph DB.

---

## Tables

### `client_knowledge_entities`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT | NO | `gen_random_uuid()::text` | Primary key (cuid-compatible text) |
| `client_id` | TEXT | NO | — | FK → `organizations.id` |
| `entity_type` | TEXT | NO | — | See Entity Types below |
| `entity_name` | TEXT | NO | — | Human-readable label |
| `entity_metadata` | JSONB | NO | `{}` | Type-specific structured data |
| `embedding` | vector(1536) | YES | NULL | text-embedding-3-small; populated async |
| `source_system` | TEXT | NO | — | Which Synthex system created this |
| `source_id` | TEXT | YES | NULL | Loose FK to source record |
| `expires_at` | TIMESTAMPTZ | YES | NULL | Temporal entities (seasonal events) |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | |

### `client_knowledge_edges`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT | NO | `gen_random_uuid()::text` | Primary key |
| `client_id` | TEXT | NO | — | Denormalised for query efficiency |
| `source_entity_id` | TEXT | NO | — | FK → `client_knowledge_entities.id` ON DELETE CASCADE |
| `target_entity_id` | TEXT | NO | — | FK → `client_knowledge_entities.id` ON DELETE CASCADE |
| `relationship_type` | TEXT | NO | — | See Relationship Taxonomy below |
| `weight` | DOUBLE PRECISION | NO | `0.5` | Relationship strength [0, 1] |
| `evidence` | JSONB | NO | `{}` | Raw signals supporting this edge |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | |

---

## Entity Types

| Type | Source System | TTL | Metadata Shape |
|---|---|---|---|
| `content_piece` | `content_loop` | None | `{ post_id, platform, engagement_rate, reach, format }` |
| `topic` | `content_loop`, `advisor` | None | `{ frequency, avg_engagement, platforms[], trend_direction }` |
| `platform` | `performance_data` | None | `{ platform_name, follower_count, avg_reach }` |
| `competitor` | `brand_intelligence` | None | `{ competitor_name, domain, content_cadence }` |
| `time_period` | `advisor` | None | `{ period_type, start_date, end_date, performance_index }` |
| `algorithm_signal` | `algorithm_kb` | 30 days | `{ platform, signal_type, strength, observed_at, evidence_posts[] }` |
| `brand_attribute` | `brand_intelligence` | None | `{ attribute, value, confidence }` |
| `review` | `reviews` | None | `{ rating, platform, sentiment, themes[] }` |
| `seasonal_event` | `advisor` | Event end | `{ event_name, start_date, end_date, relevance_score }` |
| `pipeline_memory` | `pipeline` | **90 days** | See Pipeline Memory below |

---

## Pipeline Memory Entity (SYN-654)

`pipeline_memory` entities are written by the `PipelineMemoryWriter` (see `lib/pipelines/adaptation.ts`) after each successful pipeline run. The AI Advisor queries the 4 most recent entries at inference time via the `get_pipeline_memory` RPC.

**Metadata schema:**

```typescript
interface PipelineMemoryMetadata {
  pipeline_id: string;                 // 'ai_advisor' | 'content_loop' | ...
  run_id: string;                      // UUID per run
  run_date: string;                    // ISO 8601
  recommendations_generated: number;
  data_sources_consulted: string[];
  adaptations_triggered: string[];     // which AdaptationChain branches fired
  output_confidence_score: number;     // 0–1
  execution_duration_ms: number;
  client_actions_on_previous?: string[]; // actions taken since last run
}
```

**Automatic cleanup:** `cleanup_pipeline_memory()` SQL function deletes entries older than 90 days. Call it from a weekly Supabase Edge Function or scheduled task.

---

## Relationship Type Taxonomy

| Type | Meaning | Weight guidance |
|---|---|---|
| `outperforms_on` | Entity A gets better results than baseline on entity B (platform) | 0.7–1.0 |
| `correlates_with` | Entities A and B tend to occur together with positive outcomes | 0.4–0.8 |
| `recommended_by` | Advisor explicitly recommended A in context of B | 0.8–1.0 |
| `seasonal_for` | Topic A is relevant during event B | 0.5–0.9 |
| `algorithm_favours` | Platform algorithm currently favours entity A | 0.6–1.0 |
| `competes_with` | A and B serve similar goals; choosing A may deprioritise B | 0.5–0.7 |
| `supports` | A provides supporting evidence or context for B | 0.3–0.6 |

Relationship types are open-ended (TEXT column) — new types can be introduced at runtime without a schema migration.

---

## Indexes

| Index | Table | Type | Purpose |
|---|---|---|---|
| `idx_cke_embedding_ivfflat` | entities | IVFFlat (cosine) | ANN similarity search; 100 lists |
| `idx_cke_metadata_gin` | entities | GIN | JSONB attribute queries |
| `idx_cke_client_type` | entities | btree (client_id, entity_type) | Primary access pattern |
| `idx_cke_expires_at` | entities | btree partial (WHERE NOT NULL) | Cleanup jobs |
| `idx_cke_edge_client_source` | edges | btree (client_id, source_entity_id) | Forward traversal |
| `idx_cke_edge_client_target` | edges | btree (client_id, target_entity_id) | Reverse traversal |
| `idx_cke_edge_client_rel` | edges | btree (client_id, relationship_type) | Relationship filtering |

---

## RPC Functions (SYN-654)

### `get_pipeline_memory(p_client_id, p_pipeline_id, p_limit)`

Returns the N most recent `pipeline_memory` entities for a client + pipeline, ordered by `created_at DESC`. Used by the AI Advisor to inject prior-run context.

```sql
SELECT * FROM get_pipeline_memory('org_abc123', 'ai_advisor', 4);
```

TypeScript call via Supabase client:
```typescript
const { data } = await supabase.rpc('get_pipeline_memory', {
  p_client_id: clientId,
  p_pipeline_id: 'ai_advisor',
  p_limit: 4,
});
```

### `cleanup_pipeline_memory()`

Deletes all `pipeline_memory` entities older than 90 days. Returns the count of deleted rows. Schedule weekly:

```sql
-- If pg_cron is enabled:
SELECT cron.schedule(
  'cleanup-pipeline-memory',
  '0 3 * * 0',  -- 3am every Sunday
  'SELECT cleanup_pipeline_memory()'
);

-- Or call from a Supabase Edge Function on a weekly schedule.
```

---

## Embedding Strategy

- **Model:** `text-embedding-3-small` (1536 dimensions, OpenAI)
- **Text to embed:** `entity_name + ' ' + JSON.stringify(entity_metadata)`
- **Distance metric:** cosine similarity (IVFFlat `vector_cosine_ops`)
- **When populated:** Embeddings are populated asynchronously after entity creation by the nightly KG construction Edge Function (SYN-649)
- **Null handling:** Entities with `embedding = NULL` are excluded from similarity queries but are still returned in type/metadata queries

---

## Access Pattern

All DB access goes through Prisma (service role) or the Supabase client (service role key). RLS is enabled with `service_role USING (true)` policies — the service role bypasses RLS automatically, so no `auth.uid()` filtering is required. Synthex uses custom JWT auth, not Supabase Auth.

---

## Related Issues

| Issue | Title |
|---|---|
| SYN-648 | This schema |
| SYN-654 | pipeline_memory entity type + cleanup (embedded in this migration) |
| SYN-649 | Nightly KG construction Edge Function (depends on this schema) |
| SYN-650 | `lib/knowledge-query.ts` module + AI Advisor wiring (depends on SYN-649) |
| SYN-653 | AdaptationChain + PipelineMemoryWriter interfaces |
