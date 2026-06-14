/**
 * Marketing Agency Agent Run — Cancel (SYN-978).
 *
 *   POST /api/marketing-agency/runs/[id]/cancel
 *
 * Marks a queued or running MarketingAgentRun as 'cancelled'. The runner
 * doesn't poll for cancellation mid-flight (runs are short, <60s once a
 * worker picks the job up) — this endpoint serves the cases where:
 *   - A queued run hasn't started yet → cancellation prevents it
 *   - A running run finishes naturally but the DB row reflects intent
 *
 * For full mid-run interruption, a future enhancement could plumb a
 * cancellation token through runAgent (out of scope for SYN-978).
 *
 * Only cancellable when status in ('queued', 'running') — returns 409
 * with current status if already terminal (completed / failed / cancelled).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { defineRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// Per project policy: mutation routes parse body via Zod even when no body
// is expected, so future evolution stays consistent (CodeRabbit finding).
// `.nullish()` tolerates an empty/missing body (this is an action-on-resource
// endpoint) while still rejecting a non-object JSON body.
const cancelBodySchema = z.object({}).nullish();

const CANCELLABLE_STATUSES = ['queued', 'running'] as const;

export const POST = defineRoute(
  {
    body: cancelBodySchema,
    serverErrorMessage: 'Failed to cancel run',
    onError: (error) =>
      logger.error('marketing-agency:run-cancel failed', {
        error: error instanceof Error ? error.message : String(error),
      }),
  },
  async (_input, { userId, clientId, request }) => {
    const id = extractRunId(request);
    if (!id) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });

    const existing = await prisma.marketingAgentRun.findFirst({
      where: { id, organizationId: clientId },
      select: { id: true, status: true, agentId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    if (!CANCELLABLE_STATUSES.includes(existing.status as (typeof CANCELLABLE_STATUSES)[number])) {
      return NextResponse.json(
        {
          error: `Run is ${existing.status}; only queued or running runs can be cancelled`,
          currentStatus: existing.status,
        },
        { status: 409 },
      );
    }

    const now = new Date();
    // Atomic check-and-update: the WHERE filter includes the cancellable
    // statuses, so a concurrent transition to 'completed' / 'failed' /
    // 'cancelled' between the read above and this write returns count=0
    // rather than overwriting a just-terminal run. CodeRabbit finding.
    const result = await prisma.marketingAgentRun.updateMany({
      where: {
        id,
        organizationId: clientId,
        status: { in: [...CANCELLABLE_STATUSES] },
      },
      data: {
        status: 'cancelled',
        completedAt: now,
        errorMessage: `Cancelled by user ${userId} at ${now.toISOString()}`,
      },
    });
    if (result.count === 0) {
      // Re-read to give the user a precise reason.
      const fresh = await prisma.marketingAgentRun.findFirst({
        where: { id, organizationId: clientId },
        select: { status: true },
      });
      return NextResponse.json(
        {
          error: `Run transitioned to ${fresh?.status ?? 'unknown'} before cancellation; no change made`,
          currentStatus: fresh?.status ?? 'unknown',
        },
        { status: 409 },
      );
    }
    const updated = await prisma.marketingAgentRun.findFirst({
      where: { id, organizationId: clientId },
      select: { id: true, status: true, completedAt: true, agentId: true },
    });
    logger.info('marketing-agency:run-cancelled', {
      runId: id,
      agentId: existing.agentId,
      previousStatus: existing.status,
      cancelledBy: userId,
    });
    return NextResponse.json({ run: updated });
  },
);

function extractRunId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('runs');
  if (idx === -1) return null;
  return segments[idx + 1] ?? null;
}
