/**
 * Knowledge Query Module — SYN-650
 *
 * Hybrid retrieval engine combining pgvector semantic search and graph traversal.
 * Consumed by the AI Advisor pipeline when KNOWLEDGE_GRAPH_ADVISOR=true.
 *
 * Algorithm:
 *  1. Embed the query string (OpenAI text-embedding-3-small via EmbeddingService)
 *  2. pgvector cosine similarity search → top 20 semantic candidates
 *  3. 1-hop graph traversal per candidate (edges with weight > 0.3)
 *  4. Fusion scoring: 0.6 × semantic + 0.3 × graph_boost + 0.1 × recency
 *  5. Deduplicate, rank, return top-K with source citations
 *
 * Fallback: if entity count < 10, returns [] so callers can fall back to
 * gatherOrgContext() without the KG enrichment path.
 *
 * @task SYN-650
 */

import prisma from '@/lib/prisma';
import embeddingService from '@/lib/ai/embedding-service';
import { logger } from '@/lib/logger';
import type { KnowledgeEntityType, KnowledgeSourceSystem } from '@/lib/knowledge-graph/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEMANTIC_WEIGHT = 0.6;
const GRAPH_WEIGHT = 0.3;
const RECENCY_WEIGHT = 0.1;

/** Edge weight threshold for graph traversal expansion */
const EDGE_WEIGHT_THRESHOLD = 0.3;

/** Top-N semantic candidates to retrieve before graph expansion */
const SEMANTIC_CANDIDATE_COUNT = 20;

/** Minimum entity count required to proceed with KG retrieval */
export const KG_MIN_ENTITY_THRESHOLD = 10;

// ── Public types ──────────────────────────────────────────────────────────────

export interface KnowledgeResult {
  entityId: string;
  entityType: KnowledgeEntityType;
  entityName: string;
  entityMetadata: Record<string, unknown>;
  sourceSystem: KnowledgeSourceSystem;
  sourceId: string | null;
  /** Fusion score (0.0–1.0): 0.6×semantic + 0.3×graph_boost + 0.1×recency */
  relevanceScore: number;
  /** Relationship types that connected this entity via graph traversal */
  evidence: string[];
  /** Human-readable citation for inclusion in AI prompts */
  sourceCitation: string;
}

export interface QueryKnowledgeOptions {
  /** Max results to return. Default: 10 */
  maxResults?: number;
  /** Filter to specific entity types */
  entityTypes?: KnowledgeEntityType[];
  /** Minimum relevance score to include. Default: 0.3 */
  minRelevance?: number;
  /** Whether to run 1-hop graph traversal. Default: true */
  includeGraphExpansion?: boolean;
}

// ── Internal row shapes from $queryRaw ───────────────────────────────────────

interface SemanticRow {
  id: string;
  entity_type: string;
  entity_name: string;
  entity_metadata: Record<string, unknown>;
  source_system: string;
  source_id: string | null;
  created_at: Date;
  semantic_score: number; // 1 - cosine_distance (higher = more similar)
}

interface EdgeRow {
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  weight: number;
}

// ── Core retrieval function ───────────────────────────────────────────────────

/**
 * Query the client knowledge graph with hybrid semantic + graph retrieval.
 *
 * Returns [] when entity count is below KG_MIN_ENTITY_THRESHOLD — callers should
 * fall back to their non-KG context-gathering path in this case.
 */
export async function queryKnowledge(
  clientId: string,
  query: string,
  options: QueryKnowledgeOptions = {}
): Promise<KnowledgeResult[]> {
  const {
    maxResults = 10,
    entityTypes = [],
    minRelevance = 0.3,
    includeGraphExpansion = true,
  } = options;

  // ── 1. Check entity count — fast path out ───────────────────────────────
  const entityCount = await getEntityCount(clientId);
  if (entityCount < KG_MIN_ENTITY_THRESHOLD) {
    logger.info('knowledge-query: below threshold, skipping KG retrieval', {
      clientId,
      entityCount,
      threshold: KG_MIN_ENTITY_THRESHOLD,
    });
    return [];
  }

  // ── 2. Embed the query ───────────────────────────────────────────────────
  let queryEmbedding: number[];
  try {
    const result = await embeddingService.embed(query);
    queryEmbedding = result.embedding;
  } catch (err) {
    logger.warn('knowledge-query: embedding failed, skipping KG retrieval', {
      clientId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  // ── 3. Semantic search via pgvector ─────────────────────────────────────
  const semanticRows = await semanticSearch(clientId, queryEmbedding, entityTypes, SEMANTIC_CANDIDATE_COUNT);

  if (semanticRows.length === 0) {
    return [];
  }

  // ── 4. Graph traversal (1-hop) ───────────────────────────────────────────
  const graphBoosts = includeGraphExpansion
    ? await buildGraphBoosts(clientId, semanticRows.map(r => r.id))
    : new Map<string, { boost: number; evidence: string[] }>();

  // ── 5. Fusion scoring ────────────────────────────────────────────────────
  const now = Date.now();
  const scored = semanticRows.map(row => {
    const semantic = Math.max(0, Math.min(1, row.semantic_score));
    const graphEntry = graphBoosts.get(row.id);
    const graph = graphEntry ? Math.min(1, graphEntry.boost) : 0;
    const recency = computeRecencyScore(row.created_at, now);

    const relevanceScore = SEMANTIC_WEIGHT * semantic + GRAPH_WEIGHT * graph + RECENCY_WEIGHT * recency;

    return {
      row,
      relevanceScore,
      evidence: graphEntry?.evidence ?? [],
    };
  });

  // ── 6. Filter, sort, slice ───────────────────────────────────────────────
  const results = scored
    .filter(s => s.relevanceScore >= minRelevance)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults)
    .map(s => toKnowledgeResult(s.row, s.relevanceScore, s.evidence));

  logger.info('knowledge-query: retrieval complete', {
    clientId,
    entityCount,
    semanticCandidates: semanticRows.length,
    resultsReturned: results.length,
  });

  return results;
}

// ── Entity count check ────────────────────────────────────────────────────────

async function getEntityCount(clientId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM client_knowledge_entities
    WHERE client_id = ${clientId}
      AND (expires_at IS NULL OR expires_at > NOW())
  `;
  return Number(rows[0]?.count ?? 0);
}

// ── Semantic search ───────────────────────────────────────────────────────────

async function semanticSearch(
  clientId: string,
  embedding: number[],
  entityTypes: KnowledgeEntityType[],
  limit: number
): Promise<SemanticRow[]> {
  // pgvector expects the embedding as a bracketed string: [0.1, 0.2, ...]
  const embeddingStr = `[${embedding.join(',')}]`;

  if (entityTypes.length > 0) {
    // Cast the array for ANY() — Prisma raw passes it as a parameterised literal
    return prisma.$queryRaw<SemanticRow[]>`
      SELECT
        id,
        entity_type,
        entity_name,
        entity_metadata,
        source_system,
        source_id,
        created_at,
        1 - (embedding <=> ${embeddingStr}::vector) AS semantic_score
      FROM client_knowledge_entities
      WHERE client_id = ${clientId}
        AND embedding IS NOT NULL
        AND (expires_at IS NULL OR expires_at > NOW())
        AND entity_type = ANY(${entityTypes}::text[])
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `;
  }

  return prisma.$queryRaw<SemanticRow[]>`
    SELECT
      id,
      entity_type,
      entity_name,
      entity_metadata,
      source_system,
      source_id,
      created_at,
      1 - (embedding <=> ${embeddingStr}::vector) AS semantic_score
    FROM client_knowledge_entities
    WHERE client_id = ${clientId}
      AND embedding IS NOT NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `;
}

// ── Graph traversal ───────────────────────────────────────────────────────────

/**
 * For each seed entity, find 1-hop edges above the weight threshold.
 * Returns a map from entity_id → { boost, evidence[] }.
 *
 * The boost is the average weight of edges connecting to that entity
 * from any of the seed set, normalised to 0–1.
 */
async function buildGraphBoosts(
  clientId: string,
  seedIds: string[]
): Promise<Map<string, { boost: number; evidence: string[] }>> {
  if (seedIds.length === 0) return new Map();

  const edges = await prisma.$queryRaw<EdgeRow[]>`
    SELECT source_entity_id, target_entity_id, relationship_type, weight
    FROM client_knowledge_edges
    WHERE client_id = ${clientId}
      AND weight >= ${EDGE_WEIGHT_THRESHOLD}
      AND (
        source_entity_id = ANY(${seedIds}::text[])
        OR target_entity_id = ANY(${seedIds}::text[])
      )
  `;

  const seedSet = new Set(seedIds);
  const boostMap = new Map<string, { totalWeight: number; count: number; evidence: string[] }>();

  for (const edge of edges) {
    // Find the neighbour — the entity that is NOT in the seed set
    const neighbour = seedSet.has(edge.source_entity_id)
      ? edge.target_entity_id
      : edge.source_entity_id;

    const existing = boostMap.get(neighbour);
    if (existing) {
      existing.totalWeight += edge.weight;
      existing.count += 1;
      if (!existing.evidence.includes(edge.relationship_type)) {
        existing.evidence.push(edge.relationship_type);
      }
    } else {
      boostMap.set(neighbour, {
        totalWeight: edge.weight,
        count: 1,
        evidence: [edge.relationship_type],
      });
    }
  }

  // Also boost the seed entities themselves based on their out-edges
  for (const edge of edges) {
    if (seedSet.has(edge.source_entity_id)) {
      const existing = boostMap.get(edge.source_entity_id);
      if (existing) {
        existing.totalWeight += edge.weight * 0.5; // Self-boost is weighted lower
        existing.count += 1;
      } else {
        boostMap.set(edge.source_entity_id, {
          totalWeight: edge.weight * 0.5,
          count: 1,
          evidence: [edge.relationship_type],
        });
      }
    }
  }

  return new Map(
    Array.from(boostMap.entries()).map(([id, data]) => [
      id,
      {
        boost: data.totalWeight / data.count, // Average weight
        evidence: data.evidence,
      },
    ])
  );
}

// ── Recency scoring ───────────────────────────────────────────────────────────

/**
 * Exponential decay: full score for entities < 7 days old, half-score at 30 days,
 * approaches 0 beyond 90 days.
 */
function computeRecencyScore(createdAt: Date, nowMs: number): number {
  const ageMs = nowMs - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  // Half-life of ~30 days: score = e^(-0.023 * ageDays)
  return Math.exp(-0.023 * ageDays);
}

// ── Result shaping ─────────────────────────────────────────────────────────────

function toKnowledgeResult(
  row: SemanticRow,
  relevanceScore: number,
  evidence: string[]
): KnowledgeResult {
  const sourceCitation = `[Source: ${row.source_system} — ${row.entity_name}]`;

  return {
    entityId: row.id,
    entityType: row.entity_type as KnowledgeEntityType,
    entityName: row.entity_name,
    entityMetadata: row.entity_metadata ?? {},
    sourceSystem: row.source_system as KnowledgeSourceSystem,
    sourceId: row.source_id,
    relevanceScore: Math.round(relevanceScore * 1000) / 1000,
    evidence,
    sourceCitation,
  };
}

// ── Context formatting (for prompt injection) ─────────────────────────────────

/**
 * Format knowledge results as a structured block for injection into the AI Advisor prompt.
 * Includes entity names, metadata summary, and source citations.
 */
export function formatKnowledgeContext(results: KnowledgeResult[]): string {
  if (results.length === 0) return '';

  const lines: string[] = ['Knowledge Graph Insights (retrieved from client history):'];

  for (const result of results) {
    const metaSnippet = summariseMetadata(result.entityMetadata);
    const evidenceNote = result.evidence.length > 0
      ? ` (connected via: ${result.evidence.join(', ')})`
      : '';

    lines.push(
      `• [${result.entityType}] ${result.entityName}${metaSnippet}${evidenceNote} ${result.sourceCitation}`
    );
  }

  return lines.join('\n');
}

function summariseMetadata(metadata: Record<string, unknown>): string {
  const interesting: string[] = [];

  // Pull out numeric values that are informative in context
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'number' && !key.includes('id') && !key.includes('Id')) {
      const label = key.replace(/_/g, ' ');
      interesting.push(`${label}: ${value}`);
    }
    if (typeof value === 'string' && value.length > 0 && value.length < 60) {
      const label = key.replace(/_/g, ' ');
      interesting.push(`${label}: ${value}`);
    }
  }

  return interesting.length > 0 ? ` (${interesting.slice(0, 3).join(', ')})` : '';
}
