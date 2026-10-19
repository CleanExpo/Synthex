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
import { releaseQuota } from '@/lib/services/ai/video/quota';
import { captureServerException } from '@/lib/observability/sentry-server';
import { completeFalSuccess } from '@/lib/services/ai/video/fal-completion';
import { InitiatedBy } from '@/lib/services/ai/video/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

  if (result.ok && result.videoUrl) {
    // Shared with the video-sweep cron, which recovers jobs whose webhook was
    // lost; the status guard inside keeps the two paths idempotent.
    const outcome = await completeFalSuccess(
      row,
      result.providerJobId,
      result.videoUrl
    );
    if (outcome === 'idempotent') {
      return NextResponse.json({ ok: true, idempotent: true });
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
