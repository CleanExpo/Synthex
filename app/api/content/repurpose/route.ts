/**
 * Content Repurposing API
 *
 * @description POST /api/content/repurpose
 * Transforms long-form content (blogs, articles, video transcripts) into
 * multiple short-form derivative formats using AI-powered repurposing.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 * - AI_PROVIDER: AI provider selection (optional, defaults to "openrouter")
 *
 * FAILURE MODE: Returns structured error responses on validation or server failure.
 */

import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/withAuth';
import { z } from 'zod';
import { contentRepurposer } from '@/lib/ai/content-repurposer';

// ============================================================================
// VALIDATION
// ============================================================================

const RepurposeRequestSchema = z.object({
  sourceContent: z
    .string()
    .min(100, 'Content must be at least 100 characters')
    .max(50000, 'Content must be 50,000 characters or fewer'),
  sourceType: z.enum(['blog', 'article', 'video_transcript', 'podcast', 'newsletter']),
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
// HANDLER
// ============================================================================

/**
 * POST /api/content/repurpose
 *
 * Transforms long-form content into multiple short-form formats.
 *
 * @example Request body:
 * {
 *   "sourceContent": "Your long-form blog post here...",
 *   "sourceType": "blog",
 *   "outputFormats": ["thread", "video_script", "key_takeaways"]
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

  const parseResult = RepurposeRequestSchema.safeParse(body);
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

  const { sourceContent, sourceType, outputFormats } = parseResult.data;

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
    console.error('[content/repurpose] Generation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to repurpose content' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handlePost);

// Edge runtime is not compatible with AI providers — use Node.js
export const runtime = 'nodejs';
