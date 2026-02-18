/**
 * Cross-Post API
 *
 * @description POST /api/content/cross-post
 * Adapts content for multiple platforms and optionally posts to them.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 * - FIELD_ENCRYPTION_KEY: For decrypting platform tokens (CRITICAL)
 * - AI_PROVIDER: AI provider selection (optional, defaults to "openrouter")
 *
 * FAILURE MODE: Returns structured error responses on validation or server failure.
 * Handles partial success gracefully (some platforms succeed, others fail).
 */

import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/withAuth';
import { z } from 'zod';
import { crossPostService } from '@/lib/ai/cross-post-service';
import { SUPPORTED_PLATFORMS, SupportedPlatform } from '@/lib/social';

// ============================================================================
// VALIDATION
// ============================================================================

const CrossPostRequestSchema = z.object({
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
  personaId: z
    .string()
    .optional(),
  scheduledAt: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  mediaUrls: z
    .array(z.string().url())
    .optional(),
  campaignId: z
    .string()
    .optional(),
  mode: z
    .enum(['preview', 'publish'])
    .default('publish'),
});

// ============================================================================
// HANDLER
// ============================================================================

/**
 * POST /api/content/cross-post
 *
 * Cross-post content to multiple platforms with AI-powered adaptation.
 *
 * @example Request body (preview mode):
 * {
 *   "content": "Your content here",
 *   "platforms": ["twitter", "linkedin", "instagram"],
 *   "tone": "professional",
 *   "goal": "engagement",
 *   "mode": "preview"
 * }
 *
 * @example Request body (publish mode):
 * {
 *   "content": "Your content here",
 *   "platforms": ["twitter", "linkedin"],
 *   "tone": "professional",
 *   "mode": "publish"
 * }
 */
async function handlePost(request: AuthenticatedRequest): Promise<NextResponse> {
  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const parseResult = CrossPostRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation error',
        details: parseResult.error.flatten().fieldErrors,
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
  } = parseResult.data;

  const userId = request.userId;

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
    console.error('[content/cross-post] Operation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process cross-post request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handlePost);

// Edge runtime is not compatible with AI providers or Prisma — use Node.js
export const runtime = 'nodejs';
