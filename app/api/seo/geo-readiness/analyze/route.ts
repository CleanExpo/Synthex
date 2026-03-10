/**
 * GEO Readiness Analyze API
 *
 * POST /api/seo/geo-readiness/analyze
 * Analyzes content for AI search engine readiness with readiness tier,
 * dimension summaries, and platform-specific readiness flags.
 *
 * Protected by authentication. Requires paid subscription.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { analyzeReadiness } from '@/lib/seo/geo-readiness-service';
import { prisma } from '@/lib/prisma';
import type { GEOPlatform } from '@/lib/geo/types';
import { logger } from '@/lib/logger';

const analyzeRequestSchema = z.object({
  contentText: z.string().min(50, 'Content must be at least 50 characters'),
  contentUrl: z.string().url().optional(),
  platform: z.enum(['google_aio', 'chatgpt', 'perplexity', 'bing_copilot', 'all']).optional().default('all'),
});

/**
 * POST /api/seo/geo-readiness/analyze
 * Analyze content for GEO readiness
 */
export async function POST(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
    }

    // Get subscription
    const subscription = await subscriptionService.getOrCreateSubscription(userId);

    // Check if user has SEO access
    if (subscription.plan === 'free') {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'GEO Readiness tools require a paid subscription',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = analyzeRequestSchema.safeParse(body);

    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Invalid request',
          details: validation.error.flatten().fieldErrors,
        },
        400
      );
    }

    const { contentText, contentUrl, platform } = validation.data;

    // Run GEO readiness analysis
    const result = await analyzeReadiness(
      contentText,
      contentUrl,
      platform as GEOPlatform
    );

    // Store analysis in database
    const analysis = await prisma.gEOAnalysis.create({
      data: {
        userId,
        contentUrl: contentUrl || null,
        contentText,
        platform: platform || 'all',
        overallScore: result.score.overall,
        citabilityScore: result.score.citability,
        structureScore: result.score.structure,
        multiModalScore: result.score.multiModal,
        authorityScore: result.score.authority,
        technicalScore: result.score.technical,
        citablePassages: JSON.parse(JSON.stringify(result.citablePassages)),
        recommendations: JSON.parse(JSON.stringify(result.recommendations)),
        schemaIssues: JSON.parse(JSON.stringify(result.schemaIssues)),
      },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      id: analysis.id,
      ...result,
    });
  } catch (error) {
    logger.error('GEO Readiness Analyze API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to analyze content for GEO readiness' },
      500
    );
  }
}
