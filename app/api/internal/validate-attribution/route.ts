/**
 * POST /api/internal/validate-attribution
 *
 * Internal route invoked daily by the validate-attribution Supabase Edge Function.
 * Validates the attribution model accuracy by checking what fraction of
 * recommended_actions records in the last N days have a populated attributionContext.
 *
 * The accuracy_score is the key metric written to edge_function_logs.output_metadata.
 * CI gate for Sprint 6 ROI Dashboard deployment blocks if:
 *   AVG(output_metadata->>'accuracy_score') < 0.80 over last 7 days.
 *
 * Auth: CRON_SECRET bearer token.
 * SYN-622 | Observability: SYN-627
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEdgeFunctionRunner } from '@/lib/pipelines/runner';
import type { AttributionMetadata } from '@/lib/pipelines/metadata-schemas';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttributionValidationInput {
  /** Lookback window in days (default: 7) */
  days: number;
}

interface AttributionValidationOutput {
  matched_events: number;
  total_events: number;
  unmatched_reasons: Record<string, number>;
}

// ── Runner ────────────────────────────────────────────────────────────────────

/**
 * Single aggregate run — the CI gate query targets output_metadata->>'accuracy_score'
 * as a scalar, so we use clientId = 'all-orgs' rather than per-org inputs.
 */
const attributionRunner = createEdgeFunctionRunner<
  AttributionValidationInput,
  AttributionValidationOutput
>(
  'attribution-validation',
  async (input: AttributionValidationInput): Promise<AttributionValidationOutput> => {
    const since = new Date();
    since.setDate(since.getDate() - input.days);

    const [total, matched] = await Promise.all([
      prisma.recommendedAction.count({
        where: { createdAt: { gte: since } },
      }),
      prisma.recommendedAction.count({
        where: {
          createdAt: { gte: since },
          NOT: { attributionContext: { equals: {} } },
        },
      }),
    ]);

    const unmatched_reasons: Record<string, number> = {
      no_attribution_context: total - matched,
    };

    return { matched_events: matched, total_events: total, unmatched_reasons };
  },
  (output: AttributionValidationOutput): { valid: boolean; metadata: Record<string, unknown> } => {
    const accuracy_score =
      output.total_events > 0
        ? output.matched_events / output.total_events
        : 0;

    // Gate: >= 0.80 to unblock Sprint 6 ROI Dashboard (SYN-622)
    // Zero total events is valid — no data yet, not a failure
    const valid = output.total_events === 0 || accuracy_score >= 0.80;

    const metadata: AttributionMetadata = {
      accuracy_score,
      matched_events: output.matched_events,
      total_events: output.total_events,
      unmatched_reasons: output.unmatched_reasons,
    };

    return { valid, metadata };
  }
);

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    days?: number;
  };
  const days = Math.min(Math.max(body.days ?? 7, 1), 30);

  const runResult = await attributionRunner.run([
    { clientId: 'all-orgs', input: { days } },
  ]);

  const output = runResult.outputs[0]?.output;
  const accuracy_score =
    output && output.total_events > 0
      ? output.matched_events / output.total_events
      : null;

  logger.info('[validate-attribution] Run complete', {
    runId: runResult.runId,
    status: runResult.status,
    accuracy_score,
    matched_events: output?.matched_events ?? 0,
    total_events: output?.total_events ?? 0,
    durationMs: runResult.durationMs,
  });

  return NextResponse.json({
    ok: true,
    runId: runResult.runId,
    status: runResult.status,
    accuracy_score,
    matched_events: output?.matched_events ?? 0,
    total_events: output?.total_events ?? 0,
    durationMs: runResult.durationMs,
  });
}
