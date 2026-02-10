/**
 * Content Recommendations API
 *
 * @description AI-powered content recommendations for optimal performance
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import {
  contentRecommendationEngine,
  Platform,
  RecommendationType,
} from '@/lib/recommendations/content-engine';
import { logger } from '@/lib/logger';

// Request validation schemas
const GetRecommendationsSchema = z.object({
  platforms: z.array(z.string()).optional(),
  types: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).optional(),
});

const OptimalTimesSchema = z.object({
  platform: z.string(),
});

const FormatRecommendationsSchema = z.object({
  platform: z.string(),
});

const ContentGapsSchema = z.object({
  platforms: z.array(z.string()),
});

const DismissSchema = z.object({
  recommendationId: z.string(),
});

const ApplySchema = z.object({
  recommendationId: z.string(),
  action: z.any(),
});

/**
 * GET /api/recommendations
 * Get personalized recommendations
 */
export async function GET(request: NextRequest) {
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

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const action = searchParams.get('action') || 'list';

    // Get recommendation cards for dashboard
    if (action === 'cards') {
      const platforms = searchParams.get('platforms')?.split(',') as Platform[] | undefined;

      const cards = await contentRecommendationEngine.getRecommendationCards(
        userId,
        platforms
      );

      return APISecurityChecker.createSecureResponse({
        cards,
        total: cards.length,
      });
    }

    // Get optimal posting times
    if (action === 'times') {
      const platform = searchParams.get('platform') as Platform;

      if (!platform) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Platform is required' },
          400
        );
      }

      const times = await contentRecommendationEngine.getOptimalPostingTimes(
        userId,
        platform
      );

      return APISecurityChecker.createSecureResponse({ times });
    }

    // Get format recommendations
    if (action === 'formats') {
      const platform = searchParams.get('platform') as Platform;

      if (!platform) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Platform is required' },
          400
        );
      }

      const formats = await contentRecommendationEngine.getFormatRecommendations(
        userId,
        platform
      );

      return APISecurityChecker.createSecureResponse({ formats });
    }

    // Get content gap analysis
    if (action === 'gaps') {
      const platforms = (searchParams.get('platforms')?.split(',') ||
        ['instagram', 'twitter', 'linkedin']) as Platform[];

      const gaps = await contentRecommendationEngine.analyzeContentGaps(
        userId,
        platforms
      );

      return APISecurityChecker.createSecureResponse({ gaps });
    }

    // Default: Get all recommendations
    const platforms = searchParams.get('platforms')?.split(',') as Platform[] | undefined;
    const types = searchParams.get('types')?.split(',') as RecommendationType[] | undefined;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const recommendations = await contentRecommendationEngine.getRecommendations(
      userId,
      { platforms, types, limit }
    );

    return APISecurityChecker.createSecureResponse({
      recommendations,
      total: recommendations.length,
    });
  } catch (error: any) {
    logger.error('Recommendations GET error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * POST /api/recommendations
 * Get specific recommendations or perform actions
 */
export async function POST(request: NextRequest) {
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
  const { searchParams } = new URL(request.url);

  try {
    const body = await request.json();
    const action = searchParams.get('action') || 'get';

    // Get recommendations with filters
    if (action === 'get') {
      const validated = GetRecommendationsSchema.parse(body);

      const recommendations = await contentRecommendationEngine.getRecommendations(
        userId,
        {
          platforms: validated.platforms as Platform[],
          types: validated.types as RecommendationType[],
          limit: validated.limit,
        }
      );

      return APISecurityChecker.createSecureResponse({
        recommendations,
        total: recommendations.length,
      });
    }

    // Get optimal posting times
    if (action === 'times') {
      const validated = OptimalTimesSchema.parse(body);

      const times = await contentRecommendationEngine.getOptimalPostingTimes(
        userId,
        validated.platform as Platform
      );

      return APISecurityChecker.createSecureResponse({ times });
    }

    // Get format recommendations
    if (action === 'formats') {
      const validated = FormatRecommendationsSchema.parse(body);

      const formats = await contentRecommendationEngine.getFormatRecommendations(
        userId,
        validated.platform as Platform
      );

      return APISecurityChecker.createSecureResponse({ formats });
    }

    // Analyze content gaps
    if (action === 'gaps') {
      const validated = ContentGapsSchema.parse(body);

      const gaps = await contentRecommendationEngine.analyzeContentGaps(
        userId,
        validated.platforms as Platform[]
      );

      await auditLogger.logData(
        'read',
        'recommendations',
        undefined,
        userId,
        'success',
        { action: 'CONTENT_GAPS_ANALYZED', platforms: validated.platforms }
      );

      return APISecurityChecker.createSecureResponse({ gaps });
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid action' },
      400
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Recommendations POST error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * PUT /api/recommendations
 * Dismiss or apply recommendations
 */
export async function PUT(request: NextRequest) {
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
  const { searchParams } = new URL(request.url);

  try {
    const body = await request.json();
    const action = searchParams.get('action');

    // Dismiss recommendation
    if (action === 'dismiss') {
      const validated = DismissSchema.parse(body);

      const success = await contentRecommendationEngine.dismissRecommendation(
        userId,
        validated.recommendationId
      );

      if (!success) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Failed to dismiss recommendation' },
          500
        );
      }

      await auditLogger.logData(
        'update',
        'recommendations',
        validated.recommendationId,
        userId,
        'success',
        { action: 'RECOMMENDATION_DISMISSED' }
      );

      return APISecurityChecker.createSecureResponse({ success: true });
    }

    // Apply recommendation
    if (action === 'apply') {
      const validated = ApplySchema.parse(body);

      const result = await contentRecommendationEngine.applyRecommendation(
        userId,
        validated.recommendationId,
        validated.action
      );

      if (!result.success) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Failed to apply recommendation' },
          500
        );
      }

      await auditLogger.logData(
        'update',
        'recommendations',
        validated.recommendationId,
        userId,
        'success',
        {
          action: 'RECOMMENDATION_APPLIED',
          actionTaken: validated.action,
        }
      );

      return APISecurityChecker.createSecureResponse({
        success: true,
        result: result.result,
      });
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid action' },
      400
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Recommendations PUT error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}
