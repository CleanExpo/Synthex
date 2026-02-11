/**
 * Trend Predictions API
 *
 * @description AI-powered trend forecasting and viral potential scoring
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
import { trendPredictor, Platform } from '@/lib/analytics/trend-predictor';
import { logger } from '@/lib/logger';

// Request validation schemas
const PredictTrendsSchema = z.object({
  topics: z.array(z.string()).min(1).max(20),
  platform: z.string(),
  industry: z.string().optional(),
});

const TrendingTopicsSchema = z.object({
  platform: z.string(),
  category: z.string().optional(),
  limit: z.number().min(1).max(50).optional(),
});

const ForecastEngagementSchema = z.object({
  accountId: z.string(),
  platform: z.string(),
  metric: z.enum(['impressions', 'engagement', 'reach', 'followers']),
  days: z.number().min(1).max(90).optional(),
});

const ViralPotentialSchema = z.object({
  content: z.object({
    text: z.string().optional(),
    mediaType: z.enum(['image', 'video', 'carousel', 'text']).optional(),
    hashtags: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    hasEmoji: z.boolean().optional(),
    hasCTA: z.boolean().optional(),
    contentLength: z.number().optional(),
    mediaCount: z.number().optional(),
    videoDuration: z.number().optional(),
    isReply: z.boolean().optional(),
    isQuote: z.boolean().optional(),
  }),
  platform: z.string(),
  scheduledTime: z.string().datetime().optional(),
  accountMetrics: z.object({
    followers: z.number(),
    avgEngagementRate: z.number(),
    postFrequency: z.number().optional(),
  }).optional(),
});

const ContentPerformanceSchema = z.object({
  contentType: z.string(),
  topics: z.array(z.string()),
  platform: z.string(),
  scheduledTime: z.string().datetime().optional(),
});

const SeasonalPatternsSchema = z.object({
  accountId: z.string(),
  platform: z.string(),
  metric: z.string().optional(),
});

/**
 * GET /api/predict/trends
 * Get trending topics or predictions
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
    const action = searchParams.get('action') || 'trending';

    // Get trending topics
    if (action === 'trending') {
      const platform = searchParams.get('platform') as Platform;
      const category = searchParams.get('category') || undefined;
      const limit = parseInt(searchParams.get('limit') || '10', 10);

      if (!platform) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Platform is required' },
          400
        );
      }

      const topics = await trendPredictor.getTrendingTopics(platform, {
        category,
        limit,
      });

      return APISecurityChecker.createSecureResponse({
        trending: topics,
        platform,
        retrievedAt: new Date().toISOString(),
      });
    }

    // Get seasonal patterns
    if (action === 'seasonal') {
      const accountId = searchParams.get('accountId');
      const platform = searchParams.get('platform') as Platform;
      const metric = searchParams.get('metric') || 'engagement';

      if (!accountId || !platform) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Account ID and platform are required' },
          400
        );
      }

      const patterns = await trendPredictor.detectSeasonalPatterns(
        accountId,
        platform
      );

      return APISecurityChecker.createSecureResponse({
        patterns,
        accountId,
        platform,
      });
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid action' },
      400
    );
  } catch (error: unknown) {
    logger.error('Trends GET error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * POST /api/predict/trends
 * Run predictions
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
    const action = searchParams.get('action') || 'predict';

    // Predict trends for topics
    if (action === 'predict') {
      const validated = PredictTrendsSchema.parse(body);

      const predictions = await trendPredictor.predictTrends(userId, {
        topics: validated.topics,
        platforms: [validated.platform as Platform],
        industry: validated.industry,
      });

      await auditLogger.logData(
        'read',
        'analytics',
        undefined,
        userId,
        'success',
        {
          action: 'TREND_PREDICTION',
          topics: validated.topics.length,
          platform: validated.platform,
        }
      );

      return APISecurityChecker.createSecureResponse({
        predictions,
        analyzedAt: new Date().toISOString(),
      });
    }

    // Forecast engagement metrics
    if (action === 'forecast') {
      const validated = ForecastEngagementSchema.parse(body);

      const forecast = await trendPredictor.forecastEngagement(
        validated.accountId,
        validated.platform as Platform,
        {
          metric: validated.metric,
          forecastDays: validated.days || 30,
        }
      );

      await auditLogger.logData(
        'read',
        'analytics',
        validated.accountId,
        userId,
        'success',
        {
          action: 'ENGAGEMENT_FORECAST',
          metric: validated.metric,
          days: validated.days || 30,
        }
      );

      return APISecurityChecker.createSecureResponse({
        forecast,
        generatedAt: new Date().toISOString(),
      });
    }

    // Calculate viral potential
    if (action === 'viral') {
      const validated = ViralPotentialSchema.parse(body);

      const viralScore = await trendPredictor.calculateViralPotential(
        userId,
        {
          text: validated.content.text || '',
          hashtags: validated.content.hashtags,
          mediaType: validated.content.mediaType,
          platform: validated.platform as Platform,
          scheduledTime: validated.scheduledTime ? new Date(validated.scheduledTime) : undefined,
        }
      );

      await auditLogger.logData(
        'read',
        'analytics',
        undefined,
        userId,
        'success',
        {
          action: 'VIRAL_POTENTIAL_CALCULATED',
          platform: validated.platform,
          score: viralScore.score,
          grade: viralScore.grade,
        }
      );

      return APISecurityChecker.createSecureResponse({
        viralPotential: viralScore,
        analyzedAt: new Date().toISOString(),
      });
    }

    // Predict content performance
    if (action === 'performance') {
      const validated = ContentPerformanceSchema.parse(body);

      const prediction = await trendPredictor.predictContentPerformance(
        userId,
        {
          text: validated.topics.join(' '),
          hashtags: validated.topics.map(t => `#${t.replace(/\s+/g, '')}`),
          mediaType: validated.contentType as 'image' | 'video' | 'carousel' | 'text',
          platform: validated.platform as Platform,
        }
      );

      await auditLogger.logData(
        'read',
        'analytics',
        undefined,
        userId,
        'success',
        {
          action: 'PERFORMANCE_PREDICTION',
          contentType: validated.contentType,
          platform: validated.platform,
        }
      );

      return APISecurityChecker.createSecureResponse({
        prediction,
        analyzedAt: new Date().toISOString(),
      });
    }

    // Detect seasonal patterns
    if (action === 'seasonal') {
      const validated = SeasonalPatternsSchema.parse(body);

      const patterns = await trendPredictor.detectSeasonalPatterns(
        validated.accountId,
        validated.platform as Platform
      );

      return APISecurityChecker.createSecureResponse({
        patterns,
        analyzedAt: new Date().toISOString(),
      });
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid action' },
      400
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Trends POST error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}
