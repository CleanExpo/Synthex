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
import { storeArtifact } from '@/lib/services/ai/video/artifact-store';
import { VIDEO_MODELS } from '@/lib/services/ai/video/registry';
import { InitiatedBy } from '@/lib/services/ai/video/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!verifyWebhookToken(request.nextUrl.searchParams.get('token'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = parseFalWebhook(await request.json());

  const row = await prisma.videoGeneration.findFirst({
    where: { providerJobId: result.providerJobId, mode: 'generative' },
  });
  if (!row) {
    logger.warn('fal webhook for unknown job', {
      providerJobId: result.providerJobId,
    });
    return NextResponse.json({ ok: true, unknown: true });
  }
  if (row.status !== 'generating') {
    return NextResponse.json({ ok: true, idempotent: true }); // already settled
  }

  const heldUsd = Number(row.estimatedCostUsd ?? 0);
  const initiatedBy = (row.initiatedBy ?? 'studio') as InitiatedBy;

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

      await prisma.videoGeneration.update({
        where: { id: row.id },
        data: {
          status: 'rendered',
          videoUrl: storedUrl,
          actualCostUsd: actualUsd,
          metadata: {
            ...((row.metadata as object) ?? {}),
            providerUrl: result.videoUrl,
          },
        },
      });
      await settleQuota(
        row.organizationId ?? '',
        heldUsd,
        actualUsd,
        initiatedBy
      );
    } catch (err) {
      logger.error('artifact persistence failed', { rowId: row.id, err });
      await prisma.videoGeneration.update({
        where: { id: row.id },
        data: {
          status: 'failed',
          errorMessage: 'artifact download/storage failed',
          metadata: {
            ...((row.metadata as object) ?? {}),
            providerUrl: result.videoUrl,
          },
        },
      });
      await releaseQuota(row.organizationId ?? '', heldUsd, initiatedBy);
    }
  } else {
    await prisma.videoGeneration.update({
      where: { id: row.id },
      data: {
        status: 'failed',
        errorMessage: result.isPolicyRejection
          ? `Prompt rejected by provider content policy: ${result.errorMessage}`
          : result.errorMessage,
      },
    });
    await releaseQuota(row.organizationId ?? '', heldUsd, initiatedBy);
  }

  return NextResponse.json({ ok: true });
}
