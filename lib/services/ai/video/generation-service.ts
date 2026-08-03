/**
 * Orchestration: validate -> compose -> quota hold (one per variant, admitted
 * as a unit) -> submit each variant to fal -> persist rows. A mid-batch submit
 * failure releases the holds of the variants that never reached the provider;
 * fully-failed submits rethrow.
 */
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  GenerativeVideoRequest,
  SubmittedJob,
  mayHaveBeenBilled,
} from './types';
import { resolveModel, estimateCostUsd } from './registry';
import { getMethodCard } from './cards/method-cards';
import { getChips } from './cards/modifier-chips';
import { getBrandFragment } from './cards/brand-cards';
import { composePrompt } from './cards/compose';
import { holdQuotaBatch, releaseQuota, settleQuota } from './quota';
import {
  recordAttempt,
  videoAttemptKey,
  unaddressableAttemptKey,
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
  // INTEGER, not merely in range. `Array.from({length: 1.5})` yields ONE hold
  // while `for (i < 1.5)` iterates TWICE, so the second paid submit ran with an
  // undefined hold id — one reservation, two billed jobs. The REST and MCP
  // schemas happen to require integers today, but this is the service-layer
  // boundary the whole ticket exists to make caller-independent: a script or a
  // future caller must not be able to reach a provider past the ceiling
  // (release review, pass 3).
  if (!Number.isInteger(variants) || variants < 1 || variants > MAX_VARIANTS) {
    throw new Error(
      `variants must be an integer 1-${MAX_VARIANTS} (received ${variants})`
    );
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

  // Reservation immediately BEFORE the first provider call, and after every
  // step that can fail cheaply.
  //
  // It used to be taken above, before enhancePrompt/getBrandFragment/
  // composePrompt — all of which sit OUTSIDE the cleanup try below. An ordinary
  // transient failure there (a Prisma blip loading a brand card) left unlinked
  // holds having made ZERO provider calls, and the sweep charges any video hold
  // it cannot prove unspent, so three variants could falsely consume most of a
  // daily cap (release review, pass 8).
  //
  // Nothing real is given up by moving it. The held amount is
  // `estimateCostUsd(model, durationSeconds)` — the VIDEO estimate — so it never
  // priced the enhancement LLM's tokens, whatever the old comment claimed.
  //
  // ONE HOLD PER VARIANT, admitted as a unit. The batch is a single cap
  // decision but N independent outcomes — each variant completes, fails or is
  // swept on its own — and the log allows exactly one terminal event per hold.
  // A shared hold made those outcomes mutually exclusive: whichever webhook
  // arrived first settled the whole batch and the rest were duplicate-key
  // no-ops, so a failed variant alongside a successful one was still charged
  // in full (SYN-1115 round-8). The hold id is persisted on every row below so
  // the webhook can finalise idempotently — no compensating unclaim (round-6).
  const spendHoldIds = Array.from({ length: variants }, () => randomUUID());
  await holdQuotaBatch(
    req.organizationId,
    perJobUsd,
    req.initiatedBy,
    spendHoldIds
  );

  const batchGroupId = randomUUID();
  const jobs: SubmittedJob[] = [];
  let submittedCount = 0;

  try {
    for (let i = 0; i < variants; i++) {
      const seed = Math.floor(Math.random() * 2_147_483_647);
      // This variant's own reservation — settled or released independently.
      const spendHoldId = spendHoldIds[i];
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
        // Predicate, not `instanceof`: an ambiguous submit (dispatched, outcome
        // unknown) makes the SAME claim as an unaddressable one — this may have
        // been billed — so both must count as submitted. A third such case
        // cannot be added without this picking it up (release review, pass 9).
        if (mayHaveBeenBilled(err)) {
          // ACCEPTED but unaddressable. Count it as submitted spend of unknown
          // amount: throwing it away as "never sent" would settle the batch
          // one variant short of what the provider may bill, and no webhook or
          // sweep could correct that afterwards because settlement is terminal.
          submittedCount++;
          try {
            await recordAttempt({
              // Unique per variant, and in a namespace no provider id can
              // reach — real keys carry a `job:` segment this one does not.
              attemptKey: unaddressableAttemptKey(spendHoldId, i),
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
    // Release the holds of the variants that never reached the provider, and
    // ONLY those. submittedCount (not jobs.length) is the right boundary: the
    // loop is sequential and a variant whose provider submit succeeded but
    // whose DB row failed HAS been billed, so its hold stays open for the
    // webhook or the sweep.
    //
    // Per-variant holds are what make this expressible. Under the old shared
    // hold a partial release would have foreclosed the real settlement for the
    // whole batch, so the code had to settle the remainder instead
    // (SYN-1115 round-6, superseded by round-8).
    for (const unspentHoldId of spendHoldIds.slice(submittedCount)) {
      try {
        await releaseQuota(
          req.organizationId,
          unspentHoldId,
          perJobUsd,
          req.initiatedBy
        );
      } catch (e) {
        logger.error('quota release after partial submit failed', {
          holdId: unspentHoldId,
          e,
        });
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
      // SETTLE those holds here, at the reservation. An orphan reached the
      // provider and may be billed, but it has no video_generations row — so
      // no webhook will ever finalise it, and the stale sweep cannot tell it
      // from a hold that never spent: no owner row, no provider job id, and
      // possibly no attempt row either if that write was the one that failed.
      // Left open it swept to ZERO, erasing a paid call. This is the only
      // place that still knows the submit succeeded (SYN-1115 round-8).
      for (const orphanHoldId of spendHoldIds.slice(
        jobs.length,
        submittedCount
      )) {
        try {
          await settleQuota(
            req.organizationId,
            orphanHoldId,
            perJobUsd,
            perJobUsd,
            req.initiatedBy
          );
        } catch (e) {
          logger.error('quota settle for orphaned provider job failed', {
            holdId: orphanHoldId,
            e,
          });
        }
      }
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
