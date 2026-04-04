/**
 * Knowledge Graph — TypeScript Types
 * SYN-648 + SYN-654
 *
 * Mirrors the Supabase schema for client_knowledge_entities and
 * client_knowledge_edges. These tables are accessed via the Supabase
 * client (not Prisma) because pgvector operations require raw SQL.
 */

// ---------------------------------------------------------------------------
// Enums (mirroring CHECK constraints in the DB schema)
// ---------------------------------------------------------------------------

export type KnowledgeEntityType =
  | 'content_piece'
  | 'topic'
  | 'platform'
  | 'competitor'
  | 'time_period'
  | 'algorithm_signal'
  | 'brand_attribute'
  | 'review'
  | 'seasonal_event'
  | 'pipeline_memory'; // SYN-654: durable pipeline run state, 90-day TTL

export type KnowledgeSourceSystem =
  | 'brand_intelligence'
  | 'algorithm_kb'
  | 'content_loop'
  | 'advisor'
  | 'health_score'
  | 'performance_data'
  | 'reviews'
  | 'pipeline'; // SYN-654: pipeline memory entries

export type KnowledgeRelationshipType =
  | 'outperforms_on'
  | 'correlates_with'
  | 'recommended_by'
  | 'seasonal_for'
  | 'algorithm_favours'
  | 'competes_with'
  | 'supports'
  | string; // extensible — new relationship types can be added without migration

// ---------------------------------------------------------------------------
// Entity metadata shapes (per entity_type)
// ---------------------------------------------------------------------------

export interface ContentPieceMetadata {
  post_id: string;
  platform: string;
  engagement_rate: number;
  reach: number;
  format: 'video' | 'image' | 'text' | 'carousel' | 'reel';
}

export interface TopicMetadata {
  frequency: number;
  avg_engagement: number;
  platforms: string[];
  trend_direction: 'rising' | 'stable' | 'declining';
}

export interface AlgorithmSignalMetadata {
  platform: string;
  signal_type: string;
  strength: number; // 0–1
  observed_at: string; // ISO date
  evidence_posts: string[];
}

export interface PipelineMemoryMetadata {
  pipeline_id: string;  // e.g. 'ai_advisor', 'content_loop'
  run_id: string;
  run_date: string;     // ISO date
  recommendations_generated: number;
  data_sources_consulted: string[];
  adaptations_triggered: string[];
  output_confidence_score: number; // 0–1
  execution_duration_ms: number;
  client_actions_on_previous?: string[]; // actions taken since last run
}

// ---------------------------------------------------------------------------
// Database row types
// ---------------------------------------------------------------------------

export interface KnowledgeEntity {
  id: string;
  client_id: string;
  entity_type: KnowledgeEntityType;
  entity_name: string;
  entity_metadata: Record<string, unknown>;
  /** 1536-dim OpenAI text-embedding-3-small vector. Null when not yet populated; undefined when not fetched */
  embedding?: number[] | null;
  source_system: KnowledgeSourceSystem;
  source_id: string | null;
  expires_at: string | null; // ISO timestamptz
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEdge {
  id: string;
  client_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: KnowledgeRelationshipType;
  weight: number; // 0–1
  evidence: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Insert types (omit auto-generated fields)
// ---------------------------------------------------------------------------

export type KnowledgeEntityInsert = Omit<KnowledgeEntity, 'id' | 'created_at' | 'updated_at'>;
export type KnowledgeEdgeInsert = Omit<KnowledgeEdge, 'id' | 'created_at' | 'updated_at'>;

// ---------------------------------------------------------------------------
// Query result types
// ---------------------------------------------------------------------------

/** Result of a pgvector similarity search */
export interface SimilarEntity extends KnowledgeEntity {
  /** Cosine distance from query vector (lower = more similar) */
  distance: number;
}

/** Result of a 2-hop graph traversal */
export interface GraphNeighbour {
  entity: KnowledgeEntity;
  edge: KnowledgeEdge;
  hop: 1 | 2;
}

// ---------------------------------------------------------------------------
// SYN-654: Pipeline memory types
// ---------------------------------------------------------------------------

export type PipelineMemoryEntity = KnowledgeEntity & {
  entity_type: 'pipeline_memory';
  entity_metadata: PipelineMemoryMetadata;
};

/** Options for get_pipeline_memory RPC */
export interface GetPipelineMemoryOptions {
  clientId: string;
  pipelineId: string;
  limit?: number; // default 4
}
