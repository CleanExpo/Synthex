/**
 * Knowledge Graph Builder — SYN-649
 *
 * Extracts entities from Synthex data sources, builds weighted relationship
 * edges between them, generates pgvector embeddings, and upserts to Supabase.
 *
 * Data sources:
 *   posts (last 30d) → content_piece entities
 *   gbp_reviews (last 30d) → review entities
 *   authority_scores (latest) → brand_attribute entities
 *   seasonal_signals (active) → seasonal_event entities
 *   recommended_actions (last 4w) → algorithm_signal entities
 *   content_performance_profiles (SYN-631) → topic entities
 */

import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import embeddingService from '@/lib/ai/embedding-service';
import { trackPipelineCost } from '@/lib/pipelines/track-cost';
import { logger } from '@/lib/logger';
import type {
  KnowledgeEntityInsert,
  KnowledgeEdgeInsert,
  KnowledgeEntity,
} from '@/lib/knowledge-graph/types';

// ---------------------------------------------------------------------------
// Supabase client (service role — bypasses RLS)
// New KG tables are not yet in the generated Supabase types, so we use an
// untyped client (`any`) for KG operations until `supabase gen types` is re-run.
// ---------------------------------------------------------------------------

let _supabase: any = null;

function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS_30 = 30 * 24 * 60 * 60 * 1000;
const DAYS_28 = 28 * 24 * 60 * 60 * 1000;
const DAYS_7  =  7 * 24 * 60 * 60 * 1000;

/** text-embedding-3-small: $0.02 / 1M tokens */
const EMBEDDING_COST_PER_M_TOKENS = 0.02;
/** Alert threshold per client per run */
const COST_ALERT_THRESHOLD_USD = 0.10;

// ---------------------------------------------------------------------------
// Entity text for embedding
// ---------------------------------------------------------------------------

function entityToEmbedText(entity: KnowledgeEntityInsert): string {
  return `${entity.entity_type}: ${entity.entity_name} | ${JSON.stringify(entity.entity_metadata)}`;
}

// ---------------------------------------------------------------------------
// Data source extractors
// ---------------------------------------------------------------------------

/** Extract content_piece entities from published posts in the last 30 days */
async function extractPostEntities(
  orgId: string,
  sinceDate: Date
): Promise<KnowledgeEntityInsert[]> {
  const posts = await prisma.post.findMany({
    where: {
      campaign: { organizationId: orgId },
      status: 'published',
      publishedAt: { gte: sinceDate },
      deletedAt: null,
    },
    select: {
      id: true,
      content: true,
      platform: true,
      publishedAt: true,
      analytics: true,
    },
    take: 200, // cap per run
    orderBy: { publishedAt: 'desc' },
  });

  return posts.map((post) => {
    const analytics = (post.analytics as Record<string, unknown>) ?? {};
    const engagementRate = (analytics.engagementRate as number) ?? 0;
    const reach = (analytics.reach as number) ?? 0;
    const format = (analytics.format as string) ?? 'text';

    return {
      client_id: orgId,
      entity_type: 'content_piece' as const,
      entity_name: post.content.slice(0, 80),
      entity_metadata: {
        post_id: post.id,
        platform: post.platform,
        engagement_rate: engagementRate,
        reach,
        format,
        published_at: post.publishedAt?.toISOString(),
      },
      embedding: null,
      source_system: 'content_loop' as const,
      source_id: post.id,
      expires_at: null,
    };
  });
}

/** Extract review entities from GBP reviews in the last 30 days */
async function extractReviewEntities(
  orgId: string,
  sinceDate: Date
): Promise<KnowledgeEntityInsert[]> {
  const reviews = await prisma.gBPReview.findMany({
    where: {
      organizationId: orgId,
      reviewTime: { gte: sinceDate },
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      sentiment: true,
      sentimentScore: true,
      reviewTime: true,
    },
    take: 100,
    orderBy: { reviewTime: 'desc' },
  });

  return reviews.map((review) => ({
    client_id: orgId,
    entity_type: 'review' as const,
    entity_name: review.comment
      ? review.comment.slice(0, 80)
      : `${review.rating}-star review`,
    entity_metadata: {
      rating: review.rating,
      sentiment: review.sentiment ?? 'neutral',
      sentiment_score: review.sentimentScore ?? 0,
      review_time: review.reviewTime.toISOString(),
    },
    embedding: null,
    source_system: 'reviews' as const,
    source_id: review.id,
    expires_at: null,
  }));
}

/** Extract brand_attribute entities from the latest authority score */
async function extractAuthorityEntities(
  orgId: string
): Promise<KnowledgeEntityInsert[]> {
  const score = await prisma.authorityScore.findFirst({
    where: { organizationId: orgId },
    orderBy: { computedAt: 'desc' },
  });

  if (!score) return [];

  const breakdown = (score.eeAtBreakdown as Record<string, number>) ?? {};

  // Create one entity per pillar with its score
  return Object.entries(breakdown).map(([pillar, value]) => ({
    client_id: orgId,
    entity_type: 'brand_attribute' as const,
    entity_name: pillar.replace(/_/g, ' '),
    entity_metadata: {
      pillar,
      score: value,
      overall_authority: score.score,
      computed_at: score.computedAt.toISOString(),
    },
    embedding: null,
    source_system: 'health_score' as const,
    source_id: score.id,
    expires_at: null,
  }));
}

/** Extract seasonal_event entities from active seasonal signals (org's industry) */
async function extractSeasonalEntities(
  orgId: string
): Promise<KnowledgeEntityInsert[]> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { industry: true },
  });

  if (!org?.industry) return [];

  const now = new Date();
  const windowEnd = new Date(now.getTime() + DAYS_7);

  const signals = await prisma.seasonalSignal.findMany({
    where: {
      industrySlug: org.industry,
      locationState: 'AU',
      windowEnd: { gte: now },
      windowStart: { lte: windowEnd },
      confidenceScore: { gte: 50 },
    },
    orderBy: { confidenceScore: 'desc' },
    take: 20,
  });

  return signals.map((signal) => ({
    client_id: orgId,
    entity_type: 'seasonal_event' as const,
    entity_name: signal.opportunityLabel,
    entity_metadata: {
      signal_type: signal.signalType,
      window_start: signal.windowStart.toISOString(),
      window_end: signal.windowEnd.toISOString(),
      confidence_score: signal.confidenceScore,
      location_state: signal.locationState,
      source: signal.source,
    },
    embedding: null,
    source_system: 'advisor' as const,
    source_id: signal.id,
    expires_at: signal.windowEnd.toISOString(),
  }));
}

/** Extract algorithm_signal entities from recent recommended actions */
async function extractAdvisorSignalEntities(
  orgId: string,
  sinceDate: Date
): Promise<KnowledgeEntityInsert[]> {
  const actions = await prisma.recommendedAction.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: sinceDate },
    },
    select: {
      id: true,
      weekStart: true,
      actions: true,
      dollarAttribution: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 16, // 4 weeks × up to 4 briefs
  });

  const entities: KnowledgeEntityInsert[] = [];

  for (const rec of actions) {
    const actionList = (rec.actions as Array<{ title?: string; platform?: string; type?: string; rationale?: string }>) ?? [];
    for (const action of actionList.slice(0, 3)) {
      if (!action.title) continue;
      entities.push({
        client_id: orgId,
        entity_type: 'algorithm_signal' as const,
        entity_name: action.title.slice(0, 80),
        entity_metadata: {
          platform: action.platform ?? 'general',
          signal_type: action.type ?? 'recommendation',
          rationale: action.rationale ?? '',
          week_start: rec.weekStart.toISOString(),
          dollar_attribution: rec.dollarAttribution,
        },
        embedding: null,
        source_system: 'advisor' as const,
        source_id: rec.id,
        expires_at: null,
      });
    }
  }

  return entities;
}

/** Extract topic entities from content performance profile (SYN-631) */
async function extractTopicEntities(
  orgId: string
): Promise<KnowledgeEntityInsert[]> {
  const profile = await prisma.contentPerformanceProfile.findUnique({
    where: { organizationId: orgId },
  });

  if (!profile) return [];

  const topics = (profile.topTopics as Array<{ topic: string; avgEngagement: number; postCount: number; platforms: string[] }>) ?? [];

  return topics.slice(0, 20).map((topic) => ({
    client_id: orgId,
    entity_type: 'topic' as const,
    entity_name: topic.topic,
    entity_metadata: {
      avg_engagement: topic.avgEngagement,
      post_count: topic.postCount,
      platforms: topic.platforms,
      confidence_level: profile.confidenceLevel,
    },
    embedding: null,
    source_system: 'content_loop' as const,
    source_id: profile.id,
    expires_at: null,
  }));
}

// ---------------------------------------------------------------------------
// Relationship builder
// ---------------------------------------------------------------------------

function buildEdges(
  orgId: string,
  entities: KnowledgeEntity[]
): KnowledgeEdgeInsert[] {
  const edges: KnowledgeEdgeInsert[] = [];

  const byType = (type: string) => entities.filter((e) => e.entity_type === type);

  const posts = byType('content_piece');
  const topics = byType('topic');
  const signals = byType('algorithm_signal');
  const reviews = byType('review');
  const attributes = byType('brand_attribute');
  const seasonal = byType('seasonal_event');

  // content_piece → outperforms_on → platform (implicit via content_piece platform)
  // We model "platform" as a topic with platform metadata — skip if no topics
  for (const post of posts) {
    const postPlatform = (post.entity_metadata as { platform?: string }).platform;
    const engRate = (post.entity_metadata as { engagement_rate?: number }).engagement_rate ?? 0;
    if (!postPlatform || engRate < 0.02) continue; // skip low performers

    // Link high-performing posts to matching topic entities on same platform
    for (const topic of topics) {
      const topicPlatforms = (topic.entity_metadata as { platforms?: string[] }).platforms ?? [];
      if (topicPlatforms.includes(postPlatform)) {
        edges.push({
          client_id: orgId,
          source_entity_id: post.id,
          target_entity_id: topic.id,
          relationship_type: 'correlates_with',
          weight: Math.min(0.9, 0.5 + engRate * 10),
          evidence: {
            platform: postPlatform,
            engagement_rate: engRate,
            post_name: post.entity_name,
          },
        });
      }
    }
  }

  // algorithm_signal → algorithm_favours → topic
  for (const signal of signals) {
    const signalPlatform = (signal.entity_metadata as { platform?: string }).platform ?? '';
    for (const topic of topics) {
      const topicPlatforms = (topic.entity_metadata as { platforms?: string[] }).platforms ?? [];
      if (topicPlatforms.includes(signalPlatform) || signalPlatform === 'general') {
        edges.push({
          client_id: orgId,
          source_entity_id: signal.id,
          target_entity_id: topic.id,
          relationship_type: 'algorithm_favours',
          weight: 0.7,
          evidence: {
            signal_name: signal.entity_name,
            platform: signalPlatform,
          },
        });
      }
    }
  }

  // review → supports → brand_attribute (positive reviews lift authority)
  const positiveReviews = reviews.filter(
    (r) => ((r.entity_metadata as { rating?: number }).rating ?? 0) >= 4
  );
  for (const review of positiveReviews.slice(0, 10)) {
    for (const attr of attributes) {
      const attrScore = (attr.entity_metadata as { score?: number }).score ?? 0;
      if (attrScore > 10) {
        edges.push({
          client_id: orgId,
          source_entity_id: review.id,
          target_entity_id: attr.id,
          relationship_type: 'supports',
          weight: 0.6,
          evidence: {
            rating: (review.entity_metadata as { rating?: number }).rating,
          },
        });
        break; // one edge per review
      }
    }
  }

  // seasonal_event → seasonal_for → topic
  for (const event of seasonal) {
    for (const topic of topics) {
      edges.push({
        client_id: orgId,
        source_entity_id: event.id,
        target_entity_id: topic.id,
        relationship_type: 'seasonal_for',
        weight: Math.min(
          1,
          ((event.entity_metadata as { confidence_score?: number }).confidence_score ?? 50) / 100
        ),
        evidence: {
          event_name: event.entity_name,
          topic_name: topic.entity_name,
        },
      });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export interface KnowledgeGraphBuildResult {
  entitiesCreated: number;
  entitiesUpdated: number;
  edgesCreated: number;
  embeddingTokensUsed: number;
  embeddingCostUsd: number;
  costAlertTriggered: boolean;
}

export async function buildKnowledgeGraphForClient(
  orgId: string,
  runId: string
): Promise<KnowledgeGraphBuildResult> {
  const supabase = getSupabase();
  const now = new Date();
  const since30d = new Date(now.getTime() - DAYS_30);
  const since28d = new Date(now.getTime() - DAYS_28);

  // ── 1. Extract all entity types ─────────────────────────────────────────

  const [postEntities, reviewEntities, authorityEntities, seasonalEntities, signalEntities, topicEntities] =
    await Promise.all([
      extractPostEntities(orgId, since30d),
      extractReviewEntities(orgId, since30d),
      extractAuthorityEntities(orgId),
      extractSeasonalEntities(orgId),
      extractAdvisorSignalEntities(orgId, since28d),
      extractTopicEntities(orgId),
    ]);

  const allEntities = [
    ...postEntities,
    ...reviewEntities,
    ...authorityEntities,
    ...seasonalEntities,
    ...signalEntities,
    ...topicEntities,
  ];

  if (allEntities.length === 0) {
    logger.info('[kg-builder] No entities found — skipping', { orgId });
    return {
      entitiesCreated: 0,
      entitiesUpdated: 0,
      edgesCreated: 0,
      embeddingTokensUsed: 0,
      embeddingCostUsd: 0,
      costAlertTriggered: false,
    };
  }

  // ── 2. Generate embeddings in batches of 100 ───────────────────────────

  const embedTexts = allEntities.map(entityToEmbedText);
  let totalTokens = 0;
  const embeddings: number[][] = [];

  const BATCH = 100;
  for (let i = 0; i < embedTexts.length; i += BATCH) {
    const batch = embedTexts.slice(i, i + BATCH);
    const results = await embeddingService.batchEmbed(batch);
    for (const r of results) {
      embeddings.push(r.embedding);
      totalTokens += r.tokenCount;
    }
  }

  const embeddingCostUsd = (totalTokens / 1_000_000) * EMBEDDING_COST_PER_M_TOKENS;
  const costAlertTriggered = embeddingCostUsd > COST_ALERT_THRESHOLD_USD;

  if (costAlertTriggered) {
    logger.warn('[kg-builder] Embedding cost alert', {
      orgId,
      costUsd: embeddingCostUsd,
      threshold: COST_ALERT_THRESHOLD_USD,
    });
  }

  // Track embedding cost
  Promise.resolve(
    trackPipelineCost({
      pipeline_name: 'knowledge_graph',
      client_id: orgId,
      run_id: runId,
      model: 'text-embedding-3-small',
      input_tokens: totalTokens,
      output_tokens: 0,
      cost_usd: embeddingCostUsd,
    })
  ).catch((err) =>
    logger.warn('[kg-builder] Cost tracking failed (non-fatal)', { err: String(err) })
  );

  // ── 3. Upsert entities with embeddings ────────────────────────────────

  const entitiesWithEmbeddings = allEntities.map((e, i) => ({
    ...e,
    embedding: embeddings[i] ?? null,
    updated_at: now.toISOString(),
  }));

  // Upsert in chunks of 50 to stay within Supabase payload limits
  let entitiesCreated = 0;
  let entitiesUpdated = 0;

  const CHUNK = 50;
  const insertedEntities: KnowledgeEntity[] = [];

  for (let i = 0; i < entitiesWithEmbeddings.length; i += CHUNK) {
    const chunk = entitiesWithEmbeddings.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('client_knowledge_entities')
      .upsert(chunk, {
        onConflict: 'client_id,source_system,source_id,entity_type',
        ignoreDuplicates: false,
      })
      .select('id,entity_type,entity_name,entity_metadata,source_system,source_id,client_id,embedding,expires_at,created_at,updated_at');

    if (error) {
      logger.warn('[kg-builder] Entity upsert error', { orgId, error: error.message });
      continue;
    }

    if (data) {
      insertedEntities.push(...(data as KnowledgeEntity[]));
      entitiesCreated += data.length;
    }
  }

  // ── 4. Build + upsert edges ───────────────────────────────────────────

  const edges = buildEdges(orgId, insertedEntities);
  let edgesCreated = 0;

  if (edges.length > 0) {
    for (let i = 0; i < edges.length; i += CHUNK) {
      const chunk = edges.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('client_knowledge_edges')
        .upsert(chunk, {
          onConflict: 'client_id,source_entity_id,target_entity_id,relationship_type',
          ignoreDuplicates: false,
        })
        .select('id');

      if (error) {
        logger.warn('[kg-builder] Edge upsert error', { orgId, error: error.message });
        continue;
      }

      edgesCreated += data?.length ?? 0;
    }
  }

  // Approximate updated vs created (upsert returns all rows)
  entitiesUpdated = Math.max(0, entitiesCreated - allEntities.length);
  entitiesCreated = Math.min(entitiesCreated, allEntities.length);

  return {
    entitiesCreated,
    entitiesUpdated,
    edgesCreated,
    embeddingTokensUsed: totalTokens,
    embeddingCostUsd,
    costAlertTriggered,
  };
}
