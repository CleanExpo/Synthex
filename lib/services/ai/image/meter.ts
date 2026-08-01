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
import { logger } from '@/lib/logger';
import { trackPipelineCost } from '@/lib/pipelines/track-cost';
import {
  holdQuota,
  releaseQuota,
  settleQuota,
} from '@/lib/services/ai/video/quota';
import type { InitiatedBy } from '@/lib/services/ai/video/types';
import {
  estimateImageCostUsd,
  selectImageModel,
  IMAGE_MODELS,
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
 * The model whose price the estimate is based on. Mirrors the generator's own
 * selection inputs so the estimate prices the model that will actually run.
 */
export function resolveCostModel(options: MeteredImageOptions): ImageModel {
  return selectImageModel({
    needsReferences: options.useReferences !== false,
    needsLora: Boolean(options.loraId),
    preferred: options.model,
  });
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
  count: number;
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
  count: number
): Promise<ImageSpendHold> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_IMAGE_VARIANTS) {
    throw new RangeError(
      `image variants must be an integer 1-${MAX_IMAGE_VARIANTS} (received ${count})`
    );
  }

  const model = resolveCostModel(options);
  const dimensions = resolveOutputDimensions(options);
  // Throws UnpricedModelError for an uncostable model — never returns 0.
  const perImageUsd = estimateImageCostUsd(model, dimensions);
  const heldUsd = Math.round(perImageUsd * count * 10000) / 10000;

  await holdQuota(organizationId, heldUsd, initiatedBy);

  return {
    organizationId,
    initiatedBy,
    heldUsd,
    perImageUsd,
    dimensions,
    count,
    settled: false,
  };
}

/**
 * Settle a hold to what was actually generated and write the ledger entry.
 *
 * `succeeded` is the number of variants that actually produced an image; the
 * remainder is released. Idempotent. Never throws — a settlement failure must
 * not turn a successful generation into an error, but it IS logged loudly
 * because it means the quota row has drifted from reality.
 */
export async function settleImageSpend(
  hold: ImageSpendHold,
  succeeded: number,
  meta: { runId: string; model: string; organizationId: string }
): Promise<number> {
  if (hold.settled) return 0;
  hold.settled = true;

  // Re-price against the model that ACTUALLY ran, not the one the estimate
  // guessed. The two diverge in a real and common case: on the grounded path
  // the industry's trained LoRA auto-applies, so the estimate prices
  // FLUX.2 pro ($0.03/MP) while generation runs FLUX.2 dev LoRA ($0.021/MP).
  // Settling from hold.perImageUsd would make "actual" a synonym for
  // "estimate" and the ledger would never record what was really spent —
  // caught by the SYN-1115 live canary, which estimated $0.03 and ran a
  // $0.021 model.
  //
  // Falls back to the held estimate only when the model that ran is unknown
  // or unpriced, and says so in the log rather than silently substituting.
  const ranModel = IMAGE_MODELS.find(m => m.id === meta.model);
  let perImageActualUsd = hold.perImageUsd;
  if (ranModel) {
    try {
      perImageActualUsd = estimateImageCostUsd(ranModel, hold.dimensions);
    } catch (error) {
      logger.warn(
        'image spend: model that ran is unpriced — settling at the held estimate',
        {
          modelRan: meta.model,
          heldPerImageUsd: hold.perImageUsd,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  } else if (meta.model !== 'unknown') {
    logger.warn(
      'image spend: model that ran is not in the registry — settling at the held estimate',
      { modelRan: meta.model, heldPerImageUsd: hold.perImageUsd }
    );
  }

  const actualUsd =
    Math.round(perImageActualUsd * Math.max(0, succeeded) * 10000) / 10000;

  try {
    await settleQuota(
      hold.organizationId,
      hold.heldUsd,
      actualUsd,
      hold.initiatedBy
    );
  } catch (error) {
    logger.error('image spend: quota settle failed — quota row has drifted', {
      organizationId: hold.organizationId,
      heldUsd: hold.heldUsd,
      actualUsd,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (actualUsd > 0) {
    // Ledger write lives HERE, not in the route, so every caller is recorded —
    // including the ones that never create an ImageGeneration row.
    //
    // try/catch rather than .catch(): a ledger failure must never turn a
    // successful generation into an error, and awaiting inside a guard does
    // not assume the writer returns a thenable.
    try {
      await trackPipelineCost({
        pipeline_name: 'image-generation',
        client_id: meta.organizationId,
        run_id: meta.runId,
        model: meta.model,
        // Image generation is billed by area/image, not tokens — the ledger's
        // token columns are NOT NULL, so zero is the honest value here.
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: actualUsd,
      });
    } catch (error) {
      logger.error('image spend: ledger write failed', {
        runId: meta.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return actualUsd;
}

/** Release a whole hold when nothing was generated. Idempotent; never throws. */
export async function releaseImageSpend(hold: ImageSpendHold): Promise<void> {
  if (hold.settled) return;
  hold.settled = true;
  await releaseQuota(hold.organizationId, hold.heldUsd, hold.initiatedBy).catch(
    error =>
      logger.error(
        'image spend: quota release failed — hold leaked until reset',
        {
          organizationId: hold.organizationId,
          heldUsd: hold.heldUsd,
          error: error instanceof Error ? error.message : String(error),
        }
      )
  );
}
