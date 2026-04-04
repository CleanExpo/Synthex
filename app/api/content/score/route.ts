/**
 * Content Score API
 *
 * @description POST /api/content/score
 * Analyzes content quality across five dimensions using the pure-function
 * ContentScorer service. Fast, real-time scoring with no AI calls.
 * Optionally compares content against a saved PromptTemplate structure.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns structured error responses on validation or server failure.
 */

import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/withAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { contentScorer, ScoreResult } from '@/lib/ai/content-scorer';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION
// ============================================================================

const ScoreRequestSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(10000, 'Content must be 10,000 characters or fewer'),
  platform: z.enum([
    'twitter',
    'linkedin',
    'instagram',
    'tiktok',
    'facebook',
    'youtube',
    'pinterest',
    'reddit',
    'threads',
  ]),
  goal: z
    .enum(['engagement', 'reach', 'conversions', 'brand_awareness', 'traffic'])
    .default('engagement'),
  templateId: z.string().optional(),
});

type ScoreRequest = z.infer<typeof ScoreRequestSchema>;

// ============================================================================
// TEMPLATE MATCHING
// ============================================================================

interface TemplateStructure {
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string[];
  mediaType?: string;
}

interface TemplateMatchResult {
  /** 0-100 match score */
  score: number;
  /** Elements present in the template but missing from the content */
  missingElements: string[];
}

/**
 * Compares content against a template structure and returns a match score
 * plus a list of missing structural elements.
 */
function matchAgainstTemplate(
  content: string,
  structure: TemplateStructure
): TemplateMatchResult {
  const missingElements: string[] = [];
  let matchedElements = 0;
  let totalElements = 0;

  // Check for hook presence
  if (structure.hook) {
    totalElements++;
    // Template has a hook — check if content starts with something hook-like
    const hookKeywords = structure.hook.toLowerCase().split(/\s+/).slice(0, 3);
    const contentLower = content.toLowerCase();
    const hasHookMatch = hookKeywords.some((kw) => contentLower.startsWith(kw));
    if (hasHookMatch) {
      matchedElements++;
    } else {
      // Looser check: does any part of the hook appear?
      const anyKeywordPresent = hookKeywords.some((kw) => kw.length > 3 && contentLower.includes(kw));
      if (anyKeywordPresent) {
        matchedElements += 0.5;
      } else {
        missingElements.push(`Hook: "${structure.hook.substring(0, 50)}${structure.hook.length > 50 ? '...' : ''}"`);
      }
    }
  }

  // Check for body content (length heuristic)
  if (structure.body) {
    totalElements++;
    // Body present — content should have at least 50% of the body length
    const minBodyLength = Math.round(structure.body.length * 0.5);
    if (content.length >= minBodyLength) {
      matchedElements++;
    } else {
      missingElements.push('Expand the body — content is shorter than the template suggests');
    }
  }

  // Check for CTA
  if (structure.cta) {
    totalElements++;
    const ctaKeywords = structure.cta.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const contentLower = content.toLowerCase();
    const ctaPresent = ctaKeywords.some((kw) => contentLower.includes(kw));

    // Also check generic CTA patterns as a fallback
    const genericCTA = /comment|share|follow|like|save|click|tap|swipe|link|dm|message|think|know/i.test(content);
    if (ctaPresent || genericCTA) {
      matchedElements++;
    } else {
      missingElements.push(`CTA: "${structure.cta.substring(0, 60)}${structure.cta.length > 60 ? '...' : ''}"`);
    }
  }

  // Check for hashtags
  if (structure.hashtags && structure.hashtags.length > 0) {
    totalElements++;
    const contentHashtags = (content.match(/#\w+/g) ?? []).map((h) => h.toLowerCase());
    const templateHashtags = structure.hashtags.map((h) => h.toLowerCase().replace(/^#/, ''));
    const matchingTags = templateHashtags.filter((tag) =>
      contentHashtags.includes(`#${tag}`) || contentHashtags.includes(tag)
    );

    if (matchingTags.length >= Math.ceil(templateHashtags.length * 0.5)) {
      matchedElements++;
    } else {
      const missing = templateHashtags
        .filter((tag) => !matchingTags.includes(tag))
        .slice(0, 3)
        .map((t) => `#${t}`);
      missingElements.push(`Missing hashtags: ${missing.join(', ')}`);
    }
  }

  // Calculate match score
  const matchScore = totalElements > 0
    ? Math.round((matchedElements / totalElements) * 100)
    : 100; // No template structure to compare against

  return {
    score: Math.max(0, Math.min(100, matchScore)),
    missingElements,
  };
}

// ============================================================================
// RESPONSE SHAPE
// ============================================================================

interface ScoreApiResponse {
  success: true;
  score: ScoreResult & {
    templateMatch: TemplateMatchResult | null;
  };
}

// ============================================================================
// HANDLER
// ============================================================================

/**
 * POST /api/content/score
 *
 * Scores content quality for the specified platform and goal.
 * Optionally compares against a PromptTemplate when templateId is provided.
 *
 * @example Request body:
 * {
 *   "content": "Your post text here",
 *   "platform": "linkedin",
 *   "goal": "engagement",
 *   "templateId": "optional-template-uuid"
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

  const parseResult = ScoreRequestSchema.safeParse(body);
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

  const { content, platform, templateId }: ScoreRequest = parseResult.data;

  // Run content scoring (pure functions, no async needed)
  const scoreResult = contentScorer.score(content, platform);

  // Optional template matching
  let templateMatch: TemplateMatchResult | null = null;

  if (templateId) {
    try {
      const userId = request.userId;

      // Fetch template — must be accessible by this user (own, public, system, or org)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });

      const template = await prisma.promptTemplate.findFirst({
        where: {
          id: templateId,
          OR: [
            { userId },
            { isPublic: true },
            { isSystem: true },
            ...(user?.organizationId ? [{ organizationId: user.organizationId }] : []),
          ],
        },
        select: { structure: true },
      });

      if (template?.structure) {
        templateMatch = matchAgainstTemplate(
          content,
          template.structure as TemplateStructure
        );
      } else if (!template) {
        // Template not found or not accessible — return null match rather than 404
        // (scoring result is still useful without template context)
        templateMatch = null;
      }
    } catch (error) {
      // Non-critical failure — score result is still valid
      logger.error('[content/score] Template lookup failed:', error);
      templateMatch = null;
    }
  }

  const response: ScoreApiResponse = {
    success: true,
    score: {
      ...scoreResult,
      templateMatch,
    },
  };

  return NextResponse.json(response);
}

export const POST = withAuth(handlePost);

// Edge runtime is not compatible with Prisma — use Node.js
export const runtime = 'nodejs';
