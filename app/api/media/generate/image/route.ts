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
  enhancePrompt,
  getOptimalDimensions,
  ImageGenerationOptions,
} from '@/lib/services/ai/image-generation';
import { listReferenceSets } from '@/lib/services/ai/reference-library';
import {
  SUPPORTED_PLATFORMS,
  systemGenerationContext,
  type GenerationContext,
  type SupportedPlatform,
} from '@/lib/ai/generation-context';
import { logger } from '@/lib/logger';

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
 * SYN-MCP-003: this route authenticates a user but has no organisation
 * resolution (Supabase-native path) — the system sentinel keeps the ledger
 * honest (clientId = null) while still attributing the acting user.
 */
function mediaGenerationContext(userId: string): GenerationContext {
  return systemGenerationContext(undefined, {
    userId,
    autonomyLevel: 'manual',
  });
}
import { createClient } from '@supabase/supabase-js';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { hasProfessionalAccess } from '@/lib/billing/plan-access';

let _supabase: any = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
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
  seed: z.number().optional(),
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

  // Subscription gate — AI Images requires Professional plan or higher
  const subscription =
    await subscriptionService.getOrCreateSubscription(userId);
  if (!hasProfessionalAccess(subscription.plan)) {
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
    };

    const result = await generateImage(options, mediaGenerationContext(userId));

    if (!result.success) {
      logger.error('Image generation failed', { error: result.error, userId });
      return APISecurityChecker.createSecureResponse(
        {
          error: result.error || 'Image generation failed',
          provider: result.provider,
        },
        500
      );
    }

    // Save to media library if requested
    let mediaAssetId: string | undefined;
    if (validated.saveToLibrary && result.imageBase64) {
      const { data: asset, error: saveError } = await getSupabase()
        .from('media_assets')
        .insert({
          user_id: userId,
          type: 'image',
          provider: result.provider,
          prompt: validated.prompt,
          metadata: {
            ...result.metadata,
            style: validated.style,
            platform: validated.platform,
            originalPrompt: validated.prompt,
            enhancedPrompt: validated.enhancePrompt ? finalPrompt : undefined,
          },
          base64_data: result.imageBase64,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (!saveError && asset) {
        mediaAssetId = asset.id;
      }
    }

    // Audit log
    await auditLogger.logData(
      'create',
      'image',
      mediaAssetId,
      userId,
      'success',
      {
        action: 'MEDIA_GENERATE',
        provider: result.provider,
        style: validated.style,
        platform: validated.platform,
      }
    );

    return APISecurityChecker.createSecureResponse({
      success: true,
      provider: result.provider,
      imageBase64: result.imageBase64,
      imageUrl: result.imageUrl,
      metadata: result.metadata,
      mediaAssetId,
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

  try {
    const body = await request.json();
    const validated = VariationsSchema.parse(body);

    const options: ImageGenerationOptions = {
      prompt: validated.prompt,
      aspectRatio: validated.aspectRatio,
      style: validated.style,
      provider: validated.provider,
    };

    const results = await generateVariations(
      options,
      mediaGenerationContext(userId),
      validated.count
    );

    // Save successful results to library
    const savedAssets: string[] = [];
    if (validated.saveToLibrary) {
      for (const result of results) {
        if (result.success && result.imageBase64) {
          const { data: asset } = await getSupabase()
            .from('media_assets')
            .insert({
              user_id: userId,
              type: 'image',
              provider: result.provider,
              prompt: validated.prompt,
              metadata: result.metadata,
              base64_data: result.imageBase64,
              created_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (asset) {
            savedAssets.push(asset.id);
          }
        }
      }
    }

    // Audit log
    await auditLogger.logData('create', 'image', undefined, userId, 'success', {
      action: 'MEDIA_GENERATE_VARIATIONS',
      count: validated.count,
      successCount: results.filter(r => r.success).length,
      savedAssets,
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
        mediaAssetId: savedAssets[i],
      })),
      totalSuccess: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.issues },
        400
      );
    }

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
