/**
 * Image model catalog — DATA. Mirrors lib/services/ai/video/registry.ts.
 * `grounding` marks reference-capable models; Stability/DALL-E are kept but
 * deprecated (they ignore references and are banned by the visual-content-brief
 * skill). Verify pricing at deploy.
 *
 * PRICING (SYN-1115): providers do not share one pricing shape, so `pricing` is
 * a discriminated union rather than a single per-megapixel number. A model with
 * no `pricing` cannot be costed, and estimateImageCostUsd throws
 * UnpricedModelError — generation fails CLOSED. That is the intended retirement
 * mechanism for the deprecated entries: unpriced means unusable, enforced in
 * code rather than asserted in a comment.
 */

/** Flat rate per megapixel of output. */
export interface PerMegapixelPricing {
  kind: 'per_megapixel';
  usdPerMegapixel: number;
}

/**
 * First megapixel charged at one rate, each additional megapixel at another,
 * rounded UP to the nearest megapixel (fal's FLUX.2 pro shape).
 */
export interface FirstMegapixelThenPricing {
  kind: 'first_mp_then';
  firstMegapixelUsd: number;
  extraMegapixelUsd: number;
}

/**
 * Flat price per image, banded by output long edge (Google's Gemini shape —
 * an image is a fixed token count, not an area calculation). Bands are matched
 * in order; the first band whose maxLongEdge covers the request wins.
 */
export interface PerImageBandPricing {
  kind: 'per_image_bands';
  bands: Array<{ maxLongEdge: number; usd: number }>;
  /**
   * Token cost billed ALONGSIDE the image, in USD, as a worst-case allowance.
   *
   * Google bills these models for input tokens and for text/thinking output IN
   * ADDITION to the image-output band, and the adapter requests TEXT plus
   * IMAGE. Reserving only the band systematically under-reserved every call, so
   * a near-cap request could breach the organisation or MCP ceiling without
   * even retrying (release review, pass 2).
   *
   * This is an ALLOWANCE, not a measurement: the rates are verified against
   * published pricing, the token counts are a deliberately generous bound
   * chosen because a hold must never be too small. Settlement charges what
   * actually ran and returns the rest.
   */
  tokenAllowanceUsd: number;
}

/**
 * ENFORCED token bound for the Gemini image adapter, and the money it implies.
 *
 * The first version of this reserved a token allowance chosen by judgement.
 * That is not a bound: the adapter sent no `maxOutputTokens` and no prompt
 * limit, while the model card permits 65,536 input and 32,768 output tokens
 * with thinking billed at the output rate — so the hold could be smaller than
 * the call was permitted to be (release review, pass 3).
 *
 * These caps are ENFORCED in `generateWithGemini`: a longer prompt is refused
 * before the request, and `maxOutputTokens` is sent. The allowance below is
 * DERIVED from them and the published rates, so the price and the enforcement
 * cannot drift apart — change a cap and the reservation changes with it.
 *
 * Character limit rather than a token count because tokens are only knowable
 * provider-side; one character per token is the worst case, so the limit is a
 * true upper bound on input tokens. Prompts are ~1,000 characters today.
 *
 * Rates verified 2026-08-03 against ai.google.dev/gemini-api/docs/pricing.
 */
export const GEMINI_TOKEN_BOUND = {
  maxPromptChars: 12_000,
  maxOutputTokens: 4_000,
  /** Gemini 3 Pro Image: input "$2.00 (text/image)", output "$12.00" per 1M. */
  proInputUsdPerMillion: 2.0,
  proOutputUsdPerMillion: 12.0,
  /** Gemini 2.5 Flash Image: input "$0.30 (text / image)" per 1M. */
  flashInputUsdPerMillion: 0.3,
} as const;

function geminiTokenAllowanceUsd(
  inputUsdPerMillion: number,
  outputUsdPerMillion: number
): number {
  const { maxPromptChars, maxOutputTokens } = GEMINI_TOKEN_BOUND;
  const usd =
    (maxPromptChars * inputUsdPerMillion) / 1_000_000 +
    (maxOutputTokens * outputUsdPerMillion) / 1_000_000;
  return Math.round(usd * 10000) / 10000;
}

export type ImagePricing =
  | PerMegapixelPricing
  | FirstMegapixelThenPricing
  | PerImageBandPricing;

export interface ImageModel {
  id: string;
  provider: 'fal' | 'openai' | 'stability' | 'gemini';
  label: string;
  tier: 'draft' | 'standard' | 'premium';
  /** Absent = uncostable = generation fails closed. Never guess a price. */
  pricing?: ImagePricing;
  capabilities: {
    referenceImages: number; // max refs; 0 = text-only
    imageToImage: boolean;
    maxResolution: number; // px, long edge
  };
  grounding: boolean;
  /** True for models that accept a `loras` param (dev-tier fal models only). */
  loras: boolean;
  deprecated?: boolean;
}

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: 'fal-ai/flux-2-pro',
    provider: 'fal',
    label: 'FLUX.2 pro',
    tier: 'standard',
    // Verified 2026-08-01 against fal.ai/models/fal-ai/flux-2-pro: "$0.03 for
    // the first megapixel of output, plus $0.015 per extra megapixel of input
    // and output, rounded up to the nearest megapixel." The prior flat
    // costPerMegapixelUsd: 0.03 modelled the first-MP rate as the per-MP rate
    // and so over-charged every image above 1 MP.
    pricing: {
      kind: 'first_mp_then',
      firstMegapixelUsd: 0.03,
      extraMegapixelUsd: 0.015,
    },
    capabilities: {
      referenceImages: 8,
      imageToImage: true,
      maxResolution: 4096,
    },
    grounding: true,
    loras: false,
  },
  {
    id: 'fal-ai/flux-2/lora',
    provider: 'fal',
    label: 'FLUX.2 dev LoRA',
    tier: 'standard',
    // Verified 2026-08-01 against fal.ai/models/fal-ai/flux-2/lora: "$0.021 per
    // megapixel". CAVEAT — fal adds a size surcharge for large adapters: "LoRAs
    // over 2GB in size will accrue an extra 50% charge per GB (2-3GB ×1.5,
    // 3-4GB ×2, 4-5GB ×2.5)". Synthex's only trained adapter (carpet-style-v1)
    // is far under 2GB, so the base rate is correct today. If a multi-GB
    // adapter is ever registered, this estimate under-charges and the surcharge
    // must be modelled here — tracked on the harden-next list.
    pricing: { kind: 'per_megapixel', usdPerMegapixel: 0.021 },
    capabilities: {
      referenceImages: 8,
      imageToImage: true,
      maxResolution: 4096,
    },
    grounding: true,
    loras: true,
  },
  {
    // Default for the gemini adapter (SYN-1095). `grounding` is false because the
    // adapter sends text parts only — the model itself accepts reference images, so
    // flipping this on is follow-up work in the adapter, not a registry edit.
    // Verified live against the adapter's request shape on 2026-07-15 (see SYN-1095).
    // NOTE: keep this file free of call-shaped tokens. The static guard in
    // tests/unit/ai/no-direct-image-apis.test.ts treats a bare model-id literal as a
    // violation only when the same file also shows call evidence, and it strips block
    // comments but NOT line comments — so naming the REST method here, even in a
    // comment, turns this data file into a false "direct call" and fails the build.
    id: 'gemini-3-pro-image',
    provider: 'gemini',
    label: 'Gemini 3 Pro Image (Nano Banana Pro)',
    tier: 'standard',
    // Verified 2026-08-01 against ai.google.dev/gemini-api/docs/pricing:
    // "Output images from 1024x1024px (1K) and up to 2048x2048px (2K) consume
    // 1120 tokens and are equivalent to $0.134 per image. Output images up to
    // 4096x4096px (4K) consume 2000 tokens and are equivalent to $0.24 per
    // image." Banded per-image, NOT per-megapixel — Google charges a fixed
    // token count per image, so area arithmetic would misprice it.
    // Token surcharge verified 2026-08-03 against the same page: input
    // "$2.00 (text/image)" per 1M tokens, text/thinking output "$12.00" per 1M.
    // Allowance = 12,000 input tokens ($0.024) + 4,000 thinking tokens
    // ($0.048). 12k input is generous cover for a prompt plus reference images
    // at Google's own ~1,290 tokens per 1024px image.
    pricing: {
      kind: 'per_image_bands',
      bands: [
        { maxLongEdge: 2048, usd: 0.134 },
        { maxLongEdge: 4096, usd: 0.24 },
      ],
      tokenAllowanceUsd: geminiTokenAllowanceUsd(
        GEMINI_TOKEN_BOUND.proInputUsdPerMillion,
        GEMINI_TOKEN_BOUND.proOutputUsdPerMillion
      ),
    },
    capabilities: {
      referenceImages: 0,
      imageToImage: false,
      maxResolution: 4096,
    },
    grounding: false,
    loras: false,
  },
  {
    // Superseded by gemini-3-pro-image; retained as the GEMINI_IMAGE_MODEL fallback.
    id: 'gemini-2.5-flash-image',
    provider: 'gemini',
    label: 'Gemini 2.5 Flash Image',
    tier: 'draft',
    // Verified 2026-08-01 against ai.google.dev/gemini-api/docs/pricing:
    // "Output images up to 1024x1024px consume 1290 tokens and are equivalent
    // to $0.039 per image." Google publishes no band above 1024 for this
    // model; maxResolution below is 1792, so requests between 1025 and 1792 px
    // are deliberately left UNPRICED and fail closed rather than being costed
    // at a guessed rate.
    // Token surcharge verified 2026-08-03 against the same page: input
    // "$0.30 (text / image)" per 1M tokens, with text/thinking output included
    // in the output pricing rather than rated separately. Allowance = 12,000
    // input tokens ($0.0036), the same generous bound used above.
    pricing: {
      kind: 'per_image_bands',
      bands: [{ maxLongEdge: 1024, usd: 0.039 }],
      // Flash bills text/thinking output inside the image output price rather
      // than at a separate rate, so only the input side is added.
      tokenAllowanceUsd: geminiTokenAllowanceUsd(
        GEMINI_TOKEN_BOUND.flashInputUsdPerMillion,
        0
      ),
    },
    capabilities: {
      referenceImages: 0,
      imageToImage: false,
      maxResolution: 1792,
    },
    grounding: false,
    loras: false,
  },
  {
    id: 'stable-diffusion-3',
    provider: 'stability',
    label: 'Stability SD3',
    tier: 'draft',
    capabilities: {
      referenceImages: 0,
      imageToImage: false,
      maxResolution: 1792,
    },
    grounding: false,
    loras: false,
    deprecated: true,
  },
  {
    id: 'dall-e-3',
    provider: 'openai',
    label: 'DALL-E 3',
    tier: 'draft',
    capabilities: {
      referenceImages: 0,
      imageToImage: false,
      maxResolution: 1792,
    },
    grounding: false,
    loras: false,
    deprecated: true,
  },
];

/**
 * A model that cannot be costed. Callers must treat this as a hard refusal —
 * never as "cost unknown, proceed". Routes map it to HTTP 422 alongside the
 * other fail-closed refusals.
 */
export class UnpricedModelError extends Error {
  public readonly blocked = true as const;
  constructor(
    public readonly modelId: string,
    reason: string
  ) {
    super(
      `Model "${modelId}" cannot be costed (${reason}). Generation is blocked ` +
        `until a verified price is added to lib/services/ai/image/registry.ts. ` +
        `Never guess a price — check the provider's live pricing page and record ` +
        `the verification date.`
    );
    this.name = 'UnpricedModelError';
  }
}

/**
 * Reference photos are billed as INPUT megapixels by fal's per-megapixel
 * models. Their true pixel dimensions are not known at estimate time (they are
 * whatever the owned library holds), so each one is charged at this floor.
 * fal rounds each image up to the nearest megapixel, and every image in the
 * owned library is a real photograph well above 1 MP, so 1 is the smallest
 * defensible figure — it can under-state a very large reference, never
 * over-state one below the rounding floor.
 */
const ASSUMED_INPUT_MEGAPIXELS_PER_REFERENCE = 1;

export interface EstimateInputs {
  width: number;
  height: number;
  /**
   * Reference images that will be sent with the request (SYN-1115, review
   * finding 2). Grounded calls always send some; pricing only the output
   * frame made reference spend invisible to the ceiling on the MAIN path.
   */
  referenceImageCount?: number;
}

/**
 * Worst-case USD estimate for ONE image.
 *
 * Throws UnpricedModelError when the model has no pricing, or when the request
 * falls outside every published band — spending is never allowed to proceed on
 * an unknown price.
 *
 * "Worst-case" is the contract: an estimate may over-reserve, never
 * under-reserve, because the hold is the ceiling's only teeth.
 */
export function estimateImageCostUsd(
  model: ImageModel,
  dimensions: EstimateInputs
): number {
  const { width, height } = dimensions;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new UnpricedModelError(
      model.id,
      `invalid output dimensions ${width}x${height}`
    );
  }
  if (!model.pricing) {
    throw new UnpricedModelError(model.id, 'no pricing entry in the registry');
  }

  const round = (usd: number) => Math.round(usd * 10000) / 10000;

  /**
   * Billable megapixels, rounded UP.
   *
   * The divisor is 1024×1024, NOT 1,000,000. fal publishes two worked examples
   * and only the binary megapixel reproduces both: "a 1024x1024 image will cost
   * $0.03" (1 MP) "and a 1920x1080 image will cost $0.045" (2 MP). Against a
   * decimal megapixel, 1024² is 1.049 MP and rounds up to 2, which would
   * over-charge every square image by an entire megapixel — caught by
   * tests/unit/ai/image-generation-grounding.test.ts before it shipped.
   */
  const outputMegapixels = Math.max(
    1,
    Math.ceil((width * height) / (1024 * 1024))
  );

  // fal's per-megapixel models bill "input AND output" megapixels. Reference
  // images are input. Band-priced models (Gemini) charge a flat token count
  // per image, so references do not add to their cost.
  const inputMegapixels =
    Math.max(0, Math.trunc(dimensions.referenceImageCount ?? 0)) *
    ASSUMED_INPUT_MEGAPIXELS_PER_REFERENCE;

  const billableMegapixels = outputMegapixels + inputMegapixels;

  switch (model.pricing.kind) {
    case 'per_megapixel':
      return round(billableMegapixels * model.pricing.usdPerMegapixel);
    case 'first_mp_then':
      return round(
        model.pricing.firstMegapixelUsd +
          (billableMegapixels - 1) * model.pricing.extraMegapixelUsd
      );
    case 'per_image_bands': {
      const longEdge = Math.max(width, height);
      const band = model.pricing.bands.find(b => longEdge <= b.maxLongEdge);
      if (!band) {
        throw new UnpricedModelError(
          model.id,
          `output long edge ${longEdge}px exceeds every published price band`
        );
      }
      // The band prices the IMAGE; input and text/thinking tokens are billed on
      // top and must be inside the hold (release review, pass 2).
      return round(band.usd + model.pricing.tokenAllowanceUsd);
    }
  }
}

/** Pick a model. When `needsLora` is set, return the first loras-capable,
 *  non-deprecated model (the ONLY way a `loras: true` entry is ever selected).
 *  When references are needed, return the first grounding-capable,
 *  non-deprecated, non-loras model (FLUX.2 pro today). Otherwise honour
 *  `preferred` or the first non-deprecated, non-loras entry. `loras: true`
 *  entries are excluded from every path except the explicit `needsLora` one. */
export function selectImageModel(opts: {
  needsReferences: boolean;
  needsLora?: boolean;
  preferred?: string;
}): ImageModel {
  if (opts.needsLora) {
    const lora = IMAGE_MODELS.find(m => m.loras && !m.deprecated);
    if (!lora) throw new Error('no loras-capable image model registered');
    return lora;
  }
  if (opts.needsReferences) {
    const grounded = IMAGE_MODELS.find(
      m => m.grounding && !m.loras && !m.deprecated
    );
    if (!grounded)
      throw new Error('no grounding-capable image model registered');
    return grounded;
  }
  if (opts.preferred) {
    const byId = IMAGE_MODELS.find(m => m.id === opts.preferred && !m.loras);
    if (byId) return byId;
  }
  const first = IMAGE_MODELS.find(m => !m.deprecated && !m.loras);
  if (!first) {
    // Structural guarantee: the default path NEVER returns a loras entry,
    // even if every non-loras model were deprecated (CodeRabbit #734).
    throw new Error('no non-LoRA image model available for default selection');
  }
  return first;
}
