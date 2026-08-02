/**
 * Orchestration: validate -> compose -> quota hold (summed) -> submit each
 * variant to fal -> persist rows. A mid-batch submit failure releases the
 * unspent remainder of the hold; fully-failed submits rethrow.
 */
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  GenerativeVideoRequest,
  SubmittedJob,
  UnaddressableSubmitError,
} from './types';
import { resolveModel, estimateCostUsd } from './registry';
import { getMethodCard } from './cards/method-cards';
import { getChips } from './cards/modifier-chips';
import { getBrandFragment } from './cards/brand-cards';
import { composePrompt } from './cards/compose';
import { holdQuota, settleQuota } from './quota';
import {
  recordAttempt,
  videoAttemptKey,
} from '@/lib/services/ai/image/spend-log';
import { submitToFal } from './fal-adapter';
import { enhancePrompt } from './prompt-enhancer';

const MAX_VARIANTS = 8;

/**
 * Fail-closed grounding refusal (Real Images Only mandate,
 * docs/superpowers/specs/2026-07-12-real-images-only-design.md, Part B). Thrown
 * instead of silently proceeding ungrounded whenever grounding is on (default)
 * but no owned reference can actually be used as the I2V seed. `blocked` lets
 * callers (the REST route, MCP tools) discriminate this from other submit
 * failures without string-matching the message.
 */
export class GroundingBlockedError extends Error {
  public readonly blocked = true as const;
  constructor(message: string) {
    super(message);
    this.name = 'GroundingBlockedError';
  }
}

const NO_COVERAGE_ERROR =
  'No owned references for this subject — add real photos to the reference library first.';

export async function submitGenerativeVideo(
  req: GenerativeVideoRequest
): Promise<SubmittedJob[]> {
  const variants = req.variants ?? 1;
  if (variants < 1 || variants > MAX_VARIANTS) {
    throw new Error(`variants must be 1-${MAX_VARIANTS}`);
  }

  // Reference grounding is ON BY DEFAULT (Real Images Only mandate). The only
  // audited escape hatch is useReferences: false, which restores today's
  // synthetic-first-frame behaviour. An explicit caller imageUrl always wins
  // over auto-resolution, unchanged from before. Fail-CLOSED: when grounding
  // is on and no explicit imageUrl is given, an owned reference must actually
  // resolve to a usable seed URL or the submission is BLOCKED — AI-invented
  // video is never a silent fallback.
  const useRefs = req.useReferences !== false;
  let grounded = false;
  let groundedSet: string | null = null;
  let groundedSubject: string | null = null;
  let groundedVendor: string | undefined = undefined;
  let seedImageUrl = req.imageUrl; // explicit imageUrl always wins

  if (useRefs && !seedImageUrl) {
    const { resolveReferences } =
      await import('@/lib/services/ai/reference-library');
    let refs;
    try {
      refs = resolveReferences({ set: req.referenceSet, prompt: req.prompt });
    } catch (e) {
      logger.error('video grounding: reference resolution failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      throw new GroundingBlockedError(NO_COVERAGE_ERROR);
    }

    if (refs.count === 0) {
      throw new GroundingBlockedError(NO_COVERAGE_ERROR);
    }

    const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
    let resolvedSeedUrl = base ? `${base}${refs.imagePaths[0]}` : undefined;
    if (!resolvedSeedUrl) {
      // Public URL construction unavailable — fall back to a short-lived
      // SIGNED URL for an owned PRIVATE reference, parity with the image
      // grounding path (lib/services/ai/image-generation.ts).
      logger.warn(
        'video grounding: NEXT_PUBLIC_APP_URL not configured — falling back to private signed refs'
      );
      const { resolvePrivateReferenceUrls } =
        await import('@/lib/services/ai/reference-library-private');
      const privateUrls = await resolvePrivateReferenceUrls(refs.industry, 1);
      resolvedSeedUrl = privateUrls[0];
    }

    if (!resolvedSeedUrl) {
      // Owned coverage exists but no usable seed URL could be resolved
      // (no public base configured and no private signed ref available
      // either) — block rather than silently proceeding text-to-video.
      throw new GroundingBlockedError(NO_COVERAGE_ERROR);
    }

    seedImageUrl = resolvedSeedUrl;
    grounded = true;
    groundedSet = refs.industry;
    groundedSubject = refs.subject;
    groundedVendor = refs.vendorKey;
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
    // An auto-grounded seed on a card that doesn't itself require an image
    // used to fail OPEN here: silently drop the seed and retry text-to-video.
    // Real Images Only makes that fail-CLOSED instead — an owned reference
    // resolved but the chosen tier can't use it is not licence to ship an
    // AI-invented frame. Block with an honest error naming the real cause so
    // the caller can pick a higher tier or explicitly opt out
    // (useReferences: false). An explicit caller imageUrl, or a method card
    // that itself mandates an image, is a legitimate "no image model at this
    // tier" validation error and must not be reframed as a grounding block.
    if (grounded && !methodCard.requiresImage) {
      throw new GroundingBlockedError(
        `Grounded video needs an image-capable model, but tier "${tier}" has none available — choose a higher tier or pass useReferences:false. (${err instanceof Error ? err.message : String(err)})`
      );
    }
    throw err;
  }

  const perJobUsd = estimateCostUsd(model, durationSeconds);
  const totalUsd = Math.round(perJobUsd * variants * 10000) / 10000;

  // Reservation BEFORE any provider spend (including LLM enhancement tokens).
  // The hold id is persisted on every row below so the webhook can finalise
  // idempotently — no compensating unclaim (SYN-1115 round-6).
  const spendHoldId = randomUUID();
  await holdQuota(req.organizationId, totalUsd, req.initiatedBy, spendHoldId);

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
      let providerJobId: string;
      try {
        providerJobId = await submitToFal(model.id, {
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
      } catch (err) {
        if (err instanceof UnaddressableSubmitError) {
          // ACCEPTED but unaddressable. Count it as submitted spend of unknown
          // amount: throwing it away as "never sent" would settle the batch
          // one variant short of what the provider may bill, and no webhook or
          // sweep could correct that afterwards because settlement is terminal.
          submittedCount++;
          try {
            await recordAttempt({
              // Unique per variant — a shared key would collapse two such
              // calls onto one row, which is the collision this guard exists
              // to prevent in the first place.
              attemptKey: `${spendHoldId}:video:unaddressable:${i}`,
              holdId: spendHoldId,
              organizationId: req.organizationId,
              mediaType: 'video',
              provider: 'fal',
              modelId: model.id,
              status: 'submitted',
              costUsd: null,
            });
          } catch (e) {
            logger.error('could not record unaddressable video attempt', { e });
          }
          logger.error(
            'fal accepted a submit with no request_id — counted as billable',
            { batchGroupId, variant: i }
          );
        }
        throw err;
      }
      submittedCount++;
      // Record the paid call. The key is derived from the provider job id via
      // the SHARED helper, so the completion webhook updates THIS row instead
      // of writing a second one and doubling the recorded spend.
      //
      // try/catch rather than .catch(): bookkeeping must not break a
      // generation, and awaiting inside a guard does not assume the writer
      // returns a thenable. A blank provider job id DOES propagate — a key
      // that would collide across variants is a refusal, not a warning.
      const attemptKey = videoAttemptKey(spendHoldId, providerJobId);
      try {
        await recordAttempt({
          attemptKey,
          holdId: spendHoldId,
          organizationId: req.organizationId,
          mediaType: 'video',
          provider: 'fal',
          modelId: model.id,
          status: 'submitted',
          // Unknown until the webhook reports; NOT zero — an accepted submit
          // is billable even if we never hear back.
          costUsd: null,
          providerJobId,
        });
      } catch (e) {
        logger.error('could not record video provider attempt', { e });
      }

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
          spendHoldId,
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
        groundedSubject: groundedSubject ?? undefined,
        groundedVendor,
      });
    }
  } catch (err) {
    // Settle at what actually reached the provider. submittedCount (not
    // jobs.length) is the right basis: a variant whose provider submit
    // succeeded but whose DB row failed HAS been billed.
    const unsubmitted = variants - submittedCount;
    if (unsubmitted > 0) {
      // Partial submit: the batch reserved for `variants` but only
      // `submittedCount` reached the provider. Finalise at what was actually
      // committed rather than releasing a slice — the log allows exactly ONE
      // terminal event per hold, so a partial release would foreclose the real
      // settlement (SYN-1115 round-6).
      try {
        await settleQuota(
          req.organizationId,
          spendHoldId,
          totalUsd,
          Math.round(perJobUsd * submittedCount * 10000) / 10000,
          req.initiatedBy
        );
      } catch (e) {
        logger.error('quota settle after partial submit failed', { e });
      }
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
