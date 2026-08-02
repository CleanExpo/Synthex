/**
 * IMAGE SPEND METER (SYN-1115).
 *
 * Before this module, image generation had no cost accounting of any kind: no
 * estimate, no hold, no ledger write, no ceiling. `generateBatch` passed its
 * `count` straight into `Array.from({length: count})`, so any caller that did
 * not transit the HTTP route's Zod cap — an MCP tool, a cron, a script, the
 * generation gateway itself — could spend without limit.
 *
 * This is deliberately NOT a new cost system. It reuses the quota primitives the
 * video path already proves under concurrency (`lib/services/ai/video/quota.ts`:
 * conditional `updateMany` under the Postgres row lock, TOCTOU-closed) against
 * the SAME `organization_video_quotas` row, so image and video share ONE
 * per-organisation media budget (founder ruling R5). The org-level budget
 * enforcer (`lib/ai/budget-enforcer.ts`) is deliberately NOT wired in here — it
 * is fail-open by design and scoped to text pipelines.
 *
 * Shape mirrors `lib/services/ai/video/generation-service.ts`:
 *   estimate → hold the WHOLE batch → generate → settle to actual → release
 *   the unspent remainder on failure.
 *
 * The batch is held as one sum BEFORE the first provider call, not per-variant.
 * Per-variant holds would let the first N variants of an oversized batch reach
 * the provider before the quota tripped, which is precisely the leak this
 * closes.
 */
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { trackPipelineCost } from '@/lib/pipelines/track-cost';
import {
  reserveSpend,
  finalizeSpend,
  recordAttempt,
  settlementAmountUsd,
} from './spend-log';
import type { InitiatedBy } from '@/lib/services/ai/video/types';
import {
  estimateImageCostUsd,
  selectImageModel,
  IMAGE_MODELS,
  UnpricedModelError,
  type ImageModel,
} from './registry';

/**
 * Hard ceiling on variants in a single image batch, asserted in the SERVICE.
 * Mirrors MAX_VARIANTS in lib/services/ai/video/generation-service.ts:19.
 *
 * The route-level Zod caps (variants max 3, count max 8) stay where they are —
 * this exists so they are no longer the ONLY wall. A cap that lives only in a
 * request schema does not survive a new caller.
 */
export const MAX_IMAGE_VARIANTS = 8;

/** Same default frame the generator falls back to when no size is requested. */
const DEFAULT_DIMENSIONS = { width: 1024, height: 1024 };

const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1792, height: 1024 },
  '9:16': { width: 1024, height: 1792 },
  '4:3': { width: 1365, height: 1024 },
  '3:4': { width: 1024, height: 1365 },
};

export interface MeteredImageOptions {
  width?: number;
  height?: number;
  aspectRatio?: string;
  model?: string;
  loraId?: string;
  useReferences?: boolean;
  /** Legacy provider pin — only reachable via useReferences: false. */
  provider?: string;
  /**
   * Reference images the request will send. Grounded calls bill these as INPUT
   * megapixels on fal's per-megapixel models, so the hold must include them.
   */
  referenceImageCount?: number;
}

/**
 * Resolve the output frame the same way the generator does: explicit
 * width/height wins, then the aspect-ratio table, then the 1024² default.
 */
export function resolveOutputDimensions(options: MeteredImageOptions): {
  width: number;
  height: number;
} {
  if (options.width && options.height) {
    return { width: options.width, height: options.height };
  }
  if (options.aspectRatio && ASPECT_DIMENSIONS[options.aspectRatio]) {
    return ASPECT_DIMENSIONS[options.aspectRatio];
  }
  return DEFAULT_DIMENSIONS;
}

/**
 * Registry model ids behind each legacy provider adapter. Mirrors
 * LEGACY_PROVIDER_MODEL_IDS in image-generation.ts — duplicated deliberately
 * rather than imported, because importing it would create a cycle
 * (image-generation imports this module).
 */
const LEGACY_PROVIDER_MODEL_IDS: Record<string, string> = {
  stability: 'stable-diffusion-3',
  dalle: 'dall-e-3',
  gemini: process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image',
};

/**
 * EVERY model the run could plausibly select (SYN-1115, review finding 1).
 *
 * The previous implementation asked `selectImageModel` for one model and
 * ignored `options.provider` entirely, which broke in two ways:
 *
 *   - `useReferences:false` with no model held FLUX.2 Pro at $0.03 while the
 *     legacy chain actually ran Gemini 3 Pro Image at $0.134 — an under-reserve
 *     of more than 4x on every ungrounded call.
 *   - `provider:'dalle'` or `'stability'` passed that same FLUX-priced hold and
 *     then reached an explicitly pinned, deprecated, UNPRICED provider.
 *
 * The estimate cannot know in advance whether the industry LoRA will resolve,
 * so it does not try to predict: it prices the MOST EXPENSIVE candidate. An
 * estimate may over-reserve; it must never under-reserve.
 */
export function resolveCostCandidates(
  options: MeteredImageOptions
): ImageModel[] {
  const grounded = options.useReferences !== false;

  if (grounded) {
    // Grounded runs use the reference-capable FLUX family. Which one depends on
    // whether a LoRA resolves at generation time, so both are candidates.
    const candidates = [
      selectImageModel({ needsReferences: true, preferred: options.model }),
      selectImageModel({ needsReferences: false, needsLora: true }),
    ];
    return dedupeById(candidates);
  }

  // Ungrounded (the audited escape hatch) runs the legacy chain. An explicit
  // pin is the only candidate — including a deprecated one, which is precisely
  // the case that must fail closed rather than be silently repriced.
  if (options.provider) {
    const pinnedId = LEGACY_PROVIDER_MODEL_IDS[options.provider];
    const pinned = IMAGE_MODELS.find(m => m.id === pinnedId);
    if (!pinned) {
      throw new UnpricedModelError(
        pinnedId ?? String(options.provider),
        `pinned provider "${options.provider}" has no registry entry`
      );
    }
    return [pinned];
  }

  // No pin: the generator walks the non-deprecated legacy chain, so any of
  // them could serve the request.
  const chain = ['stability', 'dalle', 'gemini']
    .map(p => IMAGE_MODELS.find(m => m.id === LEGACY_PROVIDER_MODEL_IDS[p]))
    .filter((m): m is ImageModel => Boolean(m) && !m!.deprecated);

  if (chain.length === 0) {
    throw new UnpricedModelError(
      'legacy-chain',
      'every legacy provider is deprecated — pin one explicitly'
    );
  }
  return chain;
}

function dedupeById(models: ImageModel[]): ImageModel[] {
  const seen = new Set<string>();
  return models.filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

/** Back-compat single-model view: the dearest candidate. */
export function resolveCostModel(options: MeteredImageOptions): ImageModel {
  const candidates = resolveCostCandidates(options);
  const dimensions = resolveOutputDimensions(options);
  const refs = options.referenceImageCount ?? 0;
  // estimateImageCostUsd throws UnpricedModelError for any uncostable
  // candidate — a pinned deprecated provider therefore fails CLOSED here.
  let dearest = candidates[0];
  let dearestUsd = estimateImageCostUsd(dearest, {
    ...dimensions,
    referenceImageCount: refs,
  });
  for (const candidate of candidates.slice(1)) {
    const usd = estimateImageCostUsd(candidate, {
      ...dimensions,
      referenceImageCount: refs,
    });
    if (usd > dearestUsd) {
      dearest = candidate;
      dearestUsd = usd;
    }
  }
  return dearest;
}

export interface ImageSpendHold {
  organizationId: string;
  initiatedBy: InitiatedBy;
  /** Sum held for the whole batch, USD. */
  heldUsd: number;
  /** Per-image estimate, USD — persisted onto each ImageGeneration row. */
  perImageUsd: number;
  /** Output frame the estimate was priced at; re-used to re-price at settle. */
  dimensions: { width: number; height: number };
  /** Reference images included in the estimate; re-used at settle. */
  referenceImageCount: number;
  /**
   * Identity of this reservation in the append-only spend log. Every terminal
   * event derives its key from this, which is what makes settle/release/sweep
   * mutually exclusive and replay-safe.
   */
  holdId: string;
  count: number;
  /**
   * Attempt keys this hold has actually TRIED to record, added before each
   * provider call. It is the caller's own proof of how many paid calls were
   * made, used as the settlement floor so a lost attempt write cannot make
   * real spend disappear (SYN-1115 round-8).
   *
   * ONE ENTRY PER INVOCATION, which is why `attemptSeq` exists: the key used to
   * be derived from the call's SHAPE (label, model, variant, seed), and the
   * grounded FLUX retry re-derives an identical shape, so two genuinely
   * separate paid calls collapsed onto one key. That under-counted the floor
   * AND upserted both calls onto a single attempt row — the key's own contract
   * said "the grounded retry gets its own row" and it did not.
   */
  attemptedKeys: Set<string>;
  /**
   * Monotonic per-hold invocation counter, mixed into each attempt key so
   * every paid call is distinct. Mutable holder rather than a number because
   * the hold is passed by reference to concurrent variants; increments are
   * safe because the read-and-increment is synchronous.
   */
  attemptSeq: { n: number };
  /**
   * Local hint only — the LOG is the authority. A stale `false` costs nothing:
   * a duplicate finalize conflicts on the shared key and no-ops.
   */
  settled: boolean;
}

/**
 * Estimate and hold for `count` images BEFORE any provider call.
 *
 * Throws `UnpricedModelError` when the model cannot be costed and
 * `QuotaExceededError` when the org's shared media budget would be breached —
 * both fail CLOSED, both before a single byte reaches a provider.
 */
export async function holdImageSpend(
  organizationId: string,
  initiatedBy: InitiatedBy,
  options: MeteredImageOptions,
  count: number,
  runId?: string
): Promise<ImageSpendHold> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_IMAGE_VARIANTS) {
    throw new RangeError(
      `image variants must be an integer 1-${MAX_IMAGE_VARIANTS} (received ${count})`
    );
  }

  // Dearest plausible candidate — throws UnpricedModelError for any uncostable
  // candidate, so a pin to a deprecated/unpriced provider fails CLOSED here,
  // before the provider is reached.
  const model = resolveCostModel(options);
  const dimensions = resolveOutputDimensions(options);
  const referenceImageCount = options.referenceImageCount ?? 0;
  const perImageUsd = estimateImageCostUsd(model, {
    ...dimensions,
    referenceImageCount,
  });
  const heldUsd = Math.round(perImageUsd * count * 10000) / 10000;

  // Reserve in the append-only log. The ceiling check and the event insert
  // happen in ONE transaction under the quota row lock, so concurrent
  // reservations serialise and cannot jointly breach. Throws
  // QuotaExceededError without writing anything when a cap would be exceeded.
  const holdId = randomUUID();
  await reserveSpend({
    holdId,
    organizationId,
    initiatedBy,
    amountUsd: heldUsd,
    runId,
  });

  return {
    organizationId,
    initiatedBy,
    heldUsd,
    perImageUsd,
    dimensions,
    referenceImageCount,
    count,
    holdId,
    attemptedKeys: new Set<string>(),
    attemptSeq: { n: 0 },
    settled: false,
  };
}

/**
 * Settle a hold against the models that ACTUALLY ran, then write the ledger.
 *
 * `outcomes` carries one entry per variant that produced an image, each naming
 * the model that produced it. Passing a single model plus a success count
 * (the previous shape) mis-priced every mixed batch: grounded variants can mix
 * FLUX LoRA successes with FLUX Pro fallbacks when individual LoRA calls fail,
 * and the batch was settled as if all of them ran the first successful model
 * (SYN-1115, review finding 5).
 *
 * Returns the per-variant actual costs alongside the total so callers can
 * persist a real `actualCostUsd` on each row.
 *
 * `settled` flips only AFTER the quota mutation commits (review finding 3).
 * Marking it first meant a transient database error left the estimate charged
 * with every retry a silent no-op — an eight-image batch could consume the
 * whole daily headroom with no recorded spend and no way back. Settlement is
 * now safely retryable: a failure leaves the hold unsettled so the caller (or
 * a later retry) can try again.
 */
export async function settleImageSpend(
  hold: ImageSpendHold,
  outcomes: Array<{ model: string; referenceImageCount?: number }>,
  meta: { runId: string; organizationId: string }
): Promise<{ totalUsd: number; perVariantUsd: number[] }> {
  if (hold.settled) return { totalUsd: 0, perVariantUsd: [] };

  const priceFor = (modelId: string, referenceImageCount?: number): number => {
    const ran = IMAGE_MODELS.find(m => m.id === modelId);
    if (!ran) return hold.perImageUsd;
    try {
      return estimateImageCostUsd(ran, {
        ...hold.dimensions,
        referenceImageCount: referenceImageCount ?? hold.referenceImageCount,
      });
    } catch {
      return hold.perImageUsd;
    }
  };

  // Per-variant figures are still returned to callers so each row can carry its
  // own cost, but the amount the HOLD settles at is derived from the recorded
  // provider attempts — which include every fallback and retry the final
  // result does not mention (SYN-1115 round-7).
  const perVariantUsd = outcomes.map(o =>
    priceFor(o.model, o.referenceImageCount)
  );
  // The PROVEN FLOOR of paid calls, as KEYS rather than a count so settlement
  // can join them against recorded rows by identity. Every provider call is
  // added to `attemptedKeys` before the call and retracted only when the
  // adapter proves nothing was sent, so it covers variants that failed at the
  // provider as well as ones that produced an image. `outcomes.length` remains
  // as a count-only fallback for callers that settle a hold they did not meter
  // through withAttempt and therefore have no keys.
  //
  // The attempt table may still show MORE (retries and fallbacks neither
  // number knows about) and that richer figure wins — but it can no longer
  // show FEWER, which is what let a fully-successful batch settle at $0 when
  // its attempt writes were lost (SYN-1115 round-8).
  const totalUsd = await settlementAmountUsd(
    hold.holdId,
    hold.perImageUsd,
    hold.attemptedKeys.size > 0 ? hold.attemptedKeys : outcomes.length
  );

  // ONE terminal event, keyed on the hold. A replay, a retry or the stale
  // sweep all derive the same key, so whichever landed first stands and the
  // rest no-op. There is nothing to compensate and nothing to unwind — the
  // whole class of round-1-through-4 settlement defects is gone by
  // construction rather than by careful ordering.
  const wrote = await finalizeSpend({
    holdId: hold.holdId,
    organizationId: hold.organizationId,
    initiatedBy: hold.initiatedBy,
    heldUsd: hold.heldUsd,
    actualUsd: totalUsd,
    kind: 'settle',
    runId: meta.runId,
  });
  hold.settled = true;

  if (!wrote) {
    // Already finalised elsewhere; do not write a second ledger row for the
    // same spend.
    return { totalUsd, perVariantUsd };
  }

  if (totalUsd > 0) {
    // Ledger write lives HERE, not in the route, so every caller is recorded —
    // including the ones that never create an ImageGeneration row.
    //
    // Deliberately AFTER the settled flip and non-fatal: the quota is the
    // money-safety record, the ledger is the audit record. A ledger failure
    // must not re-open a hold that has already been correctly settled.
    try {
      await trackPipelineCost({
        pipeline_name: 'image-generation',
        client_id: meta.organizationId,
        run_id: meta.runId,
        model: outcomes[0]?.model ?? 'unknown',
        // Image generation is billed by area/image, not tokens — the ledger's
        // token columns are NOT NULL, so zero is the honest value here.
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: totalUsd,
      });
    } catch (error) {
      logger.error('image spend: ledger write failed', {
        runId: meta.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { totalUsd, perVariantUsd };
}

/**
 * Release a whole hold when nothing was generated.
 *
 * Like settlement, `settled` flips only after the mutation commits, so a
 * transient failure leaves the hold releasable rather than silently stranded
 * (review finding 3).
 */
export async function releaseImageSpend(hold: ImageSpendHold): Promise<void> {
  if (hold.settled) return;
  await finalizeSpend({
    holdId: hold.holdId,
    organizationId: hold.organizationId,
    initiatedBy: hold.initiatedBy,
    heldUsd: hold.heldUsd,
    kind: 'release',
  });
  hold.settled = true;
}
