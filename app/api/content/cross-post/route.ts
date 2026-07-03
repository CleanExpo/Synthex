/**
 * Cross-Post API
 *
 * @description POST /api/content/cross-post
 * Adapts content for multiple platforms and optionally posts to them.
 *
 * Two request shapes are supported:
 *
 * 1. Per-platform (used by the Cross-Post dashboard page). One request per
 *    target platform; returns a single adapted string the page renders into a
 *    card:
 *      { content, platform, options: { adjustLength, addHashtags, adjustTone } }
 *      -> { success: true, platform, content }
 *
 * 2. Legacy batch (programmatic / API-key callers). Adapts one source into
 *    several platform variants — and, in publish mode, posts them — in a single
 *    call:
 *      { content, platforms: [...], mode: 'preview'|'publish', ... }
 *      -> { success: true, mode, source, variants, [results, summary] }
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 * - FIELD_ENCRYPTION_KEY: For decrypting platform tokens (CRITICAL)
 * - AI_PROVIDER: AI provider selection (optional, defaults to "openrouter")
 *
 * FAILURE MODE: Returns structured error responses on validation or server failure.
 * Handles partial success gracefully (some platforms succeed, others fail).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/withAuth';
import { withRateLimit } from '@/lib/rate-limit/rate-limiter';
import { requireApiKey } from '@/lib/middleware/require-api-key';
import { z } from 'zod';
import { crossPostService } from '@/lib/ai/cross-post-service';
import { SUPPORTED_PLATFORMS, SupportedPlatform } from '@/lib/social';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Per-platform shape — what the Cross-Post dashboard page actually sends (one
 * request per selected platform). The page steers the adaptation with three
 * boolean toggles rather than a tone/goal enum.
 */
const PerPlatformRequestSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(50000, 'Content must be 50,000 characters or fewer'),
  platform: z.enum(SUPPORTED_PLATFORMS),
  options: z
    .object({
      adjustLength: z.boolean().optional(),
      addHashtags: z.boolean().optional(),
      adjustTone: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Legacy batch shape — one source adapted into several platform variants in a
 * single call (preview), or adapted and posted (publish). Kept unchanged for
 * programmatic / API-key consumers.
 */
const BatchRequestSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(50000, 'Content must be 50,000 characters or fewer'),
  platforms: z
    .array(z.enum(SUPPORTED_PLATFORMS))
    .min(1, 'At least one platform is required')
    .max(9, 'Maximum 9 platforms'),
  tone: z
    .enum(['professional', 'casual', 'playful', 'authoritative', 'friendly'])
    .optional(),
  goal: z
    .enum(['engagement', 'reach', 'conversions', 'brand_awareness', 'traffic'])
    .optional(),
  personaId: z.string().optional(),
  scheduledAt: z
    .string()
    .datetime()
    .optional()
    .transform(val => (val ? new Date(val) : undefined)),
  mediaUrls: z.array(z.string().url()).optional(),
  campaignId: z.string().optional(),
  mode: z.enum(['preview', 'publish']).default('publish'),
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map the page's adaptation toggles onto a `tone` hint the cross-post service
 * understands. `adjustTone` opts the source into a casual, conversational
 * rewrite; otherwise the platform's default tone is used (no override). The
 * `adjustLength` / `addHashtags` toggles are already honoured implicitly by the
 * adapter's per-platform character limits and hashtag conventions.
 */
function toneForOptions(options?: {
  adjustTone?: boolean;
}): string | undefined {
  return options?.adjustTone ? 'casual' : undefined;
}

// ============================================================================
// HANDLER
// ============================================================================

/**
 * POST /api/content/cross-post
 *
 * Cross-post content to multiple platforms with AI-powered adaptation.
 *
 * @example Per-platform request (dashboard page):
 * {
 *   "content": "Your content here",
 *   "platform": "linkedin",
 *   "options": { "adjustLength": true, "addHashtags": true, "adjustTone": false }
 * }
 *
 * @example Batch request (preview mode):
 * {
 *   "content": "Your content here",
 *   "platforms": ["twitter", "linkedin", "instagram"],
 *   "tone": "professional",
 *   "goal": "engagement",
 *   "mode": "preview"
 * }
 *
 * @example Batch request (publish mode):
 * {
 *   "content": "Your content here",
 *   "platforms": ["twitter", "linkedin"],
 *   "tone": "professional",
 *   "mode": "publish"
 * }
 */
async function handlePost(
  request: AuthenticatedRequest
): Promise<NextResponse> {
  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const userId = request.userId;

  // Distinguish the two contracts by which field is present. The dashboard page
  // sends a singular `platform`; programmatic callers send a `platforms` array.
  const isBatch =
    typeof body === 'object' &&
    body !== null &&
    'platforms' in (body as Record<string, unknown>);

  // --- Legacy batch path (programmatic / API-key callers) ----------------
  if (isBatch) {
    const parsed = BatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      content,
      platforms,
      tone,
      goal,
      personaId,
      scheduledAt,
      mediaUrls,
      campaignId,
      mode,
    } = parsed.data;

    try {
      // Preview mode: Just adapt content, don't post
      if (mode === 'preview') {
        const adaptedContent = await crossPostService.previewCrossPost({
          sourceContent: content,
          platforms: platforms as SupportedPlatform[],
          userId,
          tone,
          goal,
          personaId,
          mediaUrls,
        });

        return NextResponse.json({
          success: true,
          mode: 'preview',
          source: adaptedContent.source,
          variants: adaptedContent.variants,
        });
      }

      // Publish mode: Adapt and post to platforms
      const result = await crossPostService.crossPost({
        sourceContent: content,
        platforms: platforms as SupportedPlatform[],
        userId,
        tone,
        goal,
        personaId,
        scheduledAt,
        mediaUrls,
        campaignId,
      });

      return NextResponse.json({
        success: true,
        mode: 'publish',
        source: result.adaptedContent.source,
        variants: result.adaptedContent.variants,
        results: result.results,
        summary: {
          publishedCount: result.publishedCount,
          scheduledCount: result.scheduledCount,
          failedCount: result.failedCount,
          totalCount: result.results.length,
        },
      });
    } catch (error) {
      logger.error('[content/cross-post] Operation failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to process cross-post request',
          message: 'An unexpected error occurred. Please try again.',
        },
        { status: 500 }
      );
    }
  }

  // --- Per-platform path (dashboard page) --------------------------------
  const parsed = PerPlatformRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { content, platform, options } = parsed.data;

  try {
    // Preview-only adaptation for the single requested platform. This never
    // touches the publish/posting pipeline — the page schedules separately via
    // /api/scheduler/posts.
    const adapted = await crossPostService.previewCrossPost({
      sourceContent: content,
      platforms: [platform] as SupportedPlatform[],
      userId,
      tone: toneForOptions(options),
    });

    const variant = adapted.variants[0];
    const adaptedText = variant?.content ?? '';

    if (!adaptedText) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to adapt content',
          message: 'No adapted content was produced for this platform.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      platform,
      content: adaptedText,
    });
  } catch (error) {
    logger.error('[content/cross-post] Adaptation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process cross-post request',
        message: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}

const authenticatedHandler = withAuth(handlePost);

// RA-3024 — rate-limited wrapper around the existing handler chain.
export async function POST(request: NextRequest) {
  return withRateLimit(request, async () =>
    requireApiKey(request, async () =>
      authenticatedHandler(request, { params: Promise.resolve({}) })
    )
  );
}

// Edge runtime is not compatible with AI providers or Prisma — use Node.js
export const runtime = 'nodejs';
