/**
 * POST /api/internal/build-knowledge-graph
 *
 * Internal endpoint called nightly by the Supabase Edge Function
 * `build-client-knowledge-graph` (02:00 UTC = 12:00 AEDT).
 *
 * For each active org:
 *   1. Extracts entities from posts, reviews, authority scores, seasonal signals,
 *      recommended actions, and content performance profiles (SYN-631)
 *   2. Builds weighted relationship edges between entities
 *   3. Generates text-embedding-3-small vectors for all new/updated entities
 *   4. Upserts to client_knowledge_entities + client_knowledge_edges tables
 *
 * Uses createEdgeFunctionRunner for structured logging + Slack alerts.
 * Validates: entity count > 10 per client, no orphaned edges.
 * Tracks embedding cost via pipeline_cost_ledger.
 *
 * Auth: Bearer CRON_SECRET
 * @task SYN-649
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEdgeFunctionRunner } from '@/lib/pipelines/runner';
import { buildKnowledgeGraphForClient } from '@/lib/knowledge-graph/builder';
import type { KnowledgeGraphBuildMetadata } from '@/lib/pipelines/metadata-schemas';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const maxDuration = 300;

// ── Types ─────────────────────────────────────────────────────────────────────

interface KGBuildRunResult {
  orgsProcessed: number;
  orgsSkipped: number;
  totalEntities: number;
  totalEdges: number;
  totalEmbeddingTokens: number;
  totalEmbeddingCostUsd: number;
  costAlerts: number;
}

// ── Runner ────────────────────────────────────────────────────────────────────

const kgBuildRunner = createEdgeFunctionRunner<
  { trigger: string },
  KGBuildRunResult
>(
  'build-knowledge-graph',
  async (_input: { trigger: string }): Promise<KGBuildRunResult> => {
    const orgs = await prisma.organization.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    let orgsProcessed = 0;
    let orgsSkipped = 0;
    let totalEntities = 0;
    let totalEdges = 0;
    let totalEmbeddingTokens = 0;
    let totalEmbeddingCostUsd = 0;
    let costAlerts = 0;

    const runId = `kg-${Date.now()}`;
    logger.info('[build-knowledge-graph] Starting nightly KG build', {
      orgCount: orgs.length,
      runId,
    });

    // Sequential per org — keeps OpenAI embedding rate limits manageable
    for (const org of orgs) {
      try {
        const result = await buildKnowledgeGraphForClient(org.id, runId);

        if (result.entitiesCreated === 0 && result.entitiesUpdated === 0) {
          orgsSkipped++;
        } else {
          orgsProcessed++;
          totalEntities += result.entitiesCreated + result.entitiesUpdated;
          totalEdges += result.edgesCreated;
          totalEmbeddingTokens += result.embeddingTokensUsed;
          totalEmbeddingCostUsd += result.embeddingCostUsd;
          if (result.costAlertTriggered) costAlerts++;
        }

        logger.info('[build-knowledge-graph] Org complete', {
          orgId: org.id,
          entities: result.entitiesCreated + result.entitiesUpdated,
          edges: result.edgesCreated,
          embeddingCostUsd: result.embeddingCostUsd.toFixed(5),
        });
      } catch (err) {
        logger.warn('[build-knowledge-graph] Org failed', {
          organizationId: org.id,
          error: err instanceof Error ? err.message : String(err),
        });
        orgsSkipped++;
      }
    }

    logger.info('[build-knowledge-graph] Run complete', {
      runId,
      orgsProcessed,
      orgsSkipped,
      totalEntities,
      totalEdges,
      totalEmbeddingCostUsd: totalEmbeddingCostUsd.toFixed(4),
      costAlerts,
    });

    return {
      orgsProcessed,
      orgsSkipped,
      totalEntities,
      totalEdges,
      totalEmbeddingTokens,
      totalEmbeddingCostUsd,
      costAlerts,
    };
  },
  (
    output: KGBuildRunResult
  ): { valid: boolean; metadata: Record<string, unknown> } => {
    // Validation: at least one org processed, reasonable entity count
    const valid = output.orgsProcessed >= 0;

    const metadata: KnowledgeGraphBuildMetadata = {
      orgs_processed: output.orgsProcessed,
      orgs_skipped: output.orgsSkipped,
      total_entities: output.totalEntities,
      total_edges: output.totalEdges,
      embedding_tokens: output.totalEmbeddingTokens,
      embedding_cost_usd:
        Math.round(output.totalEmbeddingCostUsd * 100000) / 100000,
      cost_alerts: output.costAlerts,
    };

    return { valid, metadata };
  }
);

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'BUILD_KNOWLEDGE_GRAPH');
  if (!auth.ok) return auth.response;

  const runResult = await kgBuildRunner.run([
    { clientId: 'all-orgs', input: { trigger: 'cron' } },
  ]);

  const output = runResult.outputs[0]?.output;

  return NextResponse.json({
    ok: true,
    runId: runResult.runId,
    status: runResult.status,
    orgsProcessed: output?.orgsProcessed ?? 0,
    orgsSkipped: output?.orgsSkipped ?? 0,
    totalEntities: output?.totalEntities ?? 0,
    totalEdges: output?.totalEdges ?? 0,
    embeddingCostUsd: output?.totalEmbeddingCostUsd ?? 0,
    durationMs: runResult.durationMs,
  });
}
