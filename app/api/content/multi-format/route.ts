/**
 * Multi-Format Content Generation API
 *
 * @description POST /api/content/multi-format
 * Takes source content and generates platform-specific variations for
 * all 9 supported platforms using AI-powered adaptation.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 * - AI_PROVIDER: AI provider selection (optional, defaults to "openrouter")
 *
 * FAILURE MODE: Returns structured error responses on validation or server failure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/withAuth';
import { requireApiKey } from '@/lib/middleware/require-api-key';
import { z } from 'zod';
import { multiFormatAdapter } from '@/lib/ai/multi-format-adapter';

// ============================================================================
// VALIDATION
// ============================================================================

const MultiFormatRequestSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(10000, 'Content must be 10,000 characters or fewer'),
  sourcePlatform: z
    .enum([
      'twitter',
      'linkedin',
      'instagram',
      'tiktok',
      'facebook',
      'youtube',
      'pinterest',
      'reddit',
      'threads',
    ])
    .optional(),
  targetPlatforms: z
    .array(
      z.enum([
        'twitter',
        'linkedin',
        'instagram',
        'tiktok',
        'facebook',
        'youtube',
        'pinterest',
        'reddit',
        'threads',
      ])
    )
    .min(1, 'At least one target platform is required')
    .max(9, 'Maximum 9 target platforms'),
  tone: z
    .enum(['professional', 'casual', 'playful', 'authoritative', 'friendly'])
    .optional(),
  goal: z
    .enum(['engagement', 'reach', 'conversions', 'brand_awareness', 'traffic'])
    .default('engagement'),
});

// ============================================================================
// HANDLER
// ============================================================================

/**
 * POST /api/content/multi-format
 *
 * Generates platform-specific content variations from a single source input.
 *
 * @example Request body:
 * {
 *   "content": "Your content here",
 *   "targetPlatforms": ["twitter", "linkedin", "instagram"],
 *   "tone": "professional",
 *   "goal": "engagement"
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

  const parseResult = MultiFormatRequestSchema.safeParse(body);
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

  const { content, sourcePlatform, targetPlatforms, tone, goal } = parseResult.data;

  try {
    const result = await multiFormatAdapter.adaptContent({
      sourceContent: content,
      sourcePlatform,
      targetPlatforms,
      tone,
      goal,
    });

    return NextResponse.json({
      success: true,
      source: result.source,
      variants: result.variants,
    });
  } catch (error) {
    console.error('[content/multi-format] Generation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate content variants' },
      { status: 500 }
    );
  }
}

const authenticatedHandler = withAuth(handlePost);

export async function POST(request: NextRequest) {
  return requireApiKey(request, async () => {
    return authenticatedHandler(request);
  });
}

// Edge runtime is not compatible with AI providers — use Node.js
export const runtime = 'nodejs';
