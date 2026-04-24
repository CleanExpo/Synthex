/**
 * POST /api/internal/compute-content-scores
 *
 * CRON_SECRET-guarded internal route called weekly by the `score-content-draft`
 * Supabase Edge Function (Sunday 14:00 UTC, after compute-content-profiles).
 *
 * For each active organisation with a ContentPerformanceProfile:
 *   1. Compute Content Score (0-100) from confidenceLevel + improvementRate + postCount
 *   2. Persist to `content_score_history` (upsert on org + week_start)
 *   3. Aggregate run-level metadata for edge_function_logs
 *
 * Uses createEdgeFunctionRunner for structured logging and status tracking.
 *
 * Body (optional): { organizationId?: string }  — scope to single org for testing.
 *
 * @task SYN-664
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEdgeFunctionRunner, ClientInput } from '@/lib/pipelines/runner';
import type { ContentScoreMetadata } from '@/lib/pipelines/metadata-schemas';
import {
  computeContentScore,
  saveContentScore,
  ComputedContentScore,
} from '@/lib/intelligence/content-scorer';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

// ── Week start helper ─────────────────────────────────────────────────────────

function weekStartMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

// ── Runner ────────────────────────────────────────────────────────────────────

const contentScoreRunner = createEdgeFunctionRunner<
  string,
  ComputedContentScore | null
>(
  'content-score',
  async (
    _orgName: string,
    clientId: string
  ): Promise<ComputedContentScore | null> => {
    const weekStart = weekStartMonday();
    const computed = await computeContentScore(clientId, weekStart);
    if (computed) {
      await saveContentScore(computed);
    }
    return computed;
  },
  (
    output: ComputedContentScore | null
  ): { valid: boolean; metadata: Record<string, unknown> } => {
    if (!output) {
      // Org skipped — no ContentPerformanceProfile yet
      return {
        valid: true,
        metadata: { skipped: true, orgs_processed: 0, orgs_skipped: 1 },
      };
    }
    const metadata: ContentScoreMetadata = {
      orgs_processed: 1,
      orgs_skipped: 0,
      avg_score: output.score,
      dark_run_mode: false,
    };
    return { valid: output.score >= 0 && output.score <= 100, metadata };
  }
);

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // SYN-702: route-scoped auth. Accepts CRON_SECRET_COMPUTE_CONTENT_SCORES
  // if configured, else falls back to the shared CRON_SECRET (logged as a
  // warning). Per-route isolation limits blast radius if the shared secret
  // ever leaks.
  const auth = verifyCronRequest(request, 'COMPUTE_CONTENT_SCORES');
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: string;
  };

  const orgs = await prisma.organization.findMany({
    where: {
      status: 'active',
      ...(body.organizationId ? { id: body.organizationId } : {}),
    },
    select: { id: true, name: true },
  });

  const inputs: ClientInput<string>[] = orgs.map(o => ({
    clientId: o.id,
    input: o.name,
  }));

  logger.info('compute-content-scores: starting', { orgCount: orgs.length });

  const runResult = await contentScoreRunner.run(inputs);

  // Count orgs that had profiles (non-null output)
  let orgsProcessed = 0;
  let orgsSkipped = 0;
  let totalScore = 0;

  for (const { output } of runResult.outputs) {
    if (output && output.score !== undefined) {
      orgsProcessed++;
      totalScore += output.score;
    } else {
      orgsSkipped++;
    }
  }

  const avgScore =
    orgsProcessed > 0 ? Math.round(totalScore / orgsProcessed) : 0;

  logger.info('compute-content-scores: complete', {
    runId: runResult.runId,
    status: runResult.status,
    orgsProcessed,
    orgsSkipped,
    avgScore,
    durationMs: runResult.durationMs,
  });

  return NextResponse.json({
    success: true,
    runId: runResult.runId,
    status: runResult.status,
    orgsProcessed,
    orgsSkipped,
    avgScore,
    durationMs: runResult.durationMs,
  });
}
