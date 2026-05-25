/**
 * Marketing Agency Agents — Cadence Cron.
 *
 * GET /api/cron/marketing-agents
 * Runs every 5 minutes via Vercel Cron (configured in vercel.json).
 *
 * For each active MarketingAgent whose cadence is due, enqueues a
 * MARKETING_AGENT_RUN job. Idempotent on duplicate fires (interval math
 * is "lastRunAt + interval < now", so back-to-back fires within the
 * interval are no-ops). Auth via verifyCronRequest with per-route
 * secret CRON_SECRET_MARKETING_AGENTS (falls back to shared CRON_SECRET).
 *
 * Why a small interval (5 min) for hourly/daily/weekly cadences:
 *   - hourly agents need promptness — 5-min granularity is the smallest
 *     useful tick before scheduler overhead dominates
 *   - daily/weekly agents only fire when due; the 5-min tick is harmless
 *     because the cadence math gates each agent independently
 *
 * The route is gated to maxDuration=60 — we only enqueue here, never
 * run. Enqueueing is microseconds per agent.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import {
  queueMarketingAgentRun,
  registerMarketingAgentHandler,
} from '@/lib/marketing-agency/agent/queue-handler';
import { selectDueAgents } from '@/lib/marketing-agency/agent/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Idempotent — registers the handler once per process so when the worker
// scoops up the job later it knows what to do.
registerMarketingAgentHandler();

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'MARKETING_AGENTS');
  if (!auth.ok) return auth.response;

  const startedAt = Date.now();
  logger.info('cron:marketing-agents:start', { startedAt: new Date().toISOString() });

  try {
    // Pull only the candidate set — agents with a non-manual cadence and
    // active status. Cadence math runs in pure-function selectDueAgents.
    const candidates = await prisma.marketingAgent.findMany({
      where: {
        status: 'active',
        cadence: { in: ['hourly', 'daily', 'weekly'] },
      },
      select: {
        id: true,
        organizationId: true,
        createdById: true,
        cadence: true,
        status: true,
        lastRunAt: true,
      },
    });

    const due = selectDueAgents(candidates);

    if (due.length === 0) {
      logger.info('cron:marketing-agents:none-due', {
        candidates: candidates.length,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json({
        candidates: candidates.length,
        enqueued: 0,
        durationMs: Date.now() - startedAt,
      });
    }

    let enqueued = 0;
    let failed = 0;
    for (const item of due) {
      try {
        const job = await queueMarketingAgentRun({
          agentId: item.agentId,
          triggeredById: item.triggeredById,
          trigger: item.trigger,
        });
        // Update nextRunAt so the UI shows the user when to expect the next run.
        // We do NOT update lastRunAt here — only the runner updates that after
        // a successful completion, so a queued-but-not-yet-run cycle won't
        // accidentally suppress the next tick.
        await prisma.marketingAgent.update({
          where: { id: item.agentId },
          data: { nextRunAt: item.nextRunAt },
        });
        enqueued++;
        logger.info('cron:marketing-agents:enqueued', {
          agentId: item.agentId,
          jobId: job.id,
          trigger: item.trigger,
          nextRunAt: item.nextRunAt.toISOString(),
        });
      } catch (err) {
        failed++;
        logger.error('cron:marketing-agents:enqueue-failed', {
          agentId: item.agentId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      candidates: candidates.length,
      enqueued,
      failed,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error('cron:marketing-agents:fatal', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: 'Scheduler failed' }, { status: 500 });
  }
}
