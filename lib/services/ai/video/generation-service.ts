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
import { enhancePrompt } from './prompt-enhancer';

const MAX_VARIANTS = 8;

export async function submitGenerativeVideo(
  req: GenerativeVideoRequest
): Promise<SubmittedJob[]> {
  const variants = req.variants ?? 1;
  if (variants < 1 || variants > MAX_VARIANTS) {
    throw new Error(`variants must be 1-${MAX_VARIANTS}`);
  }

  // Reference grounding (opt-in, owned-only). Fill the I2V seed from an owned
  // reference set when the caller opts in and provided no explicit imageUrl.
  // Fail-open: any miss/error leaves the request ungrounded (text-to-video).
  const useRefs =
    req.useReferences !== false &&
    (req.useReferences === true || Boolean(req.referenceSet));
  let grounded = false;
  let groundedSet: string | null = null;
  let seedImageUrl = req.imageUrl; // explicit imageUrl always wins
  if (useRefs && !seedImageUrl) {
    try {
      const { resolveReferences } =
        await import('@/lib/services/ai/reference-library');
      const refs = resolveReferences({
        set: req.referenceSet,
        prompt: req.prompt,
      });
      if (refs.count > 0) {
        const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
        if (base) {
          seedImageUrl = `${base}${refs.imagePaths[0]}`;
          grounded = true;
          groundedSet = refs.industry;
        } else {
          logger.warn(
            'video grounding skipped: NEXT_PUBLIC_APP_URL not configured'
          );
        }
      }
    } catch (e) {
      logger.warn('video grounding failed; proceeding ungrounded', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const methodCard = getMethodCard(req.methodCardId);
  if (!methodCard) throw new Error(`Unknown method card: ${req.methodCardId}`);
  if (methodCard.requiresImage && !seedImageUrl) {
    throw new Error(`Method card "${methodCard.name}" requires an input image`);
  }

  const tier = req.modelTier ?? 'draft'; // cost governance: draft-first is structural
  const aspectRatio = req.aspectRatio ?? '9:16';
  const durationSeconds = req.durationSeconds ?? 6;

  let model;
  try {
    model = resolveModel(tier, {
      aspectRatio,
      durationSeconds,
      audio: req.audio,
      requiresImage: Boolean(seedImageUrl),
    });
  } catch (err) {
    // Fail-open only for an auto-grounded seed on a card that doesn't itself
    // require an image: drop the seed and fall back to text-to-video rather
    // than surface a hard error the caller never asked for. An explicit
    // caller imageUrl, or a method card that mandates an image, is a
    // legitimate "no image model at this tier" error and must not be
    // swallowed.
    if (grounded && !methodCard.requiresImage) {
      logger.warn(
        'video grounding dropped: no image-capable model at tier; proceeding ungrounded',
        {
          tier,
          error: err instanceof Error ? err.message : String(err),
        }
      );
      seedImageUrl = undefined;
      grounded = false;
      groundedSet = null;
      model = resolveModel(tier, {
        aspectRatio,
        durationSeconds,
        audio: req.audio,
        requiresImage: false,
      });
    } else {
      throw err;
    }
  }

  const perJobUsd = estimateCostUsd(model, durationSeconds);
  const totalUsd = Math.round(perJobUsd * variants * 10000) / 10000;

  // Quota hold BEFORE any provider spend (including LLM enhancement tokens).
  await holdQuota(req.organizationId, totalUsd, req.initiatedBy);

  // Freeform cards expand the raw subject via cheap LLM; all other cards carry
  // their own cinematographic scaffolds and pass the prompt through unchanged.
  const subject =
    methodCard.id === 'freeform' ? await enhancePrompt(req.prompt) : req.prompt;

  const brandFragment = req.brandCardId
    ? await getBrandFragment(req.brandCardId)
    : null;
  const chips = getChips(req.modifierIds ?? []);
  const composed = composePrompt({
    methodCard,
    subject,
    chips,
    brandFragment,
  });

  const batchGroupId = randomUUID();
  const jobs: SubmittedJob[] = [];
  let submittedCount = 0;

  try {
    for (let i = 0; i < variants; i++) {
      const seed = Math.floor(Math.random() * 2_147_483_647);
      const providerJobId = await submitToFal(model.id, {
        // Card/chip params are model knobs (e.g. motion strength); core fields
        // below always win so a card can never clobber prompt/seed/aspect/duration.
        ...composed.params,
        prompt: composed.prompt,
        ...(composed.negativePrompt
          ? { negative_prompt: composed.negativePrompt }
          : {}),
        ...(seedImageUrl ? { image_url: seedImageUrl } : {}),
        aspect_ratio: aspectRatio,
        duration: durationSeconds,
        seed,
      });
      submittedCount++;

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
          inputImageUrl: seedImageUrl,
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
        grounded,
        referenceSet: groundedSet ?? undefined,
      });
    }
  } catch (err) {
    // Release the unspent remainder of the hold (variants that never submitted).
    // Use submittedCount (not jobs.length) so we don't release quota for
    // variants whose provider submit already succeeded but whose DB row failed.
    const unsubmitted = variants - submittedCount;
    if (unsubmitted > 0) {
      await releaseQuota(
        req.organizationId,
        Math.round(perJobUsd * unsubmitted * 10000) / 10000,
        req.initiatedBy
      ).catch(e =>
        logger.error('quota release after partial submit failed', { e })
      );
    }
    if (submittedCount > jobs.length) {
      logger.error(
        'fal job submitted but row creation failed — orphaned provider job',
        {
          batchGroupId,
          orphanedCount: submittedCount - jobs.length,
        }
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
