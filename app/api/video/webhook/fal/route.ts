/**
 * fal.ai completion webhook. Token-authenticated URL (FAL_WEBHOOK_SECRET).
 * Idempotent on providerJobId: repeat webhooks for settled rows are 200 no-ops.
 * Always 200 for unknown ids — non-200 makes fal retry forever.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  verifyWebhookToken,
  parseFalWebhook,
} from '@/lib/services/ai/video/fal-adapter';
import { settleQuota, releaseQuota } from '@/lib/services/ai/video/quota';
import { captureServerException } from '@/lib/observability/sentry-server';
import {
  recordAttempt,
  videoAttemptKey,
} from '@/lib/services/ai/image/spend-log';
import { storeArtifact } from '@/lib/services/ai/video/artifact-store';
import { VIDEO_MODELS } from '@/lib/services/ai/video/registry';
import { InitiatedBy } from '@/lib/services/ai/video/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function objectMetadata(meta: unknown): Record<string, unknown> {
  return meta !== null && typeof meta === 'object' && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

/**
 * A generation row reached settlement with no owning organisation (SYN-1115).
 *
 * Previously all three call sites logged and continued, which meant real
 * provider spend silently escaped every quota counter — the money moved and
 * nothing reclaimed it. Money movement must never no-op quietly, so this
 * raises a Sentry event and returns 500.
 *
 * The 500 is deliberate and is the one exception to this route's
 * "always 200 so fal stops retrying" rule: a retry is exactly what we want
 * while the row is unattributable, and a red webhook is visible where a log
 * line was not.
 *
 * Called BEFORE any status transition, so the row stays in 'generating' and
 * remains re-processable on every retry — the invariant from review finding 4.
 * `image_generations.organization_id` is NOT NULL as of this ticket;
 * `video_generations` still permits null, so this path stays reachable until
 * that column is tightened too (harden-next item 1).
 */
function unattributableSpend(
  rowId: string,
  operation: 'settle' | 'release',
  amountUsd: number
): NextResponse {
  const error = new Error(
    `Video generation ${rowId} has no organizationId — quota ${operation} of ` +
      `$${amountUsd.toFixed(4)} is unattributable and did not happen.`
  );
  logger.error('unattributable media spend', {
    rowId,
    operation,
    amountUsd,
  });
  captureServerException(error, {
    operation: `video/webhook-${operation}`,
    level: 'error',
    tags: { code: 'unattributable_spend', rowId },
    extra: { amountUsd },
  });
  return NextResponse.json(
    { error: 'unattributable spend', rowId },
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  if (!verifyWebhookToken(request.nextUrl.searchParams.get('token'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Fix 3: guard against malformed JSON bodies
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logger.warn('fal webhook with unparseable body');
    return NextResponse.json({ ok: true, unparseable: true });
  }
  const result = parseFalWebhook(body);

  const row = await prisma.videoGeneration.findFirst({
    where: { providerJobId: result.providerJobId, mode: 'generative' },
  });
  if (!row) {
    logger.warn('fal webhook for unknown job', {
      providerJobId: result.providerJobId,
    });
    return NextResponse.json({ ok: true, unknown: true });
  }

  const heldUsd = Number(row.estimatedCostUsd ?? 0);
  const initiatedBy = (row.initiatedBy ?? 'studio') as InitiatedBy;

  // INVARIANT (SYN-1115, review finding 4): a settlement that cannot happen
  // must never be consumed by the idempotency transition.
  //
  // The first version of this fix transitioned the row to 'rendered'/'failed'
  // and only THEN returned 500. fal's retry then hit the status guard, matched
  // zero rows, and returned 200 idempotent without ever re-reaching the
  // settlement — so the spend still escaped every counter permanently and was
  // merely reported once. Refusing BEFORE any write leaves the row in
  // 'generating', which keeps it visible to this handler on every retry and to
  // the video-sweep cron, until it is settled or manually resolved.
  //
  // The guard fires on a missing org AND a live hold. It used to fire on the
  // missing org alone, which was too wide: every spend operation below is
  // gated on `row.spendHoldId`, and holds are created from
  // `req.organizationId` (generation-service.ts), so a row with no org has no
  // hold either — it predates this branch. For those rows the 500 protected no
  // money while blocking the 'rendered' transition and the videoUrl write, so a
  // video fal had produced AND billed was discarded, and fal retried until it
  // gave up (CodeRabbit review of PR #820, confirmed against the submit path).
  if (!row.organizationId && row.spendHoldId) {
    return unattributableSpend(
      row.id,
      result.ok && result.videoUrl ? 'settle' : 'release',
      heldUsd
    );
  }

  // Derived OUTSIDE the try below: a successful webhook means fal completed and
  // billed the generation, so this figure is owed whether or not our own
  // download and storage then succeed (release review, pass 2).
  const spec = VIDEO_MODELS.find(m => m.id === row.model);
  const actualUsd = spec
    ? Math.round(spec.costPerSecondUsd * (row.durationSeconds ?? 6) * 10000) /
      10000
    : heldUsd;

  if (result.ok && result.videoUrl) {
    try {
      const { storedUrl } = await storeArtifact({
        sourceUrl: result.videoUrl,
        userId: row.userId,
        rowId: row.id,
        prompt: row.enhancedPrompt ?? undefined,
        metadata: { model: row.model, batchGroupId: row.batchGroupId },
      });

      // Atomic status-guarded transition — prevents double-processing.
      const transitioned = await prisma.videoGeneration.updateMany({
        where: { id: row.id, status: 'generating' },
        data: {
          status: 'rendered',
          videoUrl: storedUrl,
          actualCostUsd: actualUsd,
          metadata: {
            ...objectMetadata(row.metadata),
            providerUrl: result.videoUrl,
          },
        },
      });
      if (transitioned.count === 0) {
        return NextResponse.json({ ok: true, idempotent: true });
      }
      // Record what this specific job actually cost (SYN-1115 round-7), so
      // settlement and the sweep read evidence instead of guessing.
      if (row.spendHoldId && row.organizationId) {
        await recordAttempt({
          attemptKey: videoAttemptKey(row.spendHoldId, result.providerJobId),
          holdId: row.spendHoldId,
          organizationId: row.organizationId,
          mediaType: 'video',
          provider: 'fal',
          modelId: row.model ?? 'unknown',
          status: 'succeeded',
          costUsd: actualUsd,
          providerJobId: row.providerJobId ?? undefined,
        }).catch(e =>
          logger.error('could not record video attempt outcome', { e })
        );
      }

      // Finalise the reservation. Keyed on the hold, so a replayed webhook
      // conflicts on the unique index and no-ops — the compensating unclaim
      // this route used to need is gone (SYN-1115 round-6).
      if (row.spendHoldId && row.organizationId) {
        await settleQuota(
          row.organizationId,
          row.spendHoldId,
          heldUsd,
          actualUsd,
          initiatedBy
        );
      }
    } catch (err) {
      logger.error('artifact persistence failed', { rowId: row.id, err });

      const transitioned = await prisma.videoGeneration.updateMany({
        where: { id: row.id, status: 'generating' },
        data: {
          status: 'failed',
          errorMessage: 'artifact download/storage failed',
          metadata: {
            ...objectMetadata(row.metadata),
            providerUrl: result.videoUrl,
          },
        },
      });
      if (transitioned.count === 0) {
        return NextResponse.json({ ok: true, idempotent: true });
      }
      if (row.spendHoldId && row.organizationId) {
        // SETTLE, do not release. This branch is reached only from a SUCCESSFUL
        // fal webhook — the provider completed the generation and billed for
        // it; what failed is OUR download or storage. Releasing handed the
        // money back, took the hold's terminal key so nothing could correct it,
        // and reopened daily and monthly admission headroom for spend that
        // really happened (release review, pass 2).
        //
        // The artifact is lost, which is a product failure worth the 'failed'
        // status above; the spend is not, and the two are separate facts.
        await settleQuota(
          row.organizationId,
          row.spendHoldId,
          heldUsd,
          actualUsd,
          initiatedBy
        );
      }
    }
  } else {
    const transitioned = await prisma.videoGeneration.updateMany({
      where: { id: row.id, status: 'generating' },
      data: {
        status: 'failed',
        errorMessage: result.isPolicyRejection
          ? `Prompt rejected by provider content policy: ${result.errorMessage}`
          : result.errorMessage,
      },
    });
    if (transitioned.count === 0) {
      return NextResponse.json({ ok: true, idempotent: true });
    }
    if (row.spendHoldId && row.organizationId) {
      await releaseQuota(
        row.organizationId,
        row.spendHoldId,
        heldUsd,
        initiatedBy
      );
    }
  }

  return NextResponse.json({ ok: true });
}
