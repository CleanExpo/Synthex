/**
 * Orchestration: validate -> compose -> quota hold (summed) -> submit each
 * variant to fal -> persist rows. A mid-batch submit failure releases the
 * unspent remainder of the hold; fully-failed submits rethrow.
 */
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { GenerativeVideoRequest, SubmittedJob } from './types';
import { resolveModel, estimateCostUsd } from './registry';
import { getMethodCard } from './cards/method-cards';
import { getChips } from './cards/modifier-chips';
import { getBrandFragment } from './cards/brand-cards';
import { composePrompt } from './cards/compose';
import { holdQuota, releaseQuota } from './quota';
import { submitToFal } from './fal-adapter';

const MAX_VARIANTS = 8;

export async function submitGenerativeVideo(
  req: GenerativeVideoRequest
): Promise<SubmittedJob[]> {
  const variants = req.variants ?? 1;
  if (variants < 1 || variants > MAX_VARIANTS) {
    throw new Error(`variants must be 1-${MAX_VARIANTS}`);
  }

  const methodCard = getMethodCard(req.methodCardId);
  if (!methodCard) throw new Error(`Unknown method card: ${req.methodCardId}`);
  if (methodCard.requiresImage && !req.imageUrl) {
    throw new Error(`Method card "${methodCard.name}" requires an input image`);
  }

  const tier = req.modelTier ?? 'draft'; // cost governance: draft-first is structural
  const aspectRatio = req.aspectRatio ?? '9:16';
  const durationSeconds = req.durationSeconds ?? 6;

  const model = resolveModel(tier, {
    aspectRatio,
    durationSeconds,
    audio: req.audio,
    requiresImage: Boolean(req.imageUrl),
  });

  const perJobUsd = estimateCostUsd(model, durationSeconds);
  const totalUsd = Math.round(perJobUsd * variants * 10000) / 10000;

  // Quota hold BEFORE any provider spend.
  await holdQuota(req.organizationId, totalUsd, req.initiatedBy);

  const brandFragment = req.brandCardId
    ? await getBrandFragment(req.brandCardId)
    : null;
  const chips = getChips(req.modifierIds ?? []);
  const composed = composePrompt({
    methodCard,
    subject: req.prompt,
    chips,
    brandFragment,
  });

  const batchGroupId = randomUUID();
  const jobs: SubmittedJob[] = [];

  try {
    for (let i = 0; i < variants; i++) {
      const seed = Math.floor(Math.random() * 2_147_483_647);
      const providerJobId = await submitToFal(model.id, {
        prompt: composed.prompt,
        ...(composed.negativePrompt
          ? { negative_prompt: composed.negativePrompt }
          : {}),
        ...(req.imageUrl ? { image_url: req.imageUrl } : {}),
        aspect_ratio: aspectRatio,
        duration: durationSeconds,
        seed,
        ...composed.params,
      });

      const row = await prisma.videoGeneration.create({
        data: {
          userId: req.userId,
          organizationId: req.organizationId,
          title: `${methodCard.name}: ${req.prompt.slice(0, 80)}`,
          topic: req.prompt.slice(0, 200),
          style: 'generative',
          duration: `${durationSeconds}s`,
          status: 'generating',
          mode: 'generative',
          provider: 'fal',
          model: model.id,
          providerJobId,
          initiatedBy: req.initiatedBy,
          inputPrompt: req.prompt,
          enhancedPrompt: composed.prompt,
          inputImageUrl: req.imageUrl,
          methodCardId: req.methodCardId,
          modifierIds: req.modifierIds ?? [],
          brandCardId: req.brandCardId,
          aspectRatio,
          durationSeconds,
          audioEnabled: Boolean(req.audio),
          batchGroupId,
          seed,
          estimatedCostUsd: perJobUsd,
        },
      });

      jobs.push({
        id: row.id,
        providerJobId,
        batchGroupId,
        model: model.id,
        estimatedCostUsd: perJobUsd,
        status: 'generating',
      });
    }
  } catch (err) {
    // Release the unspent remainder of the hold (variants that never submitted).
    const unsubmitted = variants - jobs.length;
    if (unsubmitted > 0) {
      await releaseQuota(
        req.organizationId,
        Math.round(perJobUsd * unsubmitted * 10000) / 10000,
        req.initiatedBy
      ).catch(e =>
        logger.error('quota release after partial submit failed', { e })
      );
    }
    if (jobs.length === 0) throw err;
    logger.error('partial batch submit', {
      batchGroupId,
      submitted: jobs.length,
      err,
    });
  }

  return jobs;
}
