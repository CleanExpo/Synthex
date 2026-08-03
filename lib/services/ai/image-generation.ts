/**
 * AI Image Generation Service — GROUNDED BY DEFAULT (Real Images Only mandate,
 * docs/superpowers/specs/2026-07-12-real-images-only-design.md Part A).
 *
 * @description Every generation resolves the owned reference library first and
 * applies the industry's trained LoRA automatically. No owned references for a
 * subject ⇒ the request is BLOCKED (never silently invented). The legacy
 * text-only providers (Stability/DALL-E/Gemini) are reachable ONLY via the
 * explicit, audited escape hatch `useReferences: false`, and every escape-hatch
 * result is stamped grounded:false with an UNGROUNDED warning.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - FAL_KEY: fal.ai key for the grounded FLUX default path (SECRET)
 * - STABILITY_API_KEY: Stability AI API key (SECRET, escape hatch only)
 * - OPENAI_API_KEY: OpenAI API key for DALL-E (SECRET, escape hatch only)
 * - GEMINI_API_KEY: Google Gemini API key (SECRET, escape hatch only)
 * - ANTHROPIC_API_KEY: Required for refineImagePromptWithThinking (SECRET)
 *
 * FAILURE MODE: grounded path retries once, then FAILS CLOSED (blocked-style
 * error naming the cause). AI-invention is never a fallback.
 */

import { logger } from '@/lib/logger';
import { THINKING_EFFORTS } from '@/lib/ai/constants';
import {
  requireGenerationContext,
  type GenerationContext,
  type SupportedPlatform,
} from '@/lib/ai/generation-context';
import type { TrainedLora } from '@/lib/services/ai/image/trained-loras';
import type { ResolvedReferences } from '@/lib/services/ai/reference-library';
import {
  holdImageSpend,
  releaseImageSpend,
  settleImageSpend,
  type MeteredImageOptions,
} from '@/lib/services/ai/image/meter';
import {
  isPreDispatchFailure,
  neverReachedProvider,
} from '@/lib/services/ai/image/providers/errors';
import { GEMINI_TOKEN_BOUND } from '@/lib/services/ai/image/registry';
import type { InitiatedBy } from '@/lib/services/ai/video/types';

// Provider types
export type ImageProvider = 'stability' | 'dalle' | 'gemini';

/**
 * Map the generation context's autonomy level onto the quota's initiator
 * dimension (SYN-1115), so agent-driven image spend is subject to the same
 * MCP daily sub-cap as agent-driven video spend rather than drawing freely on
 * the full org budget.
 */
function resolveInitiatedBy(ctx: GenerationContext): InitiatedBy {
  return ctx.autonomyLevel === 'autonomous' ? 'mcp' : 'studio';
}

// Image generation options
export interface ImageGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  style?:
    | 'photorealistic'
    | 'artistic'
    | 'anime'
    | 'digital-art'
    | 'cinematic'
    | 'minimalist';
  quality?: 'standard' | 'hd';
  provider?: ImageProvider;
  /**
   * TARGET social platform the image is for (SYN-MCP-003). Drives the visual
   * style trend lookup — previously `provider` ('stability'/'dalle'/'gemini')
   * was passed where a platform was expected, so the lookup silently
   * returned nothing. Defaults to 'instagram' when omitted.
   */
  platform?: SupportedPlatform;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
  /** Explicit reference set id (e.g. 'carpet-cleaning'). */
  referenceSet?: string;
  /**
   * Grounding is the DEFAULT (Real Images Only): omitted/true grounds on the
   * owned reference library (auto-detected from the prompt when no
   * referenceSet is given) and BLOCKS when no owned references resolve.
   * `false` is the explicit, audited escape hatch to the legacy text-only
   * providers — the result is stamped grounded:false + an UNGROUNDED warning.
   */
  useReferences?: boolean;
  /** Preferred image model id from the registry. */
  model?: string;
  /**
   * Trained-LoRA id (lib/services/ai/image/trained-loras.json) to condition
   * generation on. Explicit ids always win; when omitted on the grounded path
   * the industry's active LoRA is auto-applied. LoRA failures fall back to the
   * reference-grounded FLUX path (never the legacy chain while grounding is on).
   */
  loraId?: string;
}

// Generation result
export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  provider: ImageProvider;
  /**
   * Set by a guard that runs BEFORE any network I/O — a missing API key — to
   * say this failure provably sent no request. The spend meter retracts its
   * attempt claim and charges zero instead of the reservation rate, which it
   * would otherwise apply on the principle that a call which may have been
   * billed must never look free (SYN-1115 round-8).
   *
   * Never set it for a failure that could conceivably have reached the
   * provider: that would erase real spend, which is the more dangerous error.
   */
  neverReachedProvider?: boolean;
  metadata?: {
    seed?: number;
    width?: number;
    height?: number;
    model: string;
    loraApplied?: boolean;
    loraId?: string;
    loraRequested?: string;
    triggerToken?: string;
  };
  error?: string;
  grounded?: boolean;
  referenceSet?: string;
  refCount?: number;
  referenceSubject?: string;
  referenceVendor?: string;
  /** True when a resolved lora was actually routed through the LoRA adapter. */
  loraApplied?: boolean;
  /** The lora id that was applied (mirrors options.loraId on success). */
  loraId?: string;
  /** The lora id that was requested but NOT applied (fail-open: unknown id, resolution/adapter failure). */
  loraRequested?: string;
  /** The applied lora's trigger token (present alongside loraApplied: true). */
  triggerToken?: string;
  /** Non-fatal warnings surfaced to callers (e.g. prompt missing the lora trigger token). */
  warnings?: string[];
  /**
   * True when generation was REFUSED under the Real Images Only mandate:
   * either no owned references resolved for the subject, or the grounded call
   * failed after its single retry (fail-closed — AI-invention is never a
   * fallback). Routes map blocked results to 422, not 500.
   */
  blocked?: boolean;
  /**
   * Per-image estimate held before generation, USD (SYN-1115). Present on
   * every result that transited the spend meter, including failures — the
   * hold happened either way.
   */
  estimatedCostUsd?: number;
  /**
   * Settled cost for this call, USD. Only set on the single-image path; batch
   * callers settle once for the whole batch, so per-variant actuals are not
   * meaningful there.
   */
  actualCostUsd?: number;
}

/**
 * THE shared grounding gate (Real Images Only, Part A item 1). Grounding is
 * on by default; `useReferences: false` is the only escape hatch. Used by
 * BOTH generateImage and generateWithLora so the two can never drift.
 */
export function shouldGround(
  options: Pick<ImageGenerationOptions, 'useReferences'>
): boolean {
  return options.useReferences !== false;
}

/** Exact block copy (founder-mandated, Australian English) — Part A item 3. */
export const NO_REFERENCES_BLOCK_ERROR =
  'No owned references for this subject — add real photos to the reference library first.';

/** Exact escape-hatch stamp — Part A item 5. */
export const UNGROUNDED_WARNING =
  'UNGROUNDED — generated without owned references (explicit override)';

// gemini-2.0-flash-exp was retired (404 on generateContent). gemini-2.5-flash-image
// (SYN-1066) is superseded by gemini-3-pro-image ("Nano Banana Pro"), which is
// materially stronger at reference-conditioned generation — the capability the owned
// -reference grounding above depends on. Same generateContent contract and inlineData
// response shape, so this is a drop-in. Override without a deploy via GEMINI_IMAGE_MODEL.
// Both verified live 2026-07-15 (SYN-1095).
//
// Declared above LEGACY_PROVIDER_MODEL_IDS on purpose: that map reads this constant at
// module init, so a `const` declared below it would throw on the temporal dead zone.
const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';

/**
 * Registry model ids behind each legacy provider adapter, used to enforce the
 * registry's `deprecated` flags on the escape-hatch chain (Part A item 6).
 *
 * `gemini` tracks GEMINI_IMAGE_MODEL rather than hardcoding the default: the filter
 * must evaluate the model that will actually be invoked. Hardcoding the default would
 * let an override to a deprecated model slip past the deprecation gate (CodeRabbit,
 * PR #762).
 */
const LEGACY_PROVIDER_MODEL_IDS: Record<ImageProvider, string> = {
  stability: 'stable-diffusion-3',
  dalle: 'dall-e-3',
  gemini: GEMINI_IMAGE_MODEL,
};

/**
 * Fetch visual style trend insights for a platform.
 * Returns top 3 visual style insights as a comma-separated string,
 * or empty string if none available.
 */
async function getVisualStyleInsights(platform: string): Promise<string> {
  try {
    // Dynamic import to avoid circular dependencies
    const { default: prisma } = await import('@/lib/prisma');
    const now = new Date();
    const insights = await prisma.trendInsight.findMany({
      where: {
        platform,
        category: 'visual_style',
        confidence: { gte: 0.7 },
        organizationId: null, // global insights only
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      orderBy: { confidence: 'desc' },
      take: 3,
      select: { insight: true },
    });
    if (insights.length === 0) return '';
    return insights.map(i => i.insight).join('. ');
  } catch {
    return '';
  }
}

// Provider configurations
const STABILITY_API_BASE = 'https://api.stability.ai/v2beta';
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// GEMINI_IMAGE_MODEL is declared above, beside LEGACY_PROVIDER_MODEL_IDS which reads it.

// Aspect ratio to dimensions mapping
const ASPECT_RATIOS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1792, height: 1024 },
  '9:16': { width: 1024, height: 1792 },
  '4:3': { width: 1365, height: 1024 },
  '3:4': { width: 1024, height: 1365 },
};

// Style presets for enhanced prompts
const STYLE_PROMPTS: Record<string, string> = {
  photorealistic:
    'Photorealistic, high detail, professional photography, 8k resolution',
  artistic: 'Artistic interpretation, creative, visually striking, painterly',
  anime:
    'Anime style, vibrant colors, clean lines, Japanese animation aesthetic',
  'digital-art': 'Digital art, modern, sleek, professional illustration',
  cinematic: 'Cinematic, dramatic lighting, movie poster quality, epic scene',
  minimalist: 'Minimalist design, clean, simple, lots of whitespace, modern',
};

/**
 * Generate image using Stability AI (SDXL)
 */
async function generateWithStability(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    // Provably no request: this guard runs before any fetch. Marked so the
    // spend meter retracts its attempt claim instead of charging the
    // fallback rate for a call that never happened (SYN-1115 round-8).
    return {
      success: false,
      provider: 'stability',
      error: 'STABILITY_API_KEY not configured',
      neverReachedProvider: true,
    };
  }

  const dimensions = options.aspectRatio
    ? ASPECT_RATIOS[options.aspectRatio]
    : { width: options.width || 1024, height: options.height || 1024 };

  const stylePrompt = options.style ? STYLE_PROMPTS[options.style] : '';
  const fullPrompt = stylePrompt
    ? `${options.prompt}. ${stylePrompt}`
    : options.prompt;

  try {
    const response = await fetch(
      `${STABILITY_API_BASE}/stable-image/generate/sd3`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          negative_prompt:
            options.negativePrompt ||
            'blurry, low quality, distorted, deformed',
          width: dimensions.width,
          height: dimensions.height,
          seed: options.seed || Math.floor(Math.random() * 2147483647),
          steps: options.steps || 30,
          cfg_scale: options.guidanceScale || 7,
          output_format: 'png',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error instanceof Error
          ? error.message
          : String(error) || `Stability API error: ${response.status}`
      );
    }

    const data = await response.json();

    return {
      success: true,
      provider: 'stability',
      imageBase64: data.artifacts?.[0]?.base64 || data.image,
      metadata: {
        seed: data.artifacts?.[0]?.seed,
        width: dimensions.width,
        height: dimensions.height,
        model: 'stable-diffusion-3',
      },
    };
  } catch (error: unknown) {
    logger.error('Stability AI generation failed:', { error });
    return {
      success: false,
      provider: 'stability',
      error: error instanceof Error ? error.message : String(error),
      // A DNS/refused/TLS failure never reached the provider, so it must not
      // be recorded as a billable attempt — these adapters RETURN rather than
      // throw, so withAttempt would otherwise note it as succeeded at the
      // fallback cost (release review, pass 11).
      neverReachedProvider: isPreDispatchFailure(error),
    };
  }
}

/**
 * Generate image using OpenAI DALL-E 3
 */
async function generateWithDalle(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Provably no request: this guard runs before any fetch. Marked so the
    // spend meter retracts its attempt claim instead of charging the
    // fallback rate for a call that never happened (SYN-1115 round-8).
    return {
      success: false,
      provider: 'dalle',
      error: 'OPENAI_API_KEY not configured',
      neverReachedProvider: true,
    };
  }

  // DALL-E 3 supports specific sizes
  let size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024';
  if (options.aspectRatio === '16:9') size = '1792x1024';
  else if (options.aspectRatio === '9:16') size = '1024x1792';

  const stylePrompt = options.style ? STYLE_PROMPTS[options.style] : '';
  const fullPrompt = stylePrompt
    ? `${options.prompt}. ${stylePrompt}`
    : options.prompt;

  try {
    const response = await fetch(`${OPENAI_API_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: fullPrompt,
        n: 1,
        size,
        quality: options.quality || 'standard',
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error?.message || `DALL-E API error: ${response.status}`
      );
    }

    const data = await response.json();
    const [width, height] = size.split('x').map(Number);

    return {
      success: true,
      provider: 'dalle',
      imageBase64: data.data?.[0]?.b64_json,
      imageUrl: data.data?.[0]?.url,
      metadata: {
        width,
        height,
        model: 'dall-e-3',
      },
    };
  } catch (error: unknown) {
    logger.error('DALL-E generation failed:', { error });
    return {
      success: false,
      provider: 'dalle',
      error: error instanceof Error ? error.message : String(error),
      // A DNS/refused/TLS failure never reached the provider, so it must not
      // be recorded as a billable attempt — these adapters RETURN rather than
      // throw, so withAttempt would otherwise note it as succeeded at the
      // fallback cost (release review, pass 11).
      neverReachedProvider: isPreDispatchFailure(error),
    };
  }
}

/**
 * Generate image using Google Gemini Imagen
 */
async function generateWithGemini(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Provably no request: this guard runs before any fetch. Marked so the
    // spend meter retracts its attempt claim instead of charging the
    // fallback rate for a call that never happened (SYN-1115 round-8).
    return {
      success: false,
      provider: 'gemini',
      error: 'GEMINI_API_KEY not configured',
      neverReachedProvider: true,
    };
  }

  const stylePrompt = options.style ? STYLE_PROMPTS[options.style] : '';
  const fullPrompt = stylePrompt
    ? `${options.prompt}. ${stylePrompt}`
    : options.prompt;

  // ENFORCE the bound the reservation was priced against. Gemini bills input
  // and text/thinking output on top of the image band, and the model card
  // permits far more of both than a hold could plausibly cover — so without a
  // cap here the reservation was a guess rather than a ceiling, and a direct
  // service caller could reach the provider with a hold smaller than the call
  // it was allowed to make (release review, pass 3).
  //
  // Refused BEFORE the request, so an over-long prompt costs nothing.
  const requestText = `Generate an image: ${fullPrompt}`;
  if (requestText.length > GEMINI_TOKEN_BOUND.maxPromptChars) {
    return {
      success: false,
      provider: 'gemini',
      error:
        `prompt is ${requestText.length} characters, over the ` +
        `${GEMINI_TOKEN_BOUND.maxPromptChars}-character bound this model's ` +
        'spend reservation is priced against',
      neverReachedProvider: true,
    };
  }

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: requestText,
                },
              ],
            },
          ],
          generationConfig: {
            // Image models require the IMAGE modality; responseMimeType must NOT be
            // set here (image/png is rejected with 400 — allowed values are text/*).
            responseModalities: ['IMAGE', 'TEXT'],
            // Caps the text/thinking output the reservation is priced against.
            maxOutputTokens: GEMINI_TOKEN_BOUND.maxOutputTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error?.message || `Gemini API error: ${response.status}`
      );
    }

    const data = await response.json();

    // Extract image from response
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (part: { inlineData?: { mimeType?: string; data?: string } }) =>
        part.inlineData?.mimeType?.startsWith('image/')
    );

    if (!imagePart) {
      throw new Error('No image in Gemini response');
    }

    const dimensions = options.aspectRatio
      ? ASPECT_RATIOS[options.aspectRatio]
      : { width: 1024, height: 1024 };

    return {
      success: true,
      provider: 'gemini',
      imageBase64: imagePart.inlineData.data,
      metadata: {
        width: dimensions.width,
        height: dimensions.height,
        model: GEMINI_IMAGE_MODEL,
      },
    };
  } catch (error: unknown) {
    logger.error('Gemini generation failed:', { error });
    return {
      success: false,
      provider: 'gemini',
      error: error instanceof Error ? error.message : String(error),
      // A DNS/refused/TLS failure never reached the provider, so it must not
      // be recorded as a billable attempt — these adapters RETURN rather than
      // throw, so withAttempt would otherwise note it as succeeded at the
      // fallback cost (release review, pass 11).
      neverReachedProvider: isPreDispatchFailure(error),
    };
  }
}

/**
 * Refine an image prompt using Claude adaptive thinking.
 * Gives the model space to reason about brand coherence before outputting a final prompt.
 * Returns the original prompt unchanged if ANTHROPIC_API_KEY is not set.
 *
 * @param rawPrompt - Initial image description
 * @param brandContext - Optional brand DNA / style context for coherence reasoning
 */
export async function refineImagePromptWithThinking(
  rawPrompt: string,
  brandContext?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return rawPrompt;

  try {
    const { getAIProvider } = await import('@/lib/ai/providers');
    const provider = getAIProvider({ provider: 'anthropic', apiKey });

    const systemPrompt = brandContext
      ? `You are a visual creative director. Use the brand context below to refine image prompts for maximum brand coherence.\n\nBrand Context:\n${brandContext}`
      : 'You are a visual creative director. Refine image generation prompts for maximum visual quality and specificity.';

    const response = await provider.complete({
      model: provider.models.balanced,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Refine this image prompt to be more specific, visually rich, and brand-coherent. Return ONLY the refined prompt, nothing else.\n\nOriginal prompt: ${rawPrompt}`,
        },
      ],
      max_tokens: 300,
      thinking: THINKING_EFFORTS.medium,
    });

    const refined = response.choices[0]?.message?.content?.trim();
    return refined || rawPrompt;
  } catch {
    return rawPrompt;
  }
}

/**
 * Route a resolved trained LoRA through the dedicated FLUX.2 dev LoRA adapter
 * (SYN carpet-style-lora, Task 3). References resolve under the SAME shared
 * shouldGround gate as generateImage (grounded by default); when they resolve,
 * the adapter routes to /lora/edit (compose: both lora + reference lineage in
 * the result) instead of /lora (LoRA-only). Throws on any adapter failure —
 * the caller (generateImage) catches and falls back to the reference-grounded
 * FLUX path (grounding on) or the audited legacy chain (escape hatch only).
 */
async function generateWithLora(
  options: ImageGenerationOptions,
  lora: TrainedLora,
  spend: SpendContext | null
): Promise<ImageGenerationResult> {
  const useRefs = shouldGround(options);

  let imageUrls: string[] | undefined;
  let groundedFields:
    | {
        referenceSet?: string;
        refCount: number;
        referenceSubject?: string;
        referenceVendor?: string;
      }
    | undefined;

  if (useRefs) {
    try {
      const { resolveReferences } =
        await import('@/lib/services/ai/reference-library');
      const refs = resolveReferences({
        set: options.referenceSet,
        prompt: options.prompt,
      });
      if (refs.count > 0) {
        const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
        const publicUrls = base ? refs.imagePaths.map(p => `${base}${p}`) : [];
        if (!base) {
          logger.warn(
            'lora compose: NEXT_PUBLIC_APP_URL not set — public refs skipped; using private signed refs if available'
          );
        }
        // Private customer refs via short-lived signed URLs (never public).
        const { resolvePrivateReferenceUrls } =
          await import('@/lib/services/ai/reference-library-private');
        const privateUrls = await resolvePrivateReferenceUrls(refs.industry, 4);
        const combined = [...publicUrls, ...privateUrls];
        if (combined.length > 0) {
          imageUrls = combined;
          groundedFields = {
            referenceSet: refs.industry ?? undefined,
            refCount: combined.length,
            referenceSubject: refs.subject ?? undefined,
            referenceVendor: refs.vendorKey,
          };
        }
      }
    } catch (error: unknown) {
      // Reference resolution is best-effort here — a failure degrades to
      // lora-only generation rather than dropping the lora entirely (that
      // full fail-open is reserved for the adapter call itself throwing).
      logger.warn(
        'lora compose: reference resolution failed; proceeding lora-only',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  const { selectImageModel } = await import('@/lib/services/ai/image/registry');
  const { generateFluxLoraImage } =
    await import('@/lib/services/ai/image/providers/flux-lora-fal');
  const model = selectImageModel({ needsReferences: false, needsLora: true });

  const flux = await withAttempt(
    spend,
    {
      label: 'lora',
      provider: 'fal',
      modelId: 'fal-ai/flux-2/lora',
      inputImageCount: imageUrls?.length ?? 0,
      seed: options.seed,
    },
    () =>
      generateFluxLoraImage({
        prompt: options.prompt,
        loras: [{ path: lora.loraUrl }],
        imageUrls,
        seed: options.seed,
        // The REQUESTED frame — the same value the hold priced, not a
        // re-derivation of it. This used to be omitted entirely, so fal chose
        // its own output size while the hold had been sized for
        // `resolveOutputDimensions(options)`: the reservation priced a request
        // nobody sent (release review, pass 4).
        //
        // This binds the BILL only insofar as fal honours `image_size`, which
        // rests on its documented request contract and has NOT been verified
        // against observed output. The reference bound below is the guarantee
        // that does not depend on provider behaviour, because it governs which
        // bytes we choose to send (release review, pass 6).
        imageSize: spend?.dimensions,
      })
  );

  const warnings: string[] = [];
  if (!options.prompt.includes(lora.triggerToken)) {
    logger.warn('generateImage: prompt missing lora trigger token', {
      loraId: lora.id,
      triggerToken: lora.triggerToken,
    });
    warnings.push(
      `Prompt does not include the "${lora.triggerToken}" trigger token for lora "${lora.id}" — the trained style may not apply as expected.`
    );
  }
  if (useRefs && !groundedFields) {
    // Grounding was on but references could not be attached (resolution
    // failure / zero resolvable URLs) — degradation to LoRA-only must be
    // visible to callers, never silent. The LoRA weights themselves are
    // trained on owned images, so this is not a legacy-provider fallback.
    warnings.push('References unavailable — LoRA-only generation.');
  }
  if (!useRefs) {
    // Explicit escape hatch: stamp loudly (Part A item 5).
    warnings.push(UNGROUNDED_WARNING);
  }

  return {
    success: true,
    provider: 'stability', // provider union unchanged; model.id is authoritative
    imageUrl: flux.imageUrl,
    loraApplied: true,
    loraId: lora.id,
    triggerToken: lora.triggerToken,
    ...(groundedFields
      ? {
          grounded: true,
          referenceSet: groundedFields.referenceSet,
          refCount: groundedFields.refCount,
          referenceSubject: groundedFields.referenceSubject,
          referenceVendor: groundedFields.referenceVendor,
        }
      : {}),
    ...(useRefs ? {} : { grounded: false }),
    ...(warnings.length > 0 ? { warnings } : {}),
    metadata: {
      seed: flux.seed,
      model: model.id,
      loraApplied: true,
      loraId: lora.id,
      triggerToken: lora.triggerToken,
    },
  };
}

/**
 * Main image generation function — GROUNDED BY DEFAULT (Real Images Only).
 *
 * Default path: resolve owned references (explicit set or prompt auto-detect),
 * BLOCK when none resolve, auto-apply the industry's active trained LoRA, and
 * generate via reference-grounded FLUX with one retry then fail-closed. The
 * legacy text-only chain (Stability/DALL-E/Gemini) is reachable ONLY via the
 * explicit escape hatch `useReferences: false`, and every escape-hatch result
 * is stamped grounded:false + UNGROUNDED warning.
 *
 * @param ctx Mandatory GenerationContext (SYN-MCP-003) — server-built
 *   actor/tenant context. Internal callers use systemGenerationContext().
 */
/**
 * A pinned legacy provider is incompatible with grounding (Part A item 6): the
 * pin would bypass the owned-reference path, so it REQUIRES the explicit escape
 * hatch. Validation error, not a block.
 *
 * Extracted (SYN-1115) so it runs BEFORE the spend meter. Metering an invalid
 * request would resolve references and take a hold for a call that can never
 * happen.
 */
function validateProviderPin(
  options: ImageGenerationOptions
): ImageGenerationResult | null {
  if (shouldGround(options) && options.provider) {
    return {
      success: false,
      provider: options.provider,
      grounded: false,
      error: `Explicit provider pin ('${options.provider}') requires the ungrounded escape hatch — pass useReferences: false to generate without owned references.`,
    };
  }
  return null;
}

async function generateImageUnmetered(
  options: ImageGenerationOptions,
  ctx: GenerationContext,
  spend: SpendContext | null = null
): Promise<ImageGenerationResult> {
  requireGenerationContext(ctx, 'generateImage');

  const grounding = shouldGround(options);

  const pinError = validateProviderPin(options);
  if (pinError) return pinError;

  // Stamps fail-open lora lineage (loraRequested/loraApplied:false) onto the
  // final result — a no-op when no lora was requested/auto-resolved.
  let loraRequested: string | undefined;
  const finalizeResult = (
    result: ImageGenerationResult
  ): ImageGenerationResult => {
    if (!loraRequested) return result;
    return {
      ...result,
      loraRequested,
      loraApplied: false,
      metadata: result.metadata
        ? { ...result.metadata, loraRequested, loraApplied: false }
        : result.metadata,
    };
  };

  if (grounding) {
    // ---- GROUNDED DEFAULT PATH (Real Images Only, Part A items 2-4, 7-8) ----
    // Resolve owned references first: explicit referenceSet, or prompt
    // auto-detect (resolveReferences already does prompt→industry detection).
    let refs: ResolvedReferences;
    try {
      const { resolveReferences } =
        await import('@/lib/services/ai/reference-library');
      refs = resolveReferences({
        set: options.referenceSet,
        prompt: options.prompt,
      });
    } catch (error: unknown) {
      // Manifest resolution is sync + deterministic — a throw here cannot be
      // retried away. Fail closed naming the real cause; never invent.
      const cause = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        provider: 'stability',
        grounded: false,
        blocked: true,
        error: `Grounded generation failed: reference resolution failed — ${cause}`,
      };
    }

    // BLOCK on no coverage (Part A item 3): no owned references ⇒ no
    // generation. No provider is ever called.
    if (refs.count === 0) {
      return {
        success: false,
        provider: 'stability',
        grounded: false,
        blocked: true,
        error: NO_REFERENCES_BLOCK_ERROR,
      };
    }

    // LoRA (Part A item 7): explicit loraId always wins; when absent, the
    // industry's active trained LoRA is auto-applied. No active LoRA for the
    // industry → plain grounded FLUX (never a block).
    let lora: TrainedLora | null = null;
    try {
      const { resolveLora, resolveLoraForIndustry } =
        await import('@/lib/services/ai/image/trained-loras');
      if (options.loraId) {
        lora = resolveLora(options.loraId);
        if (!lora) {
          loraRequested = options.loraId;
          logger.warn(
            'generateImage: requested lora not found; falling back to grounded generation',
            { loraId: options.loraId }
          );
        }
      } else {
        lora = resolveLoraForIndustry(refs.industry);
      }
    } catch (error: unknown) {
      if (options.loraId) loraRequested = options.loraId;
      logger.warn(
        'generateImage: lora resolution failed; falling back to grounded generation',
        {
          loraId: options.loraId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    if (lora) {
      try {
        return await generateWithLora(options, lora, spend);
      } catch (error: unknown) {
        // LoRA failure falls back to the reference-grounded FLUX path (Part A
        // item 8) — the legacy chain is unreachable while grounding is on.
        loraRequested = options.loraId ?? lora.id;
        logger.warn(
          'generateImage: lora generation failed; falling back to reference-grounded FLUX',
          {
            loraId: lora.id,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    }

    // Reference-grounded FLUX with ONE retry, then fail-closed (Part A item
    // 4). The old silent fall-through to stability/dalle/gemini is removed —
    // AI-invention is never a fallback.
    const runGroundedFlux = async (): Promise<ImageGenerationResult> => {
      const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
      const publicUrls = base ? refs.imagePaths.map(p => `${base}${p}`) : [];
      if (!base) {
        logger.warn(
          'reference grounding: NEXT_PUBLIC_APP_URL not set — public refs skipped; using private signed refs if available'
        );
      }
      // Append short-lived SIGNED URLs for owned PRIVATE refs (customer
      // job-site photos in the private Supabase bucket — never public). fal
      // fetches them during generation; the URLs expire afterwards.
      const { resolvePrivateReferenceUrls } =
        await import('@/lib/services/ai/reference-library-private');
      const privateUrls = await resolvePrivateReferenceUrls(refs.industry, 4);
      const imageUrls = [...publicUrls, ...privateUrls];
      if (imageUrls.length === 0) {
        throw new Error(
          `no resolvable reference URLs for set "${refs.industry ?? 'auto'}"`
        );
      }
      const { selectImageModel } =
        await import('@/lib/services/ai/image/registry');
      const { generateFluxImage } =
        await import('@/lib/services/ai/image/providers/flux-fal');
      const model = selectImageModel({
        needsReferences: true,
        preferred: options.model,
      });
      const flux = await withAttempt(
        spend,
        {
          label: 'flux',
          provider: 'fal',
          modelId: model.id,
          inputImageCount: imageUrls.length,
          seed: options.seed,
        },
        () =>
          generateFluxImage({
            prompt: options.prompt,
            imageUrls,
            seed: options.seed,
            // The REQUESTED frame — see the LoRA call site above, including
            // the caveat that this binds the bill only if fal honours it.
            imageSize: spend?.dimensions,
          })
      );
      return finalizeResult({
        success: true,
        provider: 'stability', // provider union unchanged; model is authoritative
        imageUrl: flux.imageUrl,
        grounded: true,
        referenceSet: refs.industry ?? undefined,
        refCount: imageUrls.length,
        referenceSubject: refs.subject ?? undefined,
        referenceVendor: refs.vendorKey,
        metadata: {
          seed: flux.seed,
          // width/height intentionally omitted — unknown until the live
          // fal response is parsed (deferred); never fake dimensions.
          model: model.id,
        },
      });
    };

    try {
      return await runGroundedFlux();
    } catch (error: unknown) {
      logger.warn(
        'grounded generation failed; retrying once (fail-closed — Real Images Only)',
        { error: error instanceof Error ? error.message : String(error) }
      );
      try {
        return await runGroundedFlux();
      } catch (retryError: unknown) {
        const cause =
          retryError instanceof Error ? retryError.message : String(retryError);
        return finalizeResult({
          success: false,
          provider: 'stability',
          grounded: false,
          blocked: true,
          error: `Grounded generation failed after retry: ${cause}`,
        });
      }
    }
  }

  // ---- ESCAPE HATCH (useReferences === false) — audited legacy chain ----
  // The ONLY road to the text-only providers (Part A item 5). Every result
  // from here down is stamped grounded:false + UNGROUNDED warning.
  const stampUngrounded = (
    result: ImageGenerationResult
  ): ImageGenerationResult => ({
    ...result,
    grounded: false,
    warnings: [...(result.warnings ?? []), UNGROUNDED_WARNING],
  });

  if (options.loraId) {
    // Explicit LoRA under the escape hatch: LoRA-only /lora generation (the
    // weights are owned-image-trained; generateWithLora stamps the UNGROUNDED
    // warning itself). Failures fall to the legacy chain, which the explicit
    // escape hatch sanctions.
    try {
      const { resolveLora } =
        await import('@/lib/services/ai/image/trained-loras');
      const lora = resolveLora(options.loraId);
      if (!lora) {
        loraRequested = options.loraId;
        logger.warn(
          'generateImage: requested lora not found; proceeding without lora',
          { loraId: options.loraId }
        );
      } else {
        try {
          return await generateWithLora(options, lora, spend);
        } catch (error: unknown) {
          loraRequested = options.loraId;
          logger.warn(
            'generateImage: lora generation failed; falling back to legacy generation',
            {
              loraId: options.loraId,
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      }
    } catch (error: unknown) {
      loraRequested = options.loraId;
      logger.warn(
        'generateImage: lora resolution failed; proceeding without lora',
        {
          loraId: options.loraId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  // Enrich prompt with visual style trends for the TARGET PLATFORM.
  // SYN-MCP-003 fix: this previously passed options.provider (an ImageProvider
  // like 'stability') where a platform is expected — no trendInsight row ever
  // matched, so brand-relevant visual trends were silently dropped.
  const visualTrends = await getVisualStyleInsights(
    options.platform ?? 'instagram'
  );
  const enrichedOptions: ImageGenerationOptions = visualTrends
    ? {
        ...options,
        prompt: `${options.prompt}. Visual style trends: ${visualTrends}`,
      }
    : options;

  // Deprecated-provider enforcement (Part A item 6): the registry's
  // `deprecated` flags gate the default escape-hatch chain. An explicit
  // options.provider pin (which required the escape hatch to get here)
  // bypasses the filter.
  const { IMAGE_MODELS } = await import('@/lib/services/ai/image/registry');
  const deprecatedModelIds = new Set(
    IMAGE_MODELS.filter(m => m.deprecated).map(m => m.id)
  );
  const providers: ImageProvider[] = enrichedOptions.provider
    ? [enrichedOptions.provider]
    : (['stability', 'dalle', 'gemini'] as ImageProvider[]).filter(
        p => !deprecatedModelIds.has(LEGACY_PROVIDER_MODEL_IDS[p])
      );

  if (providers.length === 0) {
    return finalizeResult(
      stampUngrounded({
        success: false,
        provider: 'stability',
        error:
          'All legacy providers are deprecated — pin one explicitly via options.provider.',
      })
    );
  }

  for (const provider of providers) {
    logger.info(`Attempting image generation with ${provider}`, {
      prompt: enrichedOptions.prompt.substring(0, 100),
    });

    let result: ImageGenerationResult;

    switch (provider) {
      case 'stability':
        result = await withAttempt(
          spend,
          {
            label: `legacy-${provider}`,
            provider: 'stability',
            modelId: LEGACY_PROVIDER_MODEL_IDS.stability,
            seed: enrichedOptions.seed,
          },
          () => generateWithStability(enrichedOptions)
        );
        break;
      case 'dalle':
        result = await withAttempt(
          spend,
          {
            label: `legacy-${provider}`,
            provider: 'dalle',
            modelId: LEGACY_PROVIDER_MODEL_IDS.dalle,
            seed: enrichedOptions.seed,
          },
          () => generateWithDalle(enrichedOptions)
        );
        break;
      case 'gemini':
        result = await withAttempt(
          spend,
          {
            label: `legacy-${provider}`,
            provider: 'gemini',
            modelId: LEGACY_PROVIDER_MODEL_IDS.gemini,
            seed: enrichedOptions.seed,
          },
          () => generateWithGemini(enrichedOptions)
        );
        break;
      default:
        continue;
    }

    if (result.success) {
      logger.info(`Image generated successfully with ${provider}`);
      return finalizeResult(stampUngrounded(result));
    }

    logger.warn(`${provider} failed, trying next provider`, {
      error: result.error,
    });
  }

  return finalizeResult(
    stampUngrounded({
      success: false,
      provider: providers[0],
      error: 'All image generation providers failed',
    })
  );
}

/**
 * Spend identity threaded into the generator so every REAL provider call can be
 * recorded (SYN-1115 round-7). Absent only for callers that bypass the meter,
 * which the CI guard prevents in product code.
 */
interface SpendContext {
  holdId: string;
  organizationId: string;
  /** Reservation rate, used when a provider reports no usable cost signal. */
  perImageUsd: number;
  dimensions: { width: number; height: number };
  /**
   * Distinguishes variants of one hold in the attempt key. Carried ON the
   * context rather than in module scope: variants of a batch run concurrently,
   * so a shared counter would be read by the wrong one.
   */
  variant: number;
  /**
   * The hold's set of attempted attempt keys. Added to BEFORE each provider
   * call, so settlement has the caller's own proof of how many paid calls were
   * made and a lost attempt write cannot erase them (SYN-1115 round-8).
   *
   * REQUIRED, deliberately. The first version of this made it optional and the
   * two batch paths below silently omitted it, so their floor fell back to
   * `outcomes.length` — which excludes variants that failed at the provider,
   * and an all-failed paid batch settled at $0. Optional meant the compiler
   * could not see the omission; required means a new construction site cannot
   * forget it.
   */
  attemptedKeys: Set<string>;
  /** Per-hold invocation counter — see ImageSpendHold.attemptSeq. */
  attemptSeq: { n: number };
}

// NOTE (SYN-1115 round-8): this context was previously module-scoped mutable
// state (`let activeSpend`), assigned by each metered wrapper for the duration
// of a call. That was a cross-tenant attribution bug, not merely untidy: every
// `await` inside a generation yields the event loop, so two concurrent requests
// interleaved, the second overwrote the first's context, and the first then
// recorded its provider attempts against the WRONG hold and the WRONG
// organisation — charging one customer for another's spend. Passing the context
// explicitly is the fix; there is deliberately no module-level spend state
// anywhere in this file now.

/**
 * Wrap a provider invocation so the paid call is recorded whatever happens.
 *
 * The row is written BEFORE the call with an unknown cost — an attempt that may
 * have been billed must never look free — and updated with the outcome after.
 * That ordering is what lets the sweep distinguish "died before spending" from
 * "spent, then died", which no amount of post-hoc reasoning could.
 */
async function withAttempt<T>(
  spend: SpendContext | null,
  meta: {
    label: string;
    provider: string;
    modelId: string;
    inputImageCount?: number;
    costUsd?: number;
    /** Distinguishes concurrent batch variants of the same hold. */
    seed?: number;
  },
  fn: () => Promise<T>
): Promise<T> {
  if (!spend) return fn();

  const { recordAttempt } = await import('@/lib/services/ai/image/spend-log');

  // Key must be stable across the two notes of ONE invocation (submitted, then
  // succeeded/failed) but distinct across genuinely separate paid calls —
  // variants, fallbacks and the grounded retry all get their own row.
  //
  // The shape alone does NOT achieve that: the grounded FLUX retry re-derives
  // an identical label/model/variant/seed, so two paid calls collapsed onto one
  // key and one row. A per-hold invocation sequence makes each call distinct
  // while both notes of a single call still share the key, since it is
  // computed once here (SYN-1115 round-8).
  const attemptKey = [
    spend.holdId,
    meta.label,
    meta.modelId,
    String(spend.variant),
    meta.seed === undefined ? '' : String(meta.seed),
    `#${(spend.attemptSeq.n += 1)}`,
  ].join(':');

  const base = {
    attemptKey,
    holdId: spend.holdId,
    organizationId: spend.organizationId,
    mediaType: 'image' as const,
    provider: meta.provider,
    modelId: meta.modelId,
    inputImageCount: meta.inputImageCount ?? 0,
  };

  // Claimed BEFORE the call, and independently of whether the write below
  // succeeds. This is the floor settlement trusts: the attempt TABLE can lose
  // a row, but the caller cannot lose the fact that it made the call
  // (SYN-1115 round-8).
  spend.attemptedKeys.add(attemptKey);

  // try/catch rather than .catch(): bookkeeping must never break a generation,
  // and awaiting inside a guard does not assume the writer returns a thenable.
  const note = async (
    status: 'submitted' | 'succeeded' | 'failed',
    costUsd: number | null,
    dims?: { width: number; height: number }
  ): Promise<void> => {
    try {
      await recordAttempt({
        ...base,
        status,
        costUsd,
        outputWidth: dims?.width,
        outputHeight: dims?.height,
      });
    } catch (error) {
      logger.error('media spend: could not record provider attempt', {
        attemptKey,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Written BEFORE the call with an unknown cost — an attempt that may have
  // been billed must never look free.
  await note('submitted', null);

  try {
    const out = await fn();
    // The legacy adapters RETURN a failure rather than throwing, so a
    // provably-local one has to be caught here as well as in the catch below.
    // Without this the ungrounded chain records a succeeded attempt, at the
    // estimate, for a provider whose key is absent — zero HTTP requests
    // charged as spend (SYN-1115 round-8).
    if (neverReachedProvider(out)) {
      spend.attemptedKeys.delete(attemptKey);
      await note('failed', 0);
      return out;
    }
    await note(
      'succeeded',
      meta.costUsd ?? spend.perImageUsd,
      spend.dimensions
    );
    return out;
  } catch (error) {
    // A throw does NOT prove the provider did not bill — a timeout after the
    // request was accepted is billable. Leave the cost unknown rather than
    // asserting zero; settlement and the sweep charge the reservation rate for
    // an unknown, which errs high instead of erasing real spend.
    //
    // UNLESS the adapter proved otherwise. A preflight guard that fires before
    // any fetch — a missing API key — means no request left the process, so
    // there is nothing to bill. Erring high there is not caution but invention:
    // a grounded variant with no key would be charged for the LoRA try, the
    // FLUX fallback and the FLUX retry having made zero calls, times every
    // variant of the batch. Retract the claim and record a known zero
    // (SYN-1115 round-8).
    // A missing API key is not the only provably-unsent failure. DNS
    // resolution, a refused connection and a TLS handshake error all happen
    // before any bytes reach the provider, so nothing can have been billed —
    // yet they arrived here as ordinary errors, kept the attempted-key floor,
    // and were settled at the fallback rate. During an outage a grounded run's
    // LoRA try, FLUX fallback and retry could consume the whole three-call
    // reservation with zero requests sent (release review, pass 11; the video
    // adapter had this classification, the image path did not).
    if (neverReachedProvider(error) || isPreDispatchFailure(error)) {
      spend.attemptedKeys.delete(attemptKey);
      await note('failed', 0);
      throw error;
    }
    await note('failed', null);
    throw error;
  }
}

/**
 * Build the metering view of a request (SYN-1115, review findings 1 + 2).
 *
 * Two things the estimate previously ignored and had to stop ignoring:
 *  - `provider`: an explicit legacy pin decides which model actually runs, and
 *    a pin to a deprecated/unpriced one must fail closed rather than inherit a
 *    FLUX price.
 *  - `referenceImageCount`: grounded calls send reference photos, which fal
 *    bills as INPUT megapixels. Resolving them here (cheap, deterministic,
 *    manifest-only — no network) means the hold covers them.
 */
async function meteredOptions(
  options: ImageGenerationOptions
): Promise<MeteredImageOptions> {
  const base: MeteredImageOptions = {
    width: options.width,
    height: options.height,
    aspectRatio: options.aspectRatio,
    model: options.model,
    loraId: options.loraId,
    useReferences: options.useReferences,
    provider: options.provider,
    referenceImageCount: 0,
  };

  if (!shouldGround(options)) return base;

  try {
    const { resolveReferences } =
      await import('@/lib/services/ai/reference-library');
    const refs = resolveReferences({
      set: options.referenceSet,
      prompt: options.prompt,
    });
    // Worst case = public manifest refs the resolver found PLUS the private
    // signed refs the generator will append. Private refs cannot be counted
    // cheaply here (resolving them mints signed URLs), so the cap is assumed.
    return {
      ...base,
      referenceImageCount: refs.count + MAX_PRIVATE_REFERENCES,
    };
  } catch {
    // Resolution failure here is not fatal to METERING — the generator will
    // block on the same failure a moment later. Estimate at both caps so the
    // hold is never smaller than the run could bill.
    return {
      ...base,
      referenceImageCount: MAX_PUBLIC_REFERENCES + MAX_PRIVATE_REFERENCES,
    };
  }
}

/** Resolver default cap for PUBLIC manifest references. */
const MAX_PUBLIC_REFERENCES = 4;

/**
 * Grounded generation appends up to this many short-lived SIGNED PRIVATE
 * references on top of the public manifest ones — see the two call sites of
 * `resolvePrivateReferenceUrls`, both of which pass 4.
 *
 * The hold must assume they will be sent (SYN-1115, round-2 review finding 1):
 * counting only the public manifest held 4 references while the paid call could
 * send 8, leaving half the billable input outside the ceiling.
 */
const MAX_PRIVATE_REFERENCES = 4;

/**
 * Settle a multi-variant run per variant and stamp each result with its own
 * actual cost, so the PRODUCT write path has a real number to persist
 * (review findings 5 + 6).
 */
async function stampActuals(
  results: ImageGenerationResult[],
  hold: Awaited<ReturnType<typeof holdImageSpend>>,
  ctx: GenerationContext
): Promise<void> {
  const successIndexes: number[] = [];
  const outcomes: Array<{ model: string; referenceImageCount?: number }> = [];
  results.forEach((r, i) => {
    if (!r.success) return;
    successIndexes.push(i);
    outcomes.push({
      model: r.metadata?.model ?? 'unknown',
      // The result knows exactly how many references were actually sent
      // (public + private). Settling on the hold's ASSUMED count would keep
      // real input spend out of the ledger (round-2 review finding 1).
      referenceImageCount: r.refCount,
    });
  });

  const { perVariantUsd } = await settleImageSpend(hold, outcomes, {
    runId: ctx.traceId,
    organizationId: ctx.organizationId,
  });

  successIndexes.forEach((resultIndex, outcomeIndex) => {
    results[resultIndex].actualCostUsd = perVariantUsd[outcomeIndex] ?? 0;
  });
  // Failed variants cost nothing.
  results.forEach(r => {
    if (!r.success) r.actualCostUsd = 0;
  });
}

/**
 * THE metered entry point (SYN-1115). Estimates the cost, holds it against the
 * organisation's shared media budget, runs the generation, then settles to what
 * was actually produced.
 *
 * Everything about grounding, LoRA and provider selection lives in
 * generateImageUnmetered and is unchanged — this wrapper only guarantees that
 * no caller reaches a provider without transiting a hold. `UnpricedModelError`
 * and `QuotaExceededError` both propagate, both fail closed, and both fire
 * before a single byte reaches a provider.
 */
export async function generateImage(
  options: ImageGenerationOptions,
  ctx: GenerationContext
): Promise<ImageGenerationResult> {
  requireGenerationContext(ctx, 'generateImage');

  // Validate before spending anything — an invalid request must not resolve
  // references or take a hold.
  const pinError = validateProviderPin(options);
  if (pinError) return pinError;

  const hold = await holdImageSpend(
    ctx.organizationId,
    resolveInitiatedBy(ctx),
    await meteredOptions(options),
    1,
    ctx.traceId
  );

  const spend: SpendContext = {
    holdId: hold.holdId,
    organizationId: ctx.organizationId,
    perImageUsd: hold.perImageUsd,
    dimensions: hold.dimensions,
    variant: 0,
    attemptedKeys: hold.attemptedKeys,
    attemptSeq: hold.attemptSeq,
  };

  let result: ImageGenerationResult;
  try {
    result = await generateImageUnmetered(options, ctx, spend);
  } catch (error) {
    await releaseImageSpend(hold).catch(() => undefined);
    throw error;
  }

  // A blocked or failed generation produced no image, so it costs nothing —
  // settling with no outcomes releases the whole hold.
  const outcomes = result.success
    ? [
        {
          model: result.metadata?.model ?? options.model ?? 'unknown',
          referenceImageCount: result.refCount,
        },
      ]
    : [];
  const { totalUsd } = await settleImageSpend(hold, outcomes, {
    runId: ctx.traceId,
    organizationId: ctx.organizationId,
  });

  return {
    ...result,
    estimatedCostUsd: hold.perImageUsd,
    actualCostUsd: totalUsd,
  };
}

/**
 * Generate multiple image variations. Delegates to the unmetered generator per
 * variant under ONE batch-wide hold, so it inherits the grounded-by-default
 * contract (block on no coverage, auto-LoRA, escape-hatch stamping) — Part A
 * item 9 — without double-holding.
 *
 * @param ctx Mandatory GenerationContext (SYN-MCP-003), threaded into every
 *   underlying generateImage call.
 */
export async function generateVariations(
  options: ImageGenerationOptions,
  ctx: GenerationContext,
  count: number = 4
): Promise<ImageGenerationResult[]> {
  requireGenerationContext(ctx, 'generateVariations');
  const results: ImageGenerationResult[] = [];

  // ONE hold for the whole run, before the first provider call. Throws
  // RangeError above MAX_IMAGE_VARIANTS and QuotaExceededError over budget.
  const hold = await holdImageSpend(
    ctx.organizationId,
    resolveInitiatedBy(ctx),
    await meteredOptions(options),
    count,
    ctx.traceId
  );

  // Generate variations by modifying seed
  const baseSeed = options.seed || Math.floor(Math.random() * 1000000);

  try {
    for (let i = 0; i < count; i++) {
      const variationOptions = {
        ...options,
        seed: baseSeed + i * 1000,
      };

      // Each variant is a distinct paid call, so its context carries its own
      // variant number — otherwise the attempt upsert would collapse them
      // into one row.
      const result = await generateImageUnmetered(variationOptions, ctx, {
        holdId: hold.holdId,
        organizationId: ctx.organizationId,
        perImageUsd: hold.perImageUsd,
        dimensions: hold.dimensions,
        variant: i,
        attemptedKeys: hold.attemptedKeys,
        attemptSeq: hold.attemptSeq,
      });
      results.push({ ...result, estimatedCostUsd: hold.perImageUsd });

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } finally {
    // Per-variant outcomes: a mixed batch must not be priced as if every
    // successful variant ran the first one's model (review finding 5).
    await stampActuals(results, hold, ctx);
  }

  return results;
}

export const MAX_SEED = 2_147_480_000; // Int column headroom for +2000 batch offset

export function clampSeed(seed: number): number {
  return Math.min(Math.max(Math.floor(seed), 0), MAX_SEED);
}

/**
 * Parallel N-variant fan-out (trial slice, spec 2026-07-12). Unlike
 * generateVariations (sequential, 500ms delays, legacy consumers), this runs
 * the calls concurrently and never throws on a single-variant failure — a
 * batch succeeds if any variant does. Delegates to the unmetered generator per
 * variant, inheriting the grounded-by-default contract (Part A item 9).
 *
 * SPEND (SYN-1115): `count` is clamped in the SERVICE — holdImageSpend throws
 * RangeError above MAX_IMAGE_VARIANTS — and the whole batch is held as one sum
 * BEFORE the fan-out. Holding per-variant would let the first variants of an
 * oversized batch reach the provider before the quota tripped; holding the sum
 * up front means an over-budget batch costs exactly zero provider calls.
 */
export async function generateBatch(
  options: ImageGenerationOptions,
  ctx: GenerationContext,
  count: number = 3,
  _generate: (
    o: ImageGenerationOptions,
    c: GenerationContext,
    s?: SpendContext | null
  ) => Promise<ImageGenerationResult> = generateImageUnmetered
): Promise<ImageGenerationResult[]> {
  requireGenerationContext(ctx, 'generateBatch');

  const hold = await holdImageSpend(
    ctx.organizationId,
    resolveInitiatedBy(ctx),
    await meteredOptions(options),
    count,
    ctx.traceId
  );

  const baseSeed = clampSeed(
    options.seed ?? Math.floor(Math.random() * 1_000_000)
  );
  // Batch variants run CONCURRENTLY, which is precisely why the spend context
  // cannot be shared: each variant gets its own, carrying its own variant
  // number, so their attempt keys stay distinct and no variant can observe
  // another's hold.
  const settled = await Promise.allSettled(
    Array.from({ length: count }, (_, i) =>
      _generate({ ...options, seed: baseSeed + i * 1000 }, ctx, {
        holdId: hold.holdId,
        organizationId: ctx.organizationId,
        perImageUsd: hold.perImageUsd,
        dimensions: hold.dimensions,
        variant: i,
        attemptedKeys: hold.attemptedKeys,
        attemptSeq: hold.attemptSeq,
      })
    )
  );
  const results: ImageGenerationResult[] = settled.map(s =>
    s.status === 'fulfilled'
      ? { ...s.value, estimatedCostUsd: hold.perImageUsd }
      : {
          success: false,
          provider: (options.provider ?? 'stability') as ImageProvider,
          error:
            s.reason instanceof Error ? s.reason.message : String(s.reason),
          estimatedCostUsd: hold.perImageUsd,
        }
  );

  await stampActuals(results, hold, ctx);

  return results;
}

/**
 * Enhance prompt for better results
 */
export function enhancePrompt(
  prompt: string,
  style?: string,
  brandColors?: string[]
): string {
  let enhanced = prompt;

  // Add style enhancement
  if (style && STYLE_PROMPTS[style]) {
    enhanced = `${enhanced}. ${STYLE_PROMPTS[style]}`;
  }

  // Add brand colors if provided
  if (brandColors && brandColors.length > 0) {
    const colorText = brandColors.join(', ');
    enhanced = `${enhanced}. Color palette: ${colorText}`;
  }

  // Add quality keywords
  enhanced = `${enhanced}. High quality, detailed, professional`;

  return enhanced;
}

/**
 * Validate image dimensions for platform requirements
 */
export function getOptimalDimensions(platform: string): {
  width: number;
  height: number;
  aspectRatio: string;
} {
  const platformDimensions: Record<
    string,
    { width: number; height: number; aspectRatio: string }
  > = {
    instagram_feed: { width: 1080, height: 1080, aspectRatio: '1:1' },
    instagram_story: { width: 1080, height: 1920, aspectRatio: '9:16' },
    twitter: { width: 1600, height: 900, aspectRatio: '16:9' },
    linkedin: { width: 1200, height: 627, aspectRatio: '16:9' },
    facebook: { width: 1200, height: 630, aspectRatio: '16:9' },
    tiktok: { width: 1080, height: 1920, aspectRatio: '9:16' },
    youtube_thumbnail: { width: 1280, height: 720, aspectRatio: '16:9' },
  };

  return (
    platformDimensions[platform] || {
      width: 1024,
      height: 1024,
      aspectRatio: '1:1',
    }
  );
}

// Export singleton functions
export const imageGenerationService = {
  generate: generateImage,
  generateVariations,
  enhancePrompt,
  getOptimalDimensions,
};
