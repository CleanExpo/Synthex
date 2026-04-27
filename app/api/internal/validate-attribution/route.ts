/**
 * POST /api/internal/validate-attribution
 *
 * Runs the multi-touch attribution engine across every organisation with at
 * least one verified lead inside the lookback window and reports a single
 * aggregate accuracy score.
 *
 *   accuracy_score = matched_attributed_revenue / total_verified_revenue
 *
 * Where:
 *   - total_verified_revenue  = Σ Lead.verifiedRevenueAud for leads in window
 *   - matched_attributed_revenue = Σ revenue attributed to ≥ 1 touchpoint
 *
 * The row-completeness score from the previous stub is preserved as a
 * secondary metric (completeness_score) so operators can still see how many
 * RecommendedAction rows have attribution context populated.
 *
 * Auth: CRON_SECRET bearer token (per-route scoping via verifyCronRequest).
 * SYN-622 | SYN-795
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createEdgeFunctionRunner } from '@/lib/pipelines/runner';
import type { AttributionMetadata } from '@/lib/pipelines/metadata-schemas';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { compute } from '@/lib/attribution/compute';
import type { AttributionModel } from '@/lib/attribution/engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── Input schema ──────────────────────────────────────────────────────────────

const ModelEnum = z.enum(['first-touch', 'last-touch', 'linear', 'time-decay']);

const BodySchema = z
  .object({
    days: z.number().int().min(1).max(30).optional(),
    model: ModelEnum.optional(),
  })
  .strict();

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttributionValidationInput {
  days: number;
  model: AttributionModel;
}

interface AttributionValidationOutput {
  matched_revenue_aud: number;
  total_revenue_aud: number;
  leads_considered: number;
  leads_matched: number;
  completeness_matched: number;
  completeness_total: number;
}

// ── Runner ────────────────────────────────────────────────────────────────────

const attributionRunner = createEdgeFunctionRunner<
  AttributionValidationInput,
  AttributionValidationOutput
>(
  'attribution-validation',
  async (
    input: AttributionValidationInput
  ): Promise<AttributionValidationOutput> => {
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - input.days * 86_400_000);

    // Organisations with at least one verified lead in window.
    const orgRows = await prisma.lead.findMany({
      where: {
        occurredAt: { gte: windowStart, lte: windowEnd },
        verifiedRevenueAud: { not: null },
      },
      select: { organizationId: true },
      distinct: ['organizationId'],
    });

    let matched_revenue_aud = 0;
    let total_revenue_aud = 0;
    let leads_considered = 0;
    let leads_matched = 0;

    for (const { organizationId } of orgRows) {
      const result = await compute({
        organizationId,
        windowStart,
        windowEnd,
        model: input.model,
      });

      total_revenue_aud += result.totalLeadRevenueAud;
      matched_revenue_aud += result.matchedAttributedRevenueAud;
      leads_considered += result.leadCount;
      leads_matched += result.attributions.filter(
        a => a.touchpoints.length > 0
      ).length;
    }

    // Completeness (legacy): fraction of recommended_actions rows in window
    // that have a populated attributionContext. Reported alongside as a
    // secondary diagnostic — not the gate.
    const [completeness_total, completeness_matched] = await Promise.all([
      prisma.recommendedAction.count({
        where: { createdAt: { gte: windowStart } },
      }),
      prisma.recommendedAction.count({
        where: {
          createdAt: { gte: windowStart },
          NOT: { attributionContext: { equals: {} } },
        },
      }),
    ]);

    return {
      matched_revenue_aud,
      total_revenue_aud,
      leads_considered,
      leads_matched,
      completeness_matched,
      completeness_total,
    };
  },
  (
    output: AttributionValidationOutput
  ): { valid: boolean; metadata: Record<string, unknown> } => {
    const accuracy_score =
      output.total_revenue_aud > 0
        ? output.matched_revenue_aud / output.total_revenue_aud
        : 0;

    const completeness_score =
      output.completeness_total > 0
        ? output.completeness_matched / output.completeness_total
        : 0;

    // Gate: >= 0.80. Zero leads is treated as a non-failure (no data yet).
    const valid = output.total_revenue_aud === 0 || accuracy_score >= 0.8;

    const metadata: AttributionMetadata & {
      completeness_score: number;
      leads_considered: number;
      leads_matched: number;
    } = {
      accuracy_score,
      matched_events: output.leads_matched,
      total_events: output.leads_considered,
      unmatched_reasons: {
        no_touchpoints: output.leads_considered - output.leads_matched,
      },
      completeness_score,
      leads_considered: output.leads_considered,
      leads_matched: output.leads_matched,
    };

    return { valid, metadata };
  }
);

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'VALIDATE_ATTRIBUTION');
  if (!auth.ok) return auth.response;

  const rawBody: unknown = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const days = parsed.data.days ?? 7;
  const model: AttributionModel = parsed.data.model ?? 'time-decay';

  const runResult = await attributionRunner.run([
    { clientId: 'all-orgs', input: { days, model } },
  ]);

  const output = runResult.outputs[0]?.output;
  const accuracy_score =
    output && output.total_revenue_aud > 0
      ? output.matched_revenue_aud / output.total_revenue_aud
      : null;
  const completeness_score =
    output && output.completeness_total > 0
      ? output.completeness_matched / output.completeness_total
      : null;

  logger.info('[validate-attribution] Run complete', {
    runId: runResult.runId,
    status: runResult.status,
    model,
    accuracy_score,
    completeness_score,
    leads_considered: output?.leads_considered ?? 0,
    leads_matched: output?.leads_matched ?? 0,
    durationMs: runResult.durationMs,
  });

  return NextResponse.json({
    ok: true,
    runId: runResult.runId,
    status: runResult.status,
    model,
    accuracy_score,
    completeness_score,
    leads_considered: output?.leads_considered ?? 0,
    leads_matched: output?.leads_matched ?? 0,
    matched_revenue_aud: output?.matched_revenue_aud ?? 0,
    total_revenue_aud: output?.total_revenue_aud ?? 0,
    durationMs: runResult.durationMs,
  });
}
