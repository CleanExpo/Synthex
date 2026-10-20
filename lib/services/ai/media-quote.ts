/**
 * Read-only price quote for image and video generation (P5, spec M10).
 *
 * A quote runs the SAME pricing and cap logic the spend path runs and writes
 * nothing: image via priceImageHold (what holdImageSpend reserves), video via
 * resolveModel/estimateCostUsd and batchHoldUsd (what holdQuotaBatch reserves),
 * admission via firstCapBreach (what reserveSpendBatch throws on). No spend row,
 * no reservation, no provider call. Text generation keeps its own cost cap.
 *
 * Fails closed: if the budget cannot be read the quote is an error, never a
 * zero or an "admitted".
 */
import {
  batchHoldUsd,
  firstCapBreach,
  spendSnapshot,
} from '@/lib/services/ai/image/spend-log';
import {
  MAX_IMAGE_VARIANTS,
  priceImageHold,
  type MeteredImageOptions,
} from '@/lib/services/ai/image/meter';
import {
  estimateCostUsd,
  resolveModel,
} from '@/lib/services/ai/video/registry';
import { MAX_VARIANTS as MAX_VIDEO_VARIANTS } from '@/lib/services/ai/video/generation-service';
import type {
  AspectRatio,
  InitiatedBy,
  ModelTier,
} from '@/lib/services/ai/video/types';

export type MediaQuoteInput =
  | {
      kind: 'image';
      organizationId: string;
      initiatedBy: InitiatedBy;
      count: number;
      options: MeteredImageOptions;
    }
  | {
      kind: 'video';
      organizationId: string;
      initiatedBy: InitiatedBy;
      tier: ModelTier;
      aspectRatio: AspectRatio;
      durationSeconds: number;
      variants: number;
      audio?: boolean;
      requiresImage?: boolean;
    };

export interface MediaQuote {
  kind: 'image' | 'video';
  model: string;
  count: number;
  unitPriceUsd: number;
  totalUsd: number;
  holdUsd: number;
  remainingBudgetUsd: number;
  wouldBeAdmitted: boolean;
  reason?: string;
}

/** The budget could not be read; the route answers 503. */
export class MediaQuoteUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      `Media budget could not be read: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    this.name = 'MediaQuoteUnavailableError';
  }
}

/** The request cannot be priced (unknown or unpriced model, no matching tier); the route answers 422. */
export class MediaQuoteUnpriceableError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'MediaQuoteUnpriceableError';
  }
}

function priceOf(input: MediaQuoteInput) {
  if (input.kind === 'image') {
    const { count } = input;
    if (!Number.isInteger(count) || count < 1 || count > MAX_IMAGE_VARIANTS) {
      throw new RangeError(
        `image variants must be an integer 1-${MAX_IMAGE_VARIANTS} (received ${count})`
      );
    }
    const p = priceImageHold(input.options, count);
    return {
      model: p.model.id,
      unitPriceUsd: p.perImageUsd,
      totalUsd: Math.round(p.perImageUsd * count * 10000) / 10000,
      holdUsd: p.heldUsd,
      count,
    };
  }
  const { variants, durationSeconds } = input;
  if (
    !Number.isInteger(variants) ||
    variants < 1 ||
    variants > MAX_VIDEO_VARIANTS
  ) {
    throw new RangeError(
      `variants must be an integer 1-${MAX_VIDEO_VARIANTS} (received ${variants})`
    );
  }
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1) {
    throw new RangeError(
      `durationSeconds must be a positive integer (received ${durationSeconds})`
    );
  }
  const model = resolveModel(input.tier, {
    aspectRatio: input.aspectRatio,
    durationSeconds,
    audio: input.audio,
    requiresImage: input.requiresImage,
  });
  const unitPriceUsd = estimateCostUsd(model, durationSeconds);
  const holdUsd = batchHoldUsd(unitPriceUsd, variants);
  return {
    model: model.id,
    unitPriceUsd,
    totalUsd: holdUsd,
    holdUsd,
    count: variants,
  };
}

/**
 * Throws RangeError / UnpricedModelError / Error for a request that cannot be
 * priced, MediaQuoteUnavailableError when the budget cannot be read.
 */
export async function quoteMedia(input: MediaQuoteInput): Promise<MediaQuote> {
  let price: ReturnType<typeof priceOf>;
  try {
    price = priceOf(input);
  } catch (err) {
    if (err instanceof RangeError) throw err;
    throw new MediaQuoteUnpriceableError(err);
  }

  let snap: Awaited<ReturnType<typeof spendSnapshot>>;
  try {
    snap = await spendSnapshot(input.organizationId);
  } catch (err) {
    throw new MediaQuoteUnavailableError(err);
  }

  const breach = firstCapBreach({
    amountUsd: price.holdUsd,
    initiatedBy: input.initiatedBy,
    dailyCap: snap.dailyCapUsd,
    monthlyCap: snap.monthlyCapUsd,
    dailySpend: snap.dailyUsd,
    monthlySpend: snap.monthlyUsd,
    mcpDailySpend: snap.mcpDailyUsd,
  });

  const remaining = Math.max(
    0,
    Math.min(
      snap.dailyCapUsd - snap.dailyUsd,
      snap.monthlyCapUsd - snap.monthlyUsd
    )
  );

  return {
    kind: input.kind,
    model: price.model,
    count: price.count,
    unitPriceUsd: price.unitPriceUsd,
    totalUsd: price.totalUsd,
    holdUsd: price.holdUsd,
    remainingBudgetUsd: Math.round(remaining * 10000) / 10000,
    wouldBeAdmitted: breach === null,
    ...(breach && {
      reason: `${breach.cap} cap would be exceeded: $${breach.spentUsd.toFixed(2)} spent of $${breach.limitUsd.toFixed(2)} limit`,
    }),
  };
}
