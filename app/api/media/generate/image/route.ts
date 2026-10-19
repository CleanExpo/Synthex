/**
 * AI Image Generation API
 *
 * @description Generate images using AI (Stability AI, DALL-E, Gemini)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STABILITY_API_KEY: Stability AI API key (SECRET)
 * - OPENAI_API_KEY: OpenAI API key for DALL-E (SECRET)
 * - GEMINI_API_KEY: Google Gemini API key (SECRET)
 *
 * FAILURE MODE: Returns error response with provider details
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit/rate-limiter';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import {
  generateImage,
  generateVariations,
  generateBatch,
  clampSeed,
  enhancePrompt,
  getOptimalDimensions,
  NO_REFERENCES_BLOCK_ERROR,
  ImageGenerationOptions,
  ImageGenerationResult,
} from '@/lib/services/ai/image-generation';
import { listReferenceSets } from '@/lib/services/ai/reference-library';
import {
  SUPPORTED_PLATFORMS,
  systemGenerationContext,
  type GenerationContext,
  type SupportedPlatform,
} from '@/lib/ai/generation-context';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';

// Spec 2026-07-12 Part B: generation ~25-30s + parallel library saves for up
// to 3 variants; route previously had no duration config.
export const maxDuration = 120;

/**
 * Normalise this route's free-form platform param (e.g. 'instagram_feed',
 * 'youtube_thumbnail') to a canonical SupportedPlatform for trend lookups.
 */
function toSupportedPlatform(
  platform: string | undefined
): SupportedPlatform | undefined {
  if (!platform) return undefined;
  const base = platform.split('_')[0];
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(base)
    ? (base as SupportedPlatform)
    : undefined;
}

/**
 * Generation context for a user-initiated media request.
 *
 * SYN-1115: this previously passed `undefined` as the organisation, so EVERY
 * image generation ran under the SYSTEM organisation sentinel while the real
 * org was resolved separately, only for the persisted row. Spend was therefore
 * never attributable to a tenant at the context layer. The caller now resolves
 * the effective organisation up front and passes it in, so the spend meter
 * holds against the tenant that actually asked for the image.
 */
function mediaGenerationContext(
  userId: string,
  organizationId: string
): GenerationContext {
  return systemGenerationContext(organizationId, {
    userId,
    autonomyLevel: 'manual',
  });
}
import { requireEntitlement } from '@/lib/billing/require-entitlement';
import { tableUnavailable } from '@/lib/api/not-provisioned';
import { QuotaExceededError } from '@/lib/services/ai/video/types';
import { UnpricedModelError } from '@/lib/services/ai/image/registry';

// NOT_PROVISIONED: prisma/schema.prisma has no media_assets model, so
// saveToLibrary cannot persist. Responses say so via `library` instead of
// dropping the save silently; generation itself is unaffected.
const MEDIA_LIBRARY_UNAVAILABLE = tableUnavailable('media_assets');

/**
 * Resolve the organisation that will own this generation's spend, or the 403
 * that refuses it.
 *
 * ONE definition, used by both handlers. They carried identical copies, and
 * both called `getEffectiveOrganizationId` ABOVE their `try` — which matters
 * because that function rethrows on a database failure
 * (`lib/multi-business/business-scope.ts`: catch → `throw new Error('Failed to
 * determine organization context')`). Outside the try, that error escaped the
 * route's structured error handling and the caller received a raw framework
 * 500 instead of an `APISecurityChecker.createSecureResponse` body
 * (CodeRabbit review of PR #820).
 *
 * Returns the id on success so a caller can narrow on `typeof === 'string'`;
 * the refusal is returned rather than thrown so it cannot be mistaken for the
 * database failure this exists to distinguish from.
 */
async function resolveOwningOrganization(
  userId: string
): Promise<string | NextResponse> {
  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return APISecurityChecker.createSecureResponse(
      {
        success: false,
        error:
          'No organisation resolved for this account — image generation is blocked because the spend could not be attributed.',
      },
      403
    );
  }
  return organizationId;
}

/**
 * The spend meter's fail-closed refusals, mapped to honest statuses, or null
 * for any other error. holdImageSpend throws all three before a provider call,
 * and they propagate out of generateImage / generateBatch / generateVariations:
 * - QuotaExceededError: the org's shared media budget cap → 429 naming the cap
 * - UnpricedModelError: a deprecated/unpriced model pin → 422
 *   (registry.ts documents 422 for it)
 * - RangeError "image variants must be…" from the meter → 422
 * Its message says "Video budget" (the class is shared), so the image message
 * is composed here from its fields.
 */
function meterRefusalResponse(error: unknown): NextResponse | null {
  if (error instanceof QuotaExceededError) {
    return APISecurityChecker.createSecureResponse(
      {
        success: false,
        error: `Media budget cap exceeded (${error.cap}): $${error.spentUsd.toFixed(2)} spent of $${error.limitUsd.toFixed(2)} limit. No image was generated.`,
        cap: error.cap,
      },
      429
    );
  }
  if (error instanceof UnpricedModelError) {
    return APISecurityChecker.createSecureResponse(
      { success: false, error: error.message, blocked: true },
      422
    );
  }
  if (error instanceof RangeError && /variants must be/.test(error.message)) {
    return APISecurityChecker.createSecureResponse(
      { success: false, error: error.message },
      422
    );
  }
  return null;
}

// Request validation schema
const ImageGenerationSchema = z.object({
  prompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(2000).optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional(),
  width: z.number().min(256).max(2048).optional(),
  height: z.number().min(256).max(2048).optional(),
  style: z
    .enum([
      'photorealistic',
      'artistic',
      'anime',
      'digital-art',
      'cinematic',
      'minimalist',
    ])
    .optional(),
  quality: z.enum(['standard', 'hd']).optional(),
  provider: z.enum(['stability', 'dalle', 'gemini']).optional(),
  seed: z.number().int().min(0).max(2_147_480_000).optional(),
  steps: z.number().min(10).max(50).optional(),
  guidanceScale: z.number().min(1).max(20).optional(),
  platform: z.string().optional(), // For optimal dimensions
  brandColors: z.array(z.string()).optional(),
  enhancePrompt: z.boolean().default(false),
  saveToLibrary: z.boolean().default(true),
  // Reference grounding (owner-session, SYN "Option B"). Mirrors the MCP
  // generate_image tool's opt-in fields exactly: both .optional() (no default)
  // so the un-grounded path stays byte-for-byte unchanged. generateImage owns
  // the site-relative → absolute URL resolution (via NEXT_PUBLIC_APP_URL) and
  // the opt-in gate; this route only threads the fields through, identical to
  // lib/services/ai/studio-tools/index.ts generate_image.
  referenceSet: z.string().min(1).optional(),
  useReferences: z.boolean().optional(),
  // Trained-LoRA id passthrough (Real Images Only spec 2026-07-12 Part B) —
  // explicit id always wins over the grounded path's auto-applied industry
  // LoRA; mirrors the MCP generate_image tool's loraId field exactly.
  loraId: z.string().min(1).optional(),
  // Batch generation (spec 2026-07-12 Part B). Absent/1 => single-image path,
  // byte-identical to today's response shape.
  variants: z.number().int().min(1).max(3).optional(),
});

const VariationsSchema = z.object({
  prompt: z.string().min(1).max(4000),
  count: z.number().min(1).max(8).default(4),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional(),
  style: z
    .enum([
      'photorealistic',
      'artistic',
      'anime',
      'digital-art',
      'cinematic',
      'minimalist',
    ])
    .optional(),
  provider: z.enum(['stability', 'dalle', 'gemini']).optional(),
  saveToLibrary: z.boolean().default(true),
  // Reference grounding + LoRA passthrough (Real Images Only spec 2026-07-12
  // Part B) — mirrors ImageGenerationSchema's fields; generateVariations
  // delegates to generateImage per variant so it inherits grounded-by-default
  // (block on no coverage, auto-LoRA, escape-hatch stamping) automatically.
  referenceSet: z.string().min(1).optional(),
  useReferences: z.boolean().optional(),
  loraId: z.string().min(1).optional(),
});

/**
 * POST /api/media/generate/image
 * Generate an AI image
 */
async function _handlePost(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;

  // Subscription gate — AI Images requires Professional plan or higher.
  // Central entitlement resolves from plan AND status (fails closed for
  // unpaid/past-due), matching the PUT handler below.
  const entitlement = await requireEntitlement(userId, 'ai_image');
  if (!entitlement.allowed) {
    return APISecurityChecker.createSecureResponse(
      {
        success: false,
        error:
          'AI Image generation requires a Professional subscription or higher',
        upgradeRequired: true,
        requiredPlan: 'professional',
      },
      402
    );
  }

  try {
    // Resolve the owning organisation ONCE, before any generation (SYN-1115).
    // Image spend must always attribute to a tenant: the quota hold, the ledger
    // row and the image_generations row all key on this. No org ⇒ refuse rather
    // than spend against the system sentinel.
    const resolved = await resolveOwningOrganization(userId);
    if (typeof resolved !== 'string') return resolved;
    const organizationId = resolved;

    const body = await request.json();
    const validated = ImageGenerationSchema.parse(body);

    // Get optimal dimensions if platform specified
    let dimensions = {
      width: validated.width,
      height: validated.height,
      aspectRatio: validated.aspectRatio,
    };

    if (validated.platform && !validated.width && !validated.height) {
      const optimal = getOptimalDimensions(validated.platform);
      dimensions = {
        width: optimal.width,
        height: optimal.height,
        aspectRatio: optimal.aspectRatio as
          | '1:1'
          | '16:9'
          | '9:16'
          | '4:3'
          | '3:4'
          | undefined,
      };
    }

    // Enhance prompt if requested
    let finalPrompt = validated.prompt;
    if (validated.enhancePrompt) {
      finalPrompt = enhancePrompt(
        validated.prompt,
        validated.style,
        validated.brandColors
      );
    }

    // Generate the image
    const options: ImageGenerationOptions = {
      prompt: finalPrompt,
      negativePrompt: validated.negativePrompt,
      aspectRatio: dimensions.aspectRatio,
      width: dimensions.width,
      height: dimensions.height,
      style: validated.style,
      quality: validated.quality,
      provider: validated.provider,
      // SYN-MCP-003: target platform (not provider) drives trend enrichment.
      platform: toSupportedPlatform(validated.platform),
      seed: validated.seed,
      steps: validated.steps,
      guidanceScale: validated.guidanceScale,
      // Reference grounding (SYN "Option B") — mirror the MCP generate_image
      // tool: thread referenceSet/useReferences straight into options and let
      // generateImage resolve owned reference paths to absolute URLs
      // (NEXT_PUBLIC_APP_URL) and route to the reference-capable model. Opt-in
      // and default-off: with neither field set these are undefined and the
      // call is unchanged.
      referenceSet: validated.referenceSet,
      useReferences: validated.useReferences,
      // Trained-LoRA passthrough (Real Images Only Part B) — explicit id wins
      // over the grounded path's auto-applied industry LoRA.
      loraId: validated.loraId,
    };

    // Batch generation (spec 2026-07-12 Part B) — parallel N-variant fan-out
    // with persisted lineage. Absent/1 falls through to the single-image path
    // below, unchanged.
    if ((validated.variants ?? 1) > 1) {
      const results = await generateBatch(
        options,
        mediaGenerationContext(userId, organizationId),
        validated.variants
      );
      const batchGroupId = crypto.randomUUID();

      // (1) lineage FIRST — survives any later save/timeout trouble.
      const rows = await prisma.$transaction(
        results.map((r, i) =>
          prisma.imageGeneration.create({
            data: {
              organizationId,
              userId,
              batchGroupId,
              // Blocked variants (Real Images Only — no owned coverage, or
              // grounded generation failed closed) get their own status so
              // the UI can render the add-photos guidance distinctly from a
              // plain provider failure. kept/rank stay null either way — no
              // generation to rank.
              status: r.blocked
                ? 'blocked'
                : r.success
                  ? 'completed'
                  : 'failed',
              provider: r.provider ?? 'unknown',
              model: r.metadata?.model,
              // SYN-1115 (review finding 6): the PRODUCT path persists what
              // was held and what was settled. Without these two lines the
              // migration and the meter were real but every row the product
              // wrote left both columns null — spend was auditable only from
              // the ledger, never from the generation itself.
              estimatedCostUsd: r.estimatedCostUsd,
              actualCostUsd: r.actualCostUsd,
              seed:
                r.metadata?.seed ??
                (typeof options.seed === 'number'
                  ? clampSeed(options.seed) + i * 1000
                  : null),
              inputPrompt: validated.prompt,
              enhancedPrompt:
                options.prompt !== validated.prompt ? options.prompt : null,
              style: validated.style ?? null,
              aspectRatio: validated.aspectRatio ?? null,
              imageUrl: r.imageUrl ?? null,
              grounded: r.grounded ?? false,
              referenceSet: r.referenceSet ?? null,
              refCount: r.refCount ?? null,
              // Stamp from each result (T1's auto-LoRA populates them) rather
              // than hardcoding — a grounded variant may have auto-applied
              // the industry's trained LoRA even though the caller passed none.
              loraId: r.loraId ?? null,
              loraApplied: r.loraApplied ?? false,
              metadata: r.success
                ? r.metadata
                  ? (r.metadata as object)
                  : undefined
                : { error: r.error },
            },
          })
        )
      );

      // Audit log — one entry for the whole batch.
      await auditLogger.logData(
        'create',
        'image',
        batchGroupId,
        userId,
        'success',
        {
          action: 'MEDIA_GENERATE_BATCH',
          provider: validated.provider,
          style: validated.style,
          platform: validated.platform,
          variants: validated.variants,
          successCount: results.filter(r => r.success).length,
        }
      );

      // (3) respond — NO imageBase64 (Vercel 4.5MB limit, spec Part B).
      const anySuccess = results.some(r => r.success);
      if (!anySuccess) {
        // ALL variants blocked (Real Images Only, no owned coverage or
        // fail-closed grounding failure) => 422 so the UI renders the
        // add-photos guidance rather than a generic 500.
        const allBlocked = results.every(r => r.blocked === true);
        if (allBlocked) {
          return APISecurityChecker.createSecureResponse(
            {
              error: results[0]?.error ?? NO_REFERENCES_BLOCK_ERROR,
              blocked: true,
            },
            422
          );
        }
        return APISecurityChecker.createSecureResponse(
          {
            error: results[0]?.error ?? 'Image generation failed',
            provider: results[0]?.provider,
          },
          500
        );
      }
      return APISecurityChecker.createSecureResponse({
        success: true,
        batchGroupId,
        images: results.map((r, i) => ({
          generationId: rows[i].id,
          success: r.success,
          provider: r.provider,
          imageUrl: r.imageUrl,
          metadata: r.metadata,
          grounded: r.grounded,
          referenceSet: r.referenceSet,
          refCount: r.refCount,
          // Mixed batch (spec Part B): blocked variants are surfaced per-item
          // rather than dropped, so the UI can render add-photos guidance
          // next to the successful variants.
          blocked: r.blocked,
          error: r.error,
        })),
        ...(validated.saveToLibrary && { library: MEDIA_LIBRARY_UNAVAILABLE }),
      });
    }

    const result = await generateImage(
      options,
      mediaGenerationContext(userId, organizationId)
    );

    if (!result.success) {
      // Blocked (Real Images Only — no owned coverage, or fail-closed
      // grounding failure) is a client-actionable 422, not a server error.
      if (result.blocked) {
        logger.warn('Image generation blocked', {
          error: result.error,
          userId,
        });
        return APISecurityChecker.createSecureResponse(
          {
            error: result.error || NO_REFERENCES_BLOCK_ERROR,
            blocked: true,
          },
          422
        );
      }
      // Provider pin while grounded is a caller mistake, not a server fault.
      if (result.error?.includes('requires the ungrounded escape hatch')) {
        return APISecurityChecker.createSecureResponse(
          { error: result.error },
          400
        );
      }
      logger.error('Image generation failed', { error: result.error, userId });
      return APISecurityChecker.createSecureResponse(
        {
          error: result.error || 'Image generation failed',
          provider: result.provider,
        },
        500
      );
    }

    // Audit log
    await auditLogger.logData('create', 'image', undefined, userId, 'success', {
      action: 'MEDIA_GENERATE',
      provider: result.provider,
      style: validated.style,
      platform: validated.platform,
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      provider: result.provider,
      imageBase64: result.imageBase64,
      imageUrl: result.imageUrl,
      metadata: result.metadata,
      ...(validated.saveToLibrary && { library: MEDIA_LIBRARY_UNAVAILABLE }),
      // Grounding status so the client can confirm generation ran on real
      // reference photos vs silently fell back to the text-only path.
      grounded: result.grounded,
      referenceSet: result.referenceSet,
      refCount: result.refCount,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.issues },
        400
      );
    }

    const refusal = meterRefusalResponse(error);
    if (refusal) return refusal;

    logger.error('Image generation error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * PUT /api/media/generate/image
 * Generate multiple image variations
 */
export async function PUT(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;

  // Subscription gate — AI Image variations require Professional plan or higher.
  // Central entitlement resolves from plan AND status (fails closed for
  // unpaid/past-due), matching the POST handler above.
  const entitlement = await requireEntitlement(userId, 'ai_image');
  if (!entitlement.allowed) {
    return APISecurityChecker.createSecureResponse(
      {
        success: false,
        error:
          'AI Image generation requires a Professional subscription or higher',
        upgradeRequired: true,
        requiredPlan: 'professional',
      },
      402
    );
  }

  try {
    // Same attribution gate as the POST handler (SYN-1115) — variations spend
    // real money per variant, so an unattributable request is refused, not
    // charged to the system sentinel.
    const resolved = await resolveOwningOrganization(userId);
    if (typeof resolved !== 'string') return resolved;
    const organizationId = resolved;

    const body = await request.json();
    const validated = VariationsSchema.parse(body);

    const options: ImageGenerationOptions = {
      prompt: validated.prompt,
      aspectRatio: validated.aspectRatio,
      style: validated.style,
      provider: validated.provider,
      // Reference grounding + LoRA passthrough (Real Images Only Part B) —
      // generateVariations delegates to generateImage per variant, so this
      // inherits grounded-by-default (block on no coverage, auto-LoRA,
      // escape-hatch stamping) automatically.
      referenceSet: validated.referenceSet,
      useReferences: validated.useReferences,
      loraId: validated.loraId,
    };

    const results = await generateVariations(
      options,
      mediaGenerationContext(userId, organizationId),
      validated.count
    );

    // Audit log
    await auditLogger.logData('create', 'image', undefined, userId, 'success', {
      action: 'MEDIA_GENERATE_VARIATIONS',
      count: validated.count,
      successCount: results.filter(r => r.success).length,
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      variations: results.map((r, i) => ({
        index: i,
        success: r.success,
        provider: r.provider,
        imageBase64: r.imageBase64,
        imageUrl: r.imageUrl,
        metadata: r.metadata,
        error: r.error,
        // Blocked variants (Real Images Only — no owned coverage, or
        // fail-closed grounding failure) mirror the batch route's per-item
        // flag rather than a bare failure.
        blocked: r.blocked,
        // SYN-1115: per-variant spend is part of the response contract, so a
        // caller can reconcile without querying the ledger.
        estimatedCostUsd: r.estimatedCostUsd,
        actualCostUsd: r.actualCostUsd,
      })),
      totalSuccess: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
      ...(validated.saveToLibrary && { library: MEDIA_LIBRARY_UNAVAILABLE }),
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.issues },
        400
      );
    }

    const refusal = meterRefusalResponse(error);
    if (refusal) return refusal;

    logger.error('Image variations error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * GET /api/media/generate/image
 * Get optimal dimensions for a platform
 */
export async function GET(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');

  if (platform) {
    const dimensions = getOptimalDimensions(platform);
    return APISecurityChecker.createSecureResponse({
      platform,
      ...dimensions,
    });
  }

  // Return all platform dimensions
  const platforms = [
    'instagram_feed',
    'instagram_story',
    'twitter',
    'linkedin',
    'facebook',
    'tiktok',
    'youtube_thumbnail',
  ];

  const allDimensions = platforms.reduce(
    (acc: any, p: any) => {
      acc[p] = getOptimalDimensions(p);
      return acc;
    },
    {} as Record<string, unknown>
  );

  // Groundable reference sets: only those with owned images (empty sets would
  // silently fall through to text-only, so we never offer them in the picker).
  const referenceSets = listReferenceSets()
    .filter(s => s.subjects.some(x => x.rights === 'owned' && x.count > 0))
    .map(s => ({ industry: s.industry, label: s.label }));

  return APISecurityChecker.createSecureResponse({
    platforms: allDimensions,
    styles: [
      'photorealistic',
      'artistic',
      'anime',
      'digital-art',
      'cinematic',
      'minimalist',
    ],
    providers: ['stability', 'dalle', 'gemini'],
    referenceSets,
  });
}

// RA-3024 — rate-limited wrapper around the existing handler.
export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => _handlePost(request));
}
