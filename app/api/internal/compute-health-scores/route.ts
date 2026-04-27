/**
 * POST /api/internal/compute-health-scores
 *
 * Internal route invoked weekly by the Supabase Edge Function cron.
 * Computes Client Health Scores for all active orgs, persists results,
 * and posts Slack alerts for at_risk / critical transitions.
 *
 * Auth: CRON_SECRET bearer token (same pattern as other internal routes).
 * SYN-611 | Observability: SYN-627
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEdgeFunctionRunner, ClientInput } from '@/lib/pipelines/runner';
import type { HealthScoreMetadata } from '@/lib/pipelines/metadata-schemas';
import {
  computeHealthScore,
  saveHealthScore,
  ComputedHealthScore,
} from '@/lib/health-score/compute';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — may process many orgs

// ── Types ─────────────────────────────────────────────────────────────────────

interface RiskTransition {
  organizationId: string;
  name: string;
  from: string | null;
  to: string | null;
}

// ── Runner ────────────────────────────────────────────────────────────────────

const healthScoreRunner = createEdgeFunctionRunner<string, ComputedHealthScore>(
  'health-score',
  async (_orgName: string, clientId: string): Promise<ComputedHealthScore> => {
    const result = await computeHealthScore(clientId);
    await saveHealthScore(result);
    return result;
  },
  (
    output: ComputedHealthScore
  ): { valid: boolean; metadata: Record<string, unknown> } => {
    const dimensionScores = Object.fromEntries(
      Object.entries(output.dimensions)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, v!.score])
    ) as Record<string, number>;

    const allInBounds = Object.values(dimensionScores).every(
      s => s >= 0 && s <= 100
    );
    const compositeOk =
      output.overallScore === null ||
      (output.overallScore >= 0 && output.overallScore <= 100);

    const metadata: HealthScoreMetadata = {
      dimension_scores: dimensionScores,
      composite_score: output.overallScore ?? 0,
      // Per-org contribution: 1 if below threshold, 0 otherwise
      clients_below_threshold:
        output.overallScore !== null && output.overallScore < 35 ? 1 : 0,
    };

    return { valid: allInBounds && compositeOk, metadata };
  }
);

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'COMPUTE_HEALTH_SCORES');
  if (!auth.ok) return auth.response;

  const orgs = await prisma.organization.findMany({
    where: { status: 'active' },
    select: { id: true, name: true },
  });

  // Pre-fetch previous risk levels for transition detection (post-run comparison)
  const prevRiskMap = new Map<string, string | null>();
  await Promise.all(
    orgs.map(async org => {
      const prev = await prisma.clientHealthScore.findFirst({
        where: { organizationId: org.id },
        orderBy: { weekStart: 'desc' },
        select: { riskLevel: true },
      });
      prevRiskMap.set(org.id, prev?.riskLevel ?? null);
    })
  );

  const inputs: ClientInput<string>[] = orgs.map(o => ({
    clientId: o.id,
    input: o.name,
  }));

  const runResult = await healthScoreRunner.run(inputs);

  // Detect risk transitions from successful outputs
  const riskTransitions: RiskTransition[] = [];
  for (const { clientId, output } of runResult.outputs) {
    if (!output) continue;
    const org = orgs.find(o => o.id === clientId);
    const prevRisk = prevRiskMap.get(clientId) ?? null;
    const newRisk = output.riskLevel;
    if (
      newRisk !== prevRisk &&
      (newRisk === 'at_risk' || newRisk === 'critical')
    ) {
      riskTransitions.push({
        organizationId: clientId,
        name: org?.name ?? clientId,
        from: prevRisk,
        to: newRisk,
      });
    }
  }

  if (riskTransitions.length > 0) {
    fireSlackAlerts(riskTransitions).catch(err =>
      logger.error('[compute-health-scores] Slack alert failed', err)
    );
  }

  logger.info('[compute-health-scores] Run complete', {
    runId: runResult.runId,
    status: runResult.status,
    processed: runResult.clientsProcessed,
    failed: runResult.clientsFailed,
    riskAlerts: riskTransitions.length,
    durationMs: runResult.durationMs,
  });

  return NextResponse.json({
    ok: true,
    runId: runResult.runId,
    status: runResult.status,
    processed: runResult.clientsProcessed,
    errors: runResult.clientsFailed,
    riskAlerts: riskTransitions.length,
    durationMs: runResult.durationMs,
  });
}

// ── Slack alerts ──────────────────────────────────────────────────────────────

async function fireSlackAlerts(transitions: RiskTransition[]): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  for (const t of transitions) {
    const emoji = t.to === 'critical' ? '🚨' : '⚠️';
    const message = {
      text: `${emoji} *Client Health Alert* — ${t.name}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *Client Health Alert*\n*Client:* ${t.name}\n*Status:* ${t.from ?? 'new'} → *${t.to}*\n\nReview in the <${process.env.NEXT_PUBLIC_APP_URL}/admin/health|Admin Health Dashboard>.`,
          },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  }
}
