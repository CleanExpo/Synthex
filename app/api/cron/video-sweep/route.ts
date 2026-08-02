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
  settlementAmountUsd,
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
 * Reconcile stale reservations (SYN-1115, round-7).
 *
 * The sweep no longer GUESSES what a dead run cost. It reads that run's
 * provider attempts:
 *
 *   - no attempts        -> nothing reached a provider, settle at 0;
 *   - attempts recorded  -> settle at what they cost, so a run that paid and
 *                           then died is charged rather than written off.
 *
 * That is the round-5/6 erase defect closed at its root. Previously the sweep
 * appended `-heldUsd` for any reservation that merely looked old or whose owner
 * row looked terminal, which recorded ZERO for calls the provider had already
 * billed. The liveness check is kept as a second guard so an in-flight run is
 * not settled early, but it is no longer the only thing standing between a paid
 * call and a write-off.
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
      // What this run actually cost, from its attempts. An attempt with an
      // unknown cost falls back to the reservation's own rate rather than zero.
      const actualUsd = await settlementAmountUsd(
        reservation.holdId,
        reservation.heldUsd
      );

      const wrote = await finalizeSpend({
        holdId: reservation.holdId,
        organizationId: reservation.organizationId,
        initiatedBy: reservation.initiatedBy,
        heldUsd: reservation.heldUsd,
        actualUsd,
        // 'sweep' shares the finalize key with settle and release, so a real
        // settlement that lands first always wins.
        kind: 'sweep',
      });
      if (wrote) {
        reconciled++;
        if (actualUsd > 0) {
          logger.warn('media spend sweep charged a dead run for real spend', {
            holdId: reservation.holdId,
            actualUsd,
          });
        }
      }
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
