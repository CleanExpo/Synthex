-- Migration: SYN-648 + SYN-654 — Per-Client Knowledge Graph Schema
-- Date: 2026-04-04
-- Additive only — no DROPs, no column modifications.
-- pgvector (0.8.0) is already enabled on project znyjoyjsvjotlzjppzal.
-- Apply via Supabase MCP apply_migration or:
--   npx prisma db execute --file prisma/migration-2026-04-04-syn648-654-knowledge-graph.sql --url "$DIRECT_URL"

-- ============================================================================
-- client_knowledge_entities
-- Nodes in the per-client knowledge graph. Each entity represents a piece of
-- intelligence (a topic, a platform, a competitor, an algorithm signal, etc.)
-- that Synthex has learned about a specific client.
-- The `embedding` column holds a 1536-dim vector from text-embedding-3-small
-- for semantic similarity search via pgvector.
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_knowledge_entities (
  id              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  client_id       TEXT        NOT NULL,            -- references organizations.id
  entity_type     TEXT        NOT NULL,            -- see CHECK constraint below
  entity_name     TEXT        NOT NULL,
  entity_metadata JSONB       NOT NULL DEFAULT '{}',
  embedding       vector(1536),                    -- nullable: populated async by embedding pipeline
  source_system   TEXT        NOT NULL,            -- see CHECK constraint below
  source_id       TEXT,                            -- FK to source record (loose reference)
  expires_at      TIMESTAMPTZ,                     -- nullable: temporal entities (e.g. seasonal_event)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT client_knowledge_entities_pkey PRIMARY KEY (id),

  CONSTRAINT client_knowledge_entities_entity_type_check CHECK (entity_type IN (
    'content_piece',
    'topic',
    'platform',
    'competitor',
    'time_period',
    'algorithm_signal',
    'brand_attribute',
    'review',
    'seasonal_event',
    'pipeline_memory'   -- SYN-654: durable pipeline run state (90-day TTL)
  )),

  CONSTRAINT client_knowledge_entities_source_system_check CHECK (source_system IN (
    'brand_intelligence',
    'algorithm_kb',
    'content_loop',
    'advisor',
    'health_score',
    'performance_data',
    'reviews',
    'pipeline'          -- SYN-654: pipeline memory entries
  ))
);

-- Approximate nearest-neighbour similarity search (cosine distance).
-- IVFFlat with 100 lists is suitable for datasets up to ~1M entities.
-- Requires at least 100 rows before the index will be used by the planner.
CREATE INDEX IF NOT EXISTS idx_cke_embedding_ivfflat
  ON client_knowledge_entities
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- JSONB attribute queries (e.g. entity_metadata->>'pipeline_id' = ...)
CREATE INDEX IF NOT EXISTS idx_cke_metadata_gin
  ON client_knowledge_entities
  USING gin (entity_metadata);

-- Primary access pattern: filter by client then entity_type
CREATE INDEX IF NOT EXISTS idx_cke_client_type
  ON client_knowledge_entities (client_id, entity_type);

-- Expiry queries for cleanup jobs
CREATE INDEX IF NOT EXISTS idx_cke_expires_at
  ON client_knowledge_entities (expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE client_knowledge_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_cke" ON client_knowledge_entities
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- client_knowledge_edges
-- Directed edges between entities. Models relationships such as
-- "topic X outperforms_on platform Y" or "algorithm_signal Z correlates_with topic W".
-- Weight [0,1] encodes relationship strength; evidence stores the raw signals.
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_knowledge_edges (
  id                TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  client_id         TEXT        NOT NULL,
  source_entity_id  TEXT        NOT NULL,
  target_entity_id  TEXT        NOT NULL,
  relationship_type TEXT        NOT NULL,    -- e.g. 'outperforms_on', 'correlates_with'
  weight            DOUBLE PRECISION NOT NULL DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),
  evidence          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT client_knowledge_edges_pkey PRIMARY KEY (id),

  CONSTRAINT client_knowledge_edges_source_fkey
    FOREIGN KEY (source_entity_id)
    REFERENCES client_knowledge_entities(id)
    ON DELETE CASCADE,

  CONSTRAINT client_knowledge_edges_target_fkey
    FOREIGN KEY (target_entity_id)
    REFERENCES client_knowledge_entities(id)
    ON DELETE CASCADE
);

-- Graph traversal: start from a node for a given client
CREATE INDEX IF NOT EXISTS idx_cke_edge_client_source
  ON client_knowledge_edges (client_id, source_entity_id);

-- Reverse traversal: in-edges for a given node
CREATE INDEX IF NOT EXISTS idx_cke_edge_client_target
  ON client_knowledge_edges (client_id, target_entity_id);

-- Filter by relationship type within a client
CREATE INDEX IF NOT EXISTS idx_cke_edge_client_rel
  ON client_knowledge_edges (client_id, relationship_type);

ALTER TABLE client_knowledge_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_cke_edge" ON client_knowledge_edges
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- SYN-654: get_pipeline_memory RPC
-- Returns the N most recent pipeline_memory entities for a client + pipeline.
-- Called by the AI Advisor at inference time to inject prior-run context.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pipeline_memory(
  p_client_id   TEXT,
  p_pipeline_id TEXT,
  p_limit       INT DEFAULT 4
)
RETURNS SETOF client_knowledge_entities
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT *
  FROM   client_knowledge_entities
  WHERE  client_id    = p_client_id
    AND  entity_type  = 'pipeline_memory'
    AND  entity_metadata->>'pipeline_id' = p_pipeline_id
  ORDER  BY created_at DESC
  LIMIT  p_limit;
$$;

-- ============================================================================
-- SYN-654: cleanup_pipeline_memory function
-- Deletes pipeline_memory entities older than 90 days.
-- Returns the number of rows deleted.
-- Schedule via Supabase Edge Function cron or pg_cron (if enabled):
--   SELECT cron.schedule('cleanup-pipeline-memory', '0 3 * * 0', 'SELECT cleanup_pipeline_memory()');
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_pipeline_memory()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM client_knowledge_entities
  WHERE  entity_type = 'pipeline_memory'
    AND  created_at  < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute to service_role (Prisma connection) and authenticated (Edge Functions)
GRANT EXECUTE ON FUNCTION get_pipeline_memory(TEXT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_pipeline_memory() TO service_role;
