/**
 * Cron sweep: any generative job still 'generating' after 30 min lost its
 * webhook — mark failed with a diagnostic and release the quota hold.
 * Transitions are atomic (status-guarded updateMany) so a late webhook and
 * the sweep can never both settle the same job.
 *
 * vercel.json schedule: "* /15 * * * *"  (every 15 min)
 * @task SYN-971
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { releaseQuota } from '@/lib/services/ai/video/quota';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { InitiatedBy } from '@/lib/services/ai/video/types';
import {
  finalizeSpend,
  findStaleReservations,
} from '@/lib/services/ai/image/spend-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STALE_MINUTES = 30;

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = verifyCronRequest(request, 'VIDEO_SWEEP');
  if (!auth.ok) return auth.response;

  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

  const stale = await prisma.videoGeneration.findMany({
    where: {
      mode: 'generative',
      status: 'generating',
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      organizationId: true,
      estimatedCostUsd: true,
      initiatedBy: true,
      spendHoldId: true,
    },
    take: 200,
  });

  if (stale.length === 200) {
    logger.warn(
      'video sweep hit the 200-row cap — backlog larger than one pass'
    );
  }

  let swept = 0;

  for (const row of stale) {
    // Atomic + idempotent: only win the race when the row is still 'generating'.
    const transitioned = await prisma.videoGeneration.updateMany({
      where: { id: row.id, status: 'generating' },
      data: {
        status: 'failed',
        errorMessage: `No provider webhook within ${STALE_MINUTES} minutes (sweep)`,
      },
    });

    // count === 0 means a concurrent webhook (or another sweep) already settled
    // the job — skip quota release; the winning path owns it.
    if (transitioned.count === 0) continue;

    swept++;

    if (row.organizationId) {
      await Promise.resolve(
        row.spendHoldId
          ? releaseQuota(
              row.organizationId,
              row.spendHoldId,
              Number(row.estimatedCostUsd ?? 0),
              (row.initiatedBy ?? 'studio') as InitiatedBy
            )
          : Promise.resolve(false)
      ).catch(e =>
        logger.error('sweep quota release failed', { rowId: row.id, e })
      );
    } else {
      logger.error('swept job has no organizationId — quota not released', {
        rowId: row.id,
      });
    }
  }

  if (swept > 0) logger.warn('video sweep failed stale jobs', { count: swept });

  const reconciledHolds = await reconcileStaleReservations(cutoff);

  return NextResponse.json({ swept, reconciledHolds });
}

/**
 * Reconcile stale reservations in the append-only spend log (SYN-1115).
 *
 * A `reserve` event with no terminal event, older than the stale threshold,
 * means the settling process died. Appending a `sweep` finalize returns the
 * headroom.
 *
 * This is safe in a way the previous counter-based sweep was not. That version
 * released the hold and could therefore subtract spend that had actually
 * happened, and could race a real settlement into a double-subtract. Here every
 * terminal event — settle, release and sweep alike — shares one key per hold,
 * so if a genuine settlement landed first this insert conflicts and no-ops. The
 * sweep can only ever act on a reservation nothing else has closed.
 */
async function reconcileStaleReservations(cutoff: Date): Promise<number> {
  const stale = await findStaleReservations(cutoff);

  if (stale.length === 200) {
    logger.warn(
      'media spend sweep hit the 200-row cap — backlog larger than one pass'
    );
  }

  let reconciled = 0;
  for (const reservation of stale) {
    try {
      const wrote = await finalizeSpend({
        holdId: reservation.holdId,
        organizationId: reservation.organizationId,
        initiatedBy: reservation.initiatedBy,
        heldUsd: reservation.heldUsd,
        kind: 'sweep',
      });
      if (wrote) reconciled++;
    } catch (error) {
      // Nothing to unwind — an append either happened or it did not. The next
      // pass retries because the reservation is still unterminated.
      logger.error(
        'media spend sweep failed to finalise — retrying next pass',
        {
          holdId: reservation.holdId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  if (reconciled > 0) {
    logger.warn('media spend sweep finalised stale reservations', {
      count: reconciled,
    });
  }
  return reconciled;
}
