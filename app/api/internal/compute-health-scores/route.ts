/**
 * POST /api/internal/compute-health-scores
 *
 * Internal route invoked weekly by the Supabase Edge Function cron.
 * Computes Client Health Scores for all active orgs, persists results,
 * and posts Slack alerts for at_risk / critical transitions.
 *
 * Auth: CRON_SECRET bearer token (same pattern as other internal routes).
 * SYN-611
 */

import { NextRequest, NextResponse } from 'next/server';
import { computeAllHealthScores } from '@/lib/health-score/compute';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — may process many orgs

export async function POST(request: NextRequest) {
  // Auth gate — must match CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const start = Date.now();
  logger.info('[compute-health-scores] Starting weekly computation');

  try {
    const { processed, errors, riskTransitions } = await computeAllHealthScores();

    // Fire-and-forget Slack alerts for risk transitions
    if (riskTransitions.length > 0) {
      fireSlackAlerts(riskTransitions).catch(err =>
        logger.error('[compute-health-scores] Slack alert failed', err)
      );
    }

    const duration = Date.now() - start;
    logger.info(
      `[compute-health-scores] Done in ${duration}ms — processed: ${processed}, errors: ${errors.length}, alerts: ${riskTransitions.length}`
    );

    return NextResponse.json({
      ok: true,
      processed,
      errors: errors.length,
      riskAlerts: riskTransitions.length,
      durationMs: duration,
    });
  } catch (err) {
    logger.error('[compute-health-scores] Fatal error', err);
    return NextResponse.json({ error: 'Computation failed' }, { status: 500 });
  }
}

interface RiskTransition {
  organizationId: string;
  name: string;
  from: string | null;
  to: string | null;
}

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
