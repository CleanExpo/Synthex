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
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const CANCELLABLE_STATUSES = new Set(['queued', 'running']);

export const POST = withAuth(async (request, { userId, clientId }) => {
  const id = extractRunId(request);
  if (!id) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });

  const existing = await prisma.marketingAgentRun.findFirst({
    where: { id, organizationId: clientId },
    select: { id: true, status: true, agentId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  if (!CANCELLABLE_STATUSES.has(existing.status)) {
    return NextResponse.json(
      {
        error: `Run is ${existing.status}; only queued or running runs can be cancelled`,
        currentStatus: existing.status,
      },
      { status: 409 },
    );
  }

  try {
    const now = new Date();
    const updated = await prisma.marketingAgentRun.update({
      where: { id },
      data: {
        status: 'cancelled',
        completedAt: now,
        errorMessage: `Cancelled by user ${userId} at ${now.toISOString()}`,
      },
      select: { id: true, status: true, completedAt: true, agentId: true },
    });
    logger.info('marketing-agency:run-cancelled', {
      runId: id,
      agentId: existing.agentId,
      previousStatus: existing.status,
      cancelledBy: userId,
    });
    return NextResponse.json({ run: updated });
  } catch (error) {
    logger.error('marketing-agency:run-cancel failed', {
      runId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to cancel run' }, { status: 500 });
  }
});

function extractRunId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('runs');
  if (idx === -1) return null;
  return segments[idx + 1] ?? null;
}
