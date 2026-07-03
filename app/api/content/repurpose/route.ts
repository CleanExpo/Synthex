/**
 * Content Repurposing API
 *
 * @description POST /api/content/repurpose
 * Repurposes existing content into platform-optimised posts.
 *
 * Two request shapes are supported:
 *
 * 1. Per-platform (used by the Content Repurposer dashboard page). One request
 *    per target platform; returns a single adapted string:
 *      { sourceContent, sourceType: 'text'|'url', platform, outputFormat }
 *      -> { success: true, platform, content }
 *
 * 2. Legacy batch (programmatic / API-key callers). Generates several
 *    derivative formats from one long-form source in a single call:
 *      { sourceContent, sourceType: 'blog'|..., outputFormats: [...] }
 *      -> { success: true, source, results }
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 * - OPENAI_API_KEY: OpenAI key for AI repurposing (SECRET)
 * - AI_PROVIDER: AI provider selection (optional, defaults to "openai")
 *
 * FAILURE MODE: Returns structured error responses on validation or server failure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/withAuth';
import { withRateLimit } from '@/lib/rate-limit/rate-limiter';
import { requireApiKey } from '@/lib/middleware/require-api-key';
import { z } from 'zod';
import { contentRepurposer } from '@/lib/ai/content-repurposer';
import { multiFormatAdapter } from '@/lib/ai/multi-format-adapter';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION
// ============================================================================

const SUPPORTED_PLATFORMS = [
  'twitter',
  'linkedin',
  'instagram',
  'tiktok',
  'facebook',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
] as const;

/**
 * Per-platform shape — what the Content Repurposer dashboard page actually
 * sends (one request per selected platform).
 */
const PerPlatformRequestSchema = z.object({
  sourceContent: z
    .string()
    .min(1, 'Content is required')
    .max(50000, 'Content must be 50,000 characters or fewer'),
  sourceType: z.enum(['text', 'url']).default('text'),
  platform: z.enum(SUPPORTED_PLATFORMS),
  outputFormat: z
    .enum(['social_post', 'thread', 'caption', 'summary'])
    .default('social_post'),
});

/**
 * Legacy batch shape — long-form source fanned out into several derivative
 * formats in a single call. Kept for programmatic / API-key consumers.
 */
const BatchRequestSchema = z.object({
  sourceContent: z
    .string()
    .min(100, 'Content must be at least 100 characters')
    .max(50000, 'Content must be 50,000 characters or fewer'),
  sourceType: z.enum([
    'blog',
    'article',
    'video_transcript',
    'podcast',
    'newsletter',
  ]),
  outputFormats: z
    .array(
      z.enum([
        'thread',
        'video_script',
        'carousel_outline',
        'key_takeaways',
        'summary',
        'quote_graphics',
      ])
    )
    .min(1, 'At least one output format is required')
    .max(6, 'Maximum 6 output formats'),
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map the page's `outputFormat` selection onto a goal hint the
 * MultiFormatAdapter understands. The adapter has no explicit format input, so
 * we steer it via the existing `goal` parameter; `thread` is handled natively
 * by the adapter for Twitter and as standard adaptation elsewhere.
 */
function goalForOutputFormat(
  outputFormat: 'social_post' | 'thread' | 'caption' | 'summary'
): string {
  switch (outputFormat) {
    case 'summary':
      return 'reach';
    case 'caption':
      return 'engagement';
    case 'thread':
      return 'engagement';
    case 'social_post':
    default:
      return 'engagement';
  }
}

// ============================================================================
// HANDLER
// ============================================================================

async function handlePost(
  request: AuthenticatedRequest
): Promise<NextResponse> {
  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Distinguish the two contracts by which field is present. The dashboard page
  // sends a singular `platform`; programmatic callers send an `outputFormats`
  // array.
  const isBatch =
    typeof body === 'object' &&
    body !== null &&
    'outputFormats' in (body as Record<string, unknown>);

  // --- Legacy batch path -------------------------------------------------
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

    const { sourceContent, sourceType, outputFormats } = parsed.data;

    try {
      const result = await contentRepurposer.repurpose({
        sourceContent,
        sourceType,
        outputFormats,
      });

      return NextResponse.json({
        success: true,
        source: result.source,
        results: result.results,
      });
    } catch (error) {
      logger.error('[content/repurpose] Batch generation failed:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to repurpose content' },
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

  const { sourceContent, platform, outputFormat } = parsed.data;

  try {
    const adapted = await multiFormatAdapter.adaptContent({
      sourceContent,
      targetPlatforms: [platform],
      goal: goalForOutputFormat(outputFormat),
    });

    const variant = adapted.variants[0];
    const content = variant?.content ?? '';

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Failed to repurpose content' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      platform,
      content,
    });
  } catch (error) {
    logger.error('[content/repurpose] Generation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to repurpose content' },
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

// Edge runtime is not compatible with AI providers — use Node.js
export const runtime = 'nodejs';
