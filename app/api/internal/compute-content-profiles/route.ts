/**
 * POST /api/internal/compute-content-profiles
 *
 * Internal endpoint called by the Supabase Edge Function weekly (Sunday 22:00 AEST).
 * Computes ContentPerformanceProfile for every active org and updates IndustryBaselines.
 *
 * Per-org work is run sequentially to stay within OpenRouter rate limits;
 * each org classification call is already batched by topic-extractor.
 *
 * Wrapped in createEdgeFunctionRunner for structured logging to edge_function_logs.
 *
 * Auth: Bearer CRON_SECRET
 * SYN-631
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEdgeFunctionRunner } from '@/lib/pipelines/runner';
import type { ContentProfileMetadata } from '@/lib/pipelines/metadata-schemas';
import { computeOrgProfile } from '@/lib/content-intelligence/profile-computer';
import { trackImprovementForOrg } from '@/lib/content-intelligence/improvement-tracker';
import { firePersonalisationNotification } from '@/lib/content-intelligence/personalisation-notifier';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const maxDuration = 300;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContentProfileRunResult {
  orgsProcessed: number;
  orgsSkipped: number;
  avgConfidence: number;
  avgImprovementRate: number | null;
}

// ── Runner ────────────────────────────────────────────────────────────────────

const contentProfileRunner = createEdgeFunctionRunner<
  { trigger: string },
  ContentProfileRunResult
>(
  'content-profiles',
  async (_input: { trigger: string }): Promise<ContentProfileRunResult> => {
    const orgs = await prisma.organization.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    let orgsProcessed = 0;
    let orgsSkipped = 0;
    let totalConfidence = 0;
    let totalImprovementRate = 0;
    let improvementRateCount = 0;

    logger.info('compute-content-profiles: starting', {
      orgCount: orgs.length,
    });

    // Sequential processing — keeps OpenRouter token usage predictable
    for (const org of orgs) {
      try {
        const result = await computeOrgProfile(org.id);
        if (result.skipped) {
          orgsSkipped++;
        } else {
          orgsProcessed++;
          totalConfidence += result.confidenceLevel;

          // Fire personalisation-activated notification (non-fatal, idempotent) — SYN-637
          try {
            await firePersonalisationNotification(
              org.id,
              result.postCount,
              result.confidenceLevel,
              result.topTopics ?? [],
              result.optimalTimes ?? {}
            );
          } catch {
            // Notification failure never blocks profile computation
          }
        }
      } catch (err) {
        logger.warn('compute-content-profiles: org failed', {
          organizationId: org.id,
          error: err instanceof Error ? err.message : String(err),
        });
        orgsSkipped++;
      }

      // Track improvement rate for last week (SYN-632) — non-fatal
      try {
        const tracking = await trackImprovementForOrg(org.id);
        if (!tracking.skipped && tracking.improvementRate !== null) {
          totalImprovementRate += tracking.improvementRate;
          improvementRateCount++;
        }
      } catch {
        // Improvement tracking failure never blocks profile computation
      }
    }

    const avgConfidence =
      orgsProcessed > 0 ? totalConfidence / orgsProcessed : 0;
    const avgImprovementRate =
      improvementRateCount > 0
        ? totalImprovementRate / improvementRateCount
        : null;

    logger.info('compute-content-profiles: done', {
      orgsProcessed,
      orgsSkipped,
      avgConfidence,
      avgImprovementRate,
    });

    return { orgsProcessed, orgsSkipped, avgConfidence, avgImprovementRate };
  },
  (
    output: ContentProfileRunResult
  ): { valid: boolean; metadata: Record<string, unknown> } => {
    const valid = output.orgsProcessed >= 0;

    const metadata: ContentProfileMetadata = {
      orgs_processed: output.orgsProcessed,
      orgs_skipped: output.orgsSkipped,
      avg_confidence: Math.round(output.avgConfidence * 1000) / 1000,
      avg_improvement_rate:
        output.avgImprovementRate !== null
          ? Math.round(output.avgImprovementRate * 1000) / 1000
          : null,
    };

    return { valid, metadata };
  }
);

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'COMPUTE_CONTENT_PROFILES');
  if (!auth.ok) return auth.response;

  const runResult = await contentProfileRunner.run([
    { clientId: 'all-orgs', input: { trigger: 'cron' } },
  ]);

  const output = runResult.outputs[0]?.output;

  logger.info('[compute-content-profiles] Run complete', {
    runId: runResult.runId,
    status: runResult.status,
    orgsProcessed: output?.orgsProcessed ?? 0,
    orgsSkipped: output?.orgsSkipped ?? 0,
    avgConfidence: output?.avgConfidence ?? 0,
    durationMs: runResult.durationMs,
  });

  return NextResponse.json({
    ok: true,
    runId: runResult.runId,
    status: runResult.status,
    orgsProcessed: output?.orgsProcessed ?? 0,
    orgsSkipped: output?.orgsSkipped ?? 0,
    avgConfidence: output?.avgConfidence ?? 0,
    durationMs: runResult.durationMs,
  });
}
