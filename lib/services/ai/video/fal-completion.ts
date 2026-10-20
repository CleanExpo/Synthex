/**
 * Completion of a generative video job that fal finished successfully.
 *
 * Shared by the fal webhook (POST /api/video/webhook/fal) and the video-sweep
 * cron, which asks fal directly when a webhook was lost. Both paths run the
 * same steps: store the artifact in bucket 'generated-videos', make the
 * status-guarded transition 'generating' -> 'rendered', record the attempt and
 * settle the quota hold. The status guard keeps the two paths idempotent with
 * each other: whichever transitions first settles, the other no-ops.
 */
import type { Prisma, VideoGeneration } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { settleQuota } from '@/lib/services/ai/video/quota';
import {
  recordAttempt,
  videoAttemptKey,
} from '@/lib/services/ai/image/spend-log';
import { storeArtifact } from '@/lib/services/ai/video/artifact-store';
import { FEATURE_NOT_PROVISIONED } from '@/lib/api/not-provisioned';
import { VIDEO_MODELS } from '@/lib/services/ai/video/registry';
import { InitiatedBy } from '@/lib/services/ai/video/types';

export type FalCompletionRow = Pick<
  VideoGeneration,
  | 'id'
  | 'userId'
  | 'organizationId'
  | 'model'
  | 'durationSeconds'
  | 'initiatedBy'
  | 'spendHoldId'
  | 'providerJobId'
  | 'enhancedPrompt'
  | 'batchGroupId'
  | 'metadata'
> & { estimatedCostUsd: Prisma.Decimal | number | null };

/**
 * 'rendered'   - this call won the transition and settled the hold.
 * 'failed'     - storage failed; the row is failed and the hold settled.
 * 'idempotent' - another path already settled the row; nothing was done.
 */
export type FalCompletionOutcome = 'rendered' | 'failed' | 'idempotent';

function objectMetadata(meta: unknown): Record<string, unknown> {
  return meta !== null && typeof meta === 'object' && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

/**
 * What a completed generation cost. Derived independently of our own storage:
 * fal completed and billed the generation, so this figure is owed whether or
 * not the download and storage then succeed (release review, pass 2).
 */
export function falActualCostUsd(row: FalCompletionRow): number {
  const heldUsd = Number(row.estimatedCostUsd ?? 0);
  const spec = VIDEO_MODELS.find(m => m.id === row.model);
  return spec
    ? Math.round(spec.costPerSecondUsd * (row.durationSeconds ?? 6) * 10000) /
        10000
    : heldUsd;
}

/**
 * Persist and settle a job fal completed with `videoUrl`. Callers must refuse
 * a row with a live hold and no organisation BEFORE calling this, so an
 * unattributable settlement is never consumed by the status transition.
 */
export async function completeFalSuccess(
  row: FalCompletionRow,
  providerJobId: string,
  videoUrl: string
): Promise<FalCompletionOutcome> {
  const heldUsd = Number(row.estimatedCostUsd ?? 0);
  const initiatedBy = (row.initiatedBy ?? 'studio') as InitiatedBy;
  const actualUsd = falActualCostUsd(row);

  try {
    const { storedUrl } = await storeArtifact({
      sourceUrl: videoUrl,
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
          providerUrl: videoUrl,
        },
      },
    });
    if (transitioned.count === 0) return 'idempotent';

    // Record what this specific job actually cost (SYN-1115 round-7), so
    // settlement and the sweep read evidence instead of guessing.
    if (row.spendHoldId && row.organizationId) {
      await recordAttempt({
        attemptKey: videoAttemptKey(row.spendHoldId, providerJobId),
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

    // Finalise the reservation. Keyed on the hold, so a replay conflicts on
    // the unique index and no-ops (SYN-1115 round-6).
    if (row.spendHoldId && row.organizationId) {
      await settleQuota(
        row.organizationId,
        row.spendHoldId,
        heldUsd,
        actualUsd,
        initiatedBy
      );
    }
    return 'rendered';
  } catch (err) {
    logger.error('artifact persistence failed', { rowId: row.id, err });

    const transitioned = await prisma.videoGeneration.updateMany({
      where: { id: row.id, status: 'generating' },
      data: {
        status: 'failed',
        errorMessage:
          err instanceof Error &&
          (err as { code?: string }).code === FEATURE_NOT_PROVISIONED
            ? err.message
            : 'artifact download/storage failed',
        metadata: {
          ...objectMetadata(row.metadata),
          providerUrl: videoUrl,
        },
      },
    });
    if (transitioned.count === 0) return 'idempotent';
    if (row.spendHoldId && row.organizationId) {
      // SETTLE, do not release. fal completed the generation and billed for
      // it; what failed is OUR download or storage. Releasing would hand the
      // money back and reopen admission headroom for spend that really
      // happened (release review, pass 2). The artifact is lost, which is a
      // product failure worth the 'failed' status above; the spend is not.
      await settleQuota(
        row.organizationId,
        row.spendHoldId,
        heldUsd,
        actualUsd,
        initiatedBy
      );
    }
    return 'failed';
  }
}
