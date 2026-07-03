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

function objectMetadata(meta: unknown): Record<string, unknown> {
  return meta !== null && typeof meta === 'object' && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
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

      // Fix 1: atomic status-guarded transition — prevents double-settling
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
      // Fix 2: guard null organizationId before settling quota
      if (row.organizationId) {
        await settleQuota(row.organizationId, heldUsd, actualUsd, initiatedBy);
      } else {
        logger.error('video job has no organizationId — quota not settled', {
          rowId: row.id,
        });
      }
    } catch (err) {
      logger.error('artifact persistence failed', { rowId: row.id, err });
      // Fix 1: atomic status-guarded transition for artifact-failure path
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
      // Fix 2: guard null organizationId before releasing quota
      if (row.organizationId) {
        await releaseQuota(row.organizationId, heldUsd, initiatedBy);
      } else {
        logger.error('video job has no organizationId — quota not released', {
          rowId: row.id,
        });
      }
    }
  } else {
    // Fix 1: atomic status-guarded transition for ERROR-webhook path
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
    // Fix 2: guard null organizationId before releasing quota
    if (row.organizationId) {
      await releaseQuota(row.organizationId, heldUsd, initiatedBy);
    } else {
      logger.error('video job has no organizationId — quota not released', {
        rowId: row.id,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
