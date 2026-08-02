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
import { releaseQuota, settleQuota } from '@/lib/services/ai/video/quota';
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
      providerJobId: true,
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
      // A RELEASE here is only correct when nothing was billed, and this used
      // to release EVERY stale job in full. A release takes the shared
      // `hold:{id}:final` key, and reconcileStaleReservations — which runs
      // after this loop and skips holds that already carry a terminal event —
      // could therefore never see the hold. The submitted-call floor added for
      // exactly this case was unreachable in production, so a stale job with a
      // provider job id and a lost attempt row had its paid submit refunded
      // (SYN-1115 round-8).
      //
      // `providerJobId` is the discriminator, and it is durable: fal returned
      // it, so a submit was accepted and may be billed whether or not the
      // attempt row survived. No provider job id means nothing was accepted,
      // and the hold is genuinely owed back.
      const heldUsd = Number(row.estimatedCostUsd ?? 0);
      const initiatedBy = (row.initiatedBy ?? 'studio') as InitiatedBy;
      await Promise.resolve(
        row.spendHoldId
          ? row.providerJobId
            ? settlementAmountUsd(row.spendHoldId, heldUsd, 1).then(actualUsd =>
                settleQuota(
                  row.organizationId as string,
                  row.spendHoldId as string,
                  heldUsd,
                  actualUsd,
                  initiatedBy
                )
              )
            : releaseQuota(
                row.organizationId,
                row.spendHoldId,
                heldUsd,
                initiatedBy
              )
          : Promise.resolve(false)
      ).catch(e =>
        logger.error('sweep quota finalise failed', { rowId: row.id, e })
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
      //
      // The floor is what the DATABASE can prove independently of the attempt
      // table: a linked video job holding a provider job id means fal accepted
      // a submit, so at least one call happened whether or not its attempt row
      // survived. Without that, a lost write made a paid call settle at zero
      // (SYN-1115 round-8).
      //
      // NO OWNER ROW AT ALL is a different case, not a stronger version of the
      // same one. An image reservation never has one — image generation is
      // synchronous and settles in-process — so its `submittedToProvider` is
      // false for want of a link, not because nothing was submitted. Reading
      // that as "nothing reached a provider" would permanently finalise a paid
      // hold at $0 whenever a request died after calling a provider and its
      // attempt write was lost too.
      //
      // WHAT the hold was for now decides the no-evidence answer, which is
      // what the earlier attempts at this lacked. Charging every unlinked hold
      // its reservation was reverted because "no owner row" did not mean
      // "image": a video hold stranded before its row was created has none
      // either, and charging those turned unspent holds into recorded spend.
      //
      //   video  -> absence is PROVABLE either way. With an owner row, a null
      //             provider job id means fal never accepted a submit; with no
      //             owner row at all, the submit loop never got far enough to
      //             create one. Settle at 0.
      //   image  -> synchronous and never linked, so absence proves nothing. A
      //             request that called a provider and died with its attempt
      //             writes lost is indistinguishable from one that spent
      //             nothing. Charge the reservation.
      //   unknown (reserved before media_type existed) -> same as image.
      //
      // Settling at zero is not a mere accuracy loss: spend is derived as
      // SUM(delta_usd), so forgetting real spend RETURNS the headroom and admits
      // further work beyond the cap (release review, pass 2).
      const noEvidenceUsd =
        reservation.mediaType === 'video' ? 0 : reservation.heldUsd;

      const actualUsd = await settlementAmountUsd(
        reservation.holdId,
        reservation.heldUsd,
        reservation.submittedToProvider ? 1 : 0,
        noEvidenceUsd
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
