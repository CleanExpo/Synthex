/**
 * Engagement Prediction API Route
 *
 * @description Predict engagement metrics for content:
 * - POST: Predict engagement for content
 * - GET: Get past predictions and accuracy
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 *
 * FAILURE MODE: Returns 500 on errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { z } from 'zod';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const predictEngagementSchema = z.object({
  text: z.string().min(1).max(10000),
  platform: z.enum(['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'youtube']),
  contentType: z.enum(['post', 'campaign', 'story', 'reel', 'thread']).default('post'),
  contentId: z.string().optional(),
  hasMedia: z.boolean().default(false),
  mediaType: z.enum(['image', 'video', 'carousel', 'gif']).optional(),
  scheduledTime: z.string().datetime().optional(),
  audienceSize: z.number().positive().optional(),
});

const updateActualsSchema = z.object({
  predictionId: z.string(),
  actualLikes: z.number().int().min(0),
  actualComments: z.number().int().min(0),
  actualShares: z.number().int().min(0),
  actualReach: z.number().int().min(0).optional(),
});

// ============================================================================
// TYPES
// ============================================================================

interface PredictionResult {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  engagementRate: number;
  confidence: number;
  factors: {
    factor: string;
    impact: 'positive' | 'neutral' | 'negative';
    weight: number;
  }[];
  recommendations: string[];
}

// ============================================================================
// PREDICTION ENGINE
// ============================================================================

/**
 * Platform-specific base engagement rates
 */
const PLATFORM_BASE_RATES: Record<string, {
  likes: number;
  comments: number;
  shares: number;
  avgReach: number;
}> = {
  twitter: { likes: 0.02, comments: 0.005, shares: 0.01, avgReach: 500 },
  instagram: { likes: 0.04, comments: 0.01, shares: 0.005, avgReach: 800 },
  linkedin: { likes: 0.03, comments: 0.015, shares: 0.008, avgReach: 400 },
  facebook: { likes: 0.025, comments: 0.008, shares: 0.012, avgReach: 600 },
  tiktok: { likes: 0.08, comments: 0.02, shares: 0.03, avgReach: 2000 },
  youtube: { likes: 0.03, comments: 0.008, shares: 0.002, avgReach: 1000 },
};

/**
 * Analyze content for engagement factors
 */
function analyzeContentFactors(
  text: string,
  platform: string,
  hasMedia: boolean,
  mediaType?: string,
  scheduledTime?: Date
): { factor: string; impact: 'positive' | 'neutral' | 'negative'; weight: number }[] {
  const factors: { factor: string; impact: 'positive' | 'neutral' | 'negative'; weight: number }[] = [];

  // Text length analysis
  const wordCount = text.split(/\s+/).length;
  const optimalLength: Record<string, [number, number]> = {
    twitter: [10, 40],
    instagram: [20, 150],
    linkedin: [50, 300],
    facebook: [40, 200],
    tiktok: [5, 30],
    youtube: [100, 500],
  };

  const [min, max] = optimalLength[platform] || [20, 100];
  if (wordCount >= min && wordCount <= max) {
    factors.push({ factor: 'Optimal content length', impact: 'positive', weight: 1.15 });
  } else if (wordCount < min / 2 || wordCount > max * 2) {
    factors.push({ factor: 'Content length not optimal', impact: 'negative', weight: 0.85 });
  }

  // Emoji usage
  const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
  if (emojiCount >= 1 && emojiCount <= 5) {
    factors.push({ factor: 'Good emoji usage', impact: 'positive', weight: 1.1 });
  } else if (emojiCount > 10) {
    factors.push({ factor: 'Excessive emojis', impact: 'negative', weight: 0.9 });
  }

  // Hashtags
  const hashtagCount = (text.match(/#\w+/g) || []).length;
  const optimalHashtags: Record<string, [number, number]> = {
    twitter: [1, 3],
    instagram: [5, 15],
    linkedin: [3, 5],
    facebook: [1, 3],
    tiktok: [3, 8],
    youtube: [3, 10],
  };

  const [minH, maxH] = optimalHashtags[platform] || [1, 5];
  if (hashtagCount >= minH && hashtagCount <= maxH) {
    factors.push({ factor: 'Optimal hashtag count', impact: 'positive', weight: 1.12 });
  } else if (hashtagCount === 0 && platform !== 'linkedin') {
    factors.push({ factor: 'No hashtags', impact: 'negative', weight: 0.92 });
  } else if (hashtagCount > maxH * 2) {
    factors.push({ factor: 'Too many hashtags', impact: 'negative', weight: 0.88 });
  }

  // Questions drive engagement
  if (text.includes('?')) {
    factors.push({ factor: 'Contains question (drives comments)', impact: 'positive', weight: 1.2 });
  }

  // Call to action
  if (text.match(/\b(comment|share|like|follow|subscribe|click|check out|link in bio|swipe)\b/i)) {
    factors.push({ factor: 'Has call-to-action', impact: 'positive', weight: 1.15 });
  }

  // Media impact
  if (hasMedia) {
    const mediaMultipliers: Record<string, number> = {
      video: 1.5,
      carousel: 1.4,
      image: 1.25,
      gif: 1.2,
    };
    const mult = mediaMultipliers[mediaType || 'image'] || 1.25;
    factors.push({ factor: `Has ${mediaType || 'image'} media`, impact: 'positive', weight: mult });
  } else if (platform !== 'twitter' && platform !== 'linkedin') {
    factors.push({ factor: 'No media (visual platforms prefer media)', impact: 'negative', weight: 0.6 });
  }

  // Time-based factors
  if (scheduledTime) {
    const hour = scheduledTime.getHours();
    const dayOfWeek = scheduledTime.getDay();

    // Peak hours (9-11am, 7-9pm)
    if ((hour >= 9 && hour <= 11) || (hour >= 19 && hour <= 21)) {
      factors.push({ factor: 'Posted during peak hours', impact: 'positive', weight: 1.15 });
    } else if (hour >= 0 && hour <= 5) {
      factors.push({ factor: 'Posted during off-peak hours', impact: 'negative', weight: 0.75 });
    }

    // Weekday vs weekend
    if (platform === 'linkedin' && (dayOfWeek === 0 || dayOfWeek === 6)) {
      factors.push({ factor: 'LinkedIn weekend posting', impact: 'negative', weight: 0.7 });
    } else if (platform !== 'linkedin' && (dayOfWeek === 0 || dayOfWeek === 6)) {
      factors.push({ factor: 'Weekend posting (higher engagement)', impact: 'positive', weight: 1.1 });
    }
  }

  // Sentiment boost (simple check)
  const positiveWords = ['amazing', 'love', 'excited', 'great', 'awesome', 'incredible', 'best'];
  const hasPositive = positiveWords.some((word) => text.toLowerCase().includes(word));
  if (hasPositive) {
    factors.push({ factor: 'Positive sentiment', impact: 'positive', weight: 1.1 });
  }

  return factors;
}

/**
 * Generate recommendations based on factors
 */
function generateRecommendations(
  factors: { factor: string; impact: 'positive' | 'neutral' | 'negative'; weight: number }[],
  platform: string,
  hasMedia: boolean
): string[] {
  const recommendations: string[] = [];

  const negativeFactors = factors.filter((f) => f.impact === 'negative');

  for (const factor of negativeFactors) {
    if (factor.factor.includes('length')) {
      recommendations.push('Adjust content length to platform optimal range for better engagement.');
    }
    if (factor.factor.includes('hashtag')) {
      recommendations.push(`Optimize hashtag usage for ${platform} (recommended: 3-5 relevant hashtags).`);
    }
    if (factor.factor.includes('No media')) {
      recommendations.push('Adding visual media significantly increases engagement on this platform.');
    }
    if (factor.factor.includes('off-peak')) {
      recommendations.push('Consider scheduling for peak engagement hours (9-11am or 7-9pm local time).');
    }
    if (factor.factor.includes('weekend') && platform === 'linkedin') {
      recommendations.push('LinkedIn engagement is typically lower on weekends. Consider weekday posting.');
    }
  }

  // General recommendations
  if (!factors.some((f) => f.factor.includes('question'))) {
    recommendations.push('Adding a question can significantly increase comment engagement.');
  }

  if (!factors.some((f) => f.factor.includes('call-to-action'))) {
    recommendations.push('Include a clear call-to-action to guide audience engagement.');
  }

  return recommendations.slice(0, 5);
}

/**
 * Predict engagement metrics
 */
function predictEngagement(
  text: string,
  platform: string,
  hasMedia: boolean,
  mediaType?: string,
  scheduledTime?: Date,
  audienceSize?: number
): PredictionResult {
  const baseRates = PLATFORM_BASE_RATES[platform] || PLATFORM_BASE_RATES.twitter;
  const reach = audienceSize || baseRates.avgReach;

  // Analyze factors
  const factors = analyzeContentFactors(text, platform, hasMedia, mediaType, scheduledTime);

  // Calculate multiplier from factors
  const positiveWeight = factors
    .filter((f) => f.impact === 'positive')
    .reduce((acc, f) => acc * f.weight, 1);
  const negativeWeight = factors
    .filter((f) => f.impact === 'negative')
    .reduce((acc, f) => acc * f.weight, 1);

  const totalMultiplier = positiveWeight * negativeWeight;

  // Calculate predictions
  const likes = Math.round(reach * baseRates.likes * totalMultiplier);
  const comments = Math.round(reach * baseRates.comments * totalMultiplier);
  const shares = Math.round(reach * baseRates.shares * totalMultiplier);
  const engagementRate = Math.round(((likes + comments + shares) / reach) * 10000) / 100;

  // Confidence based on factor clarity
  const confidence = Math.min(0.85, 0.5 + factors.length * 0.05);

  // Generate recommendations
  const recommendations = generateRecommendations(factors, platform, hasMedia);

  return {
    likes,
    comments,
    shares,
    reach,
    engagementRate,
    confidence,
    factors,
    recommendations,
  };
}

// ============================================================================
// POST /api/analytics/predict-engagement
// Predict engagement for content
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const body = await request.json();

    // Check if this is an update of actual results
    if (body.predictionId && body.actualLikes !== undefined) {
      const updateValidation = updateActualsSchema.safeParse(body);
      if (!updateValidation.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: updateValidation.error.errors },
          { status: 400 }
        );
      }

      const { predictionId, actualLikes, actualComments, actualShares, actualReach } = updateValidation.data;

      // Find and update prediction
      const prediction = await (prisma as any).engagementPrediction?.findUnique({
        where: { id: predictionId },
      });

      if (!prediction || prediction.userId !== userId) {
        return NextResponse.json(
          { error: 'Prediction not found' },
          { status: 404 }
        );
      }

      // Calculate accuracy
      const predictedTotal = prediction.predictedLikes + prediction.predictedComments + prediction.predictedShares;
      const actualTotal = actualLikes + actualComments + actualShares;
      const accuracy = predictedTotal > 0
        ? Math.round((1 - Math.abs(predictedTotal - actualTotal) / predictedTotal) * 100) / 100
        : 0;

      const actualEngRate = actualReach && actualReach > 0
        ? Math.round(((actualLikes + actualComments + actualShares) / actualReach) * 10000) / 100
        : null;

      const updated = await (prisma as any).engagementPrediction?.update({
        where: { id: predictionId },
        data: {
          actualLikes,
          actualComments,
          actualShares,
          actualReach,
          actualEngRate,
          accuracy,
          resultsAt: new Date(),
        },
      });

      // Also update sentiment analysis if linked
      if (prediction.contentId) {
        await (prisma as any).sentimentAnalysis?.updateMany({
          where: {
            contentId: prediction.contentId,
            userId,
          },
          data: {
            actualEngagement: {
              likes: actualLikes,
              comments: actualComments,
              shares: actualShares,
              engagementRate: actualEngRate,
            },
            predictionAccuracy: accuracy,
          },
        }).catch(() => {});
      }

      return NextResponse.json({
        prediction: updated,
        accuracy,
        updated: true,
      });
    }

    // Validate prediction request
    const validation = predictEngagementSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { text, platform, contentType, contentId, hasMedia, mediaType, scheduledTime, audienceSize } = validation.data;

    const parsedTime = scheduledTime ? new Date(scheduledTime) : undefined;

    // Get prediction
    const prediction = predictEngagement(text, platform, hasMedia, mediaType, parsedTime, audienceSize);

    // Simple sentiment analysis for storage
    const lowerText = text.toLowerCase();
    const positiveWords = ['love', 'great', 'amazing', 'awesome', 'excellent', 'fantastic'];
    const negativeWords = ['hate', 'terrible', 'awful', 'bad', 'worst', 'disappointing'];
    const posCount = positiveWords.filter((w) => lowerText.includes(w)).length;
    const negCount = negativeWords.filter((w) => lowerText.includes(w)).length;
    const sentimentScore = posCount > negCount ? 50 : negCount > posCount ? -50 : 0;
    const sentiment = posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral';

    // Store prediction
    const storedPrediction = await (prisma as any).engagementPrediction?.create({
      data: {
        userId,
        contentType,
        contentId,
        sentimentScore,
        sentiment,
        platform,
        contentLength: text.length,
        hasMedia,
        hasHashtags: /#\w+/.test(text),
        hasMentions: /@\w+/.test(text),
        postHour: parsedTime?.getHours(),
        postDayOfWeek: parsedTime?.getDay(),
        predictedLikes: prediction.likes,
        predictedComments: prediction.comments,
        predictedShares: prediction.shares,
        predictedReach: prediction.reach,
        predictedEngRate: prediction.engagementRate,
        confidenceLevel: prediction.confidence,
      },
    });

    return NextResponse.json({
      prediction: {
        id: storedPrediction?.id,
        likes: prediction.likes,
        comments: prediction.comments,
        shares: prediction.shares,
        reach: prediction.reach,
        engagementRate: prediction.engagementRate,
        confidence: prediction.confidence,
      },
      factors: prediction.factors,
      recommendations: prediction.recommendations,
      predictedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Engagement prediction error:', error);
    return NextResponse.json(
      { error: 'Failed to predict engagement' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/analytics/predict-engagement
// Get past predictions
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const { searchParams } = new URL(request.url);

    const platform = searchParams.get('platform');
    const withActuals = searchParams.get('withActuals') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    const where: any = { userId };

    if (platform) where.platform = platform;
    if (withActuals) where.actualLikes = { not: null };

    const [predictions, total] = await Promise.all([
      (prisma as any).engagementPrediction?.findMany({
        where,
        orderBy: { predictedAt: 'desc' },
        take: limit,
        skip: offset,
      }) || [],
      (prisma as any).engagementPrediction?.count({ where }) || 0,
    ]);

    // Calculate accuracy stats
    const withResults = predictions.filter((p: any) => p.accuracy !== null);
    const avgAccuracy = withResults.length > 0
      ? Math.round((withResults.reduce((sum: number, p: any) => sum + p.accuracy, 0) / withResults.length) * 100)
      : null;

    return NextResponse.json({
      predictions: predictions || [],
      total: total || 0,
      hasMore: (predictions?.length || 0) === limit,
      stats: {
        totalPredictions: total,
        withResults: withResults.length,
        avgAccuracy,
      },
    });
  } catch (error) {
    console.error('Get predictions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
