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
  if (!row.organizationId) {
    return unattributableSpend(
      row.id,
      result.ok && result.videoUrl ? 'settle' : 'release',
      heldUsd
    );
  }

  if (result.ok && result.videoUrl) {
    try {
      const { storedUrl } = await storeArtifact({
        sourceUrl: result.videoUrl,
        userId: row.userId,
        rowId: row.id,
        prompt: row.enhancedPrompt ?? undefined,
        metadata: { model: row.model, batchGroupId: row.batchGroupId },
      });

      const spec = VIDEO_MODELS.find(m => m.id === row.model);
      const actualUsd = spec
        ? Math.round(
            spec.costPerSecondUsd * (row.durationSeconds ?? 6) * 10000
          ) / 10000
        : heldUsd;

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
      const settled = await settleOrUnclaim(row.id, 'settle', () =>
        settleQuota(row.organizationId!, heldUsd, actualUsd, initiatedBy)
      );
      if (settled) return settled;
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
      const released = await settleOrUnclaim(row.id, 'release', () =>
        releaseQuota(row.organizationId!, heldUsd, initiatedBy)
      );
      if (released) return released;
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
    const released = await settleOrUnclaim(row.id, 'release', () =>
      releaseQuota(row.organizationId!, heldUsd, initiatedBy)
    );
    if (released) return released;
  }

  return NextResponse.json({ ok: true });
}

/**
 * Run a quota mutation AFTER the row has been claimed, and UNCLAIM it if the
 * mutation fails (SYN-1115, round-2 review finding 3).
 *
 * The status transition is this route's idempotency guard, so it must come
 * first — settling before it would double-settle on every provider retry, which
 * the concurrency tests catch. But that ordering used to consume retryability:
 * a transient quota failure left the row terminal, so the retry matched zero
 * rows, returned 200, and the hold was stranded for good.
 *
 * The compensating revert closes both: the row goes back to 'generating' so the
 * next retry re-reaches the mutation, and a 500 asks the provider for that
 * retry. Returns a response when the caller should stop, or null on success.
 */
async function settleOrUnclaim(
  rowId: string,
  operation: 'settle' | 'release',
  mutate: () => Promise<unknown>
): Promise<NextResponse | null> {
  try {
    await mutate();
    return null;
  } catch (error) {
    logger.error('quota mutation failed after claim — unclaiming for retry', {
      rowId,
      operation,
      error: error instanceof Error ? error.message : String(error),
    });
    await prisma.videoGeneration
      .updateMany({
        where: { id: rowId },
        data: { status: 'generating' },
      })
      .catch(revertError =>
        logger.error('unclaim failed — sweep will reconcile', {
          rowId,
          error:
            revertError instanceof Error
              ? revertError.message
              : String(revertError),
        })
      );
    captureServerException(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: `video/webhook-${operation}`,
        level: 'error',
        tags: { code: 'quota_mutation_failed', rowId },
      }
    );
    return NextResponse.json(
      { error: 'quota mutation failed', rowId },
      { status: 500 }
    );
  }
}
