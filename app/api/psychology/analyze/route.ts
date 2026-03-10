/**
 * Psychology Analysis API - Analyze Endpoint
 *
 * AI-powered analysis of content for psychological persuasion principles
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - OPENROUTER_API_KEY: OpenRouter API key (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { psychologyAnalyzer } from '@/lib/ai/psychology-analyzer';
import { z } from 'zod';
import { resolveAIProvider } from '@/lib/ai/api-credential-injector';
import { requireApiKey } from '@/lib/middleware/require-api-key';
import { logger } from '@/lib/logger';

const AnalyzeRequestSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  targetAudience: z.string().optional(),
  platform: z.enum(['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'email', 'web']).optional(),
  contentType: z.enum(['post', 'ad', 'email', 'landing', 'tagline', 'headline']).optional(),
});

/**
 * POST /api/psychology/analyze
 * Analyze content for psychological persuasion effectiveness
 */
export async function POST(request: NextRequest) {
  return requireApiKey(request, async (userId) => {
  try {
    const body = await request.json();
    const validation = AnalyzeRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { content, targetAudience, platform, contentType } = validation.data;

    // Resolve AI provider (user key → platform key)
    const ai = await resolveAIProvider(userId);

    // Perform analysis with user's AI provider
    const rawAnalysis = await psychologyAnalyzer.analyzeContent(content, {
      targetAudience,
      platform,
      contentType,
    }, ai);

    // Clamp all numeric scores to valid ranges (0–100) to guard against
    // out-of-bounds values from the AI model response.
    const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));
    const analysis = {
      ...rawAnalysis,
      overallScore: clamp(rawAnalysis.overallScore),
      principlesDetected: rawAnalysis.principlesDetected.map((p) => ({
        ...p,
        strength: clamp(p.strength),
        confidence: clamp(p.confidence),
      })),
      readability: {
        ...rawAnalysis.readability,
        score: clamp(rawAnalysis.readability.score),
      },
      persuasionMetrics: Object.fromEntries(
        Object.entries(rawAnalysis.persuasionMetrics).map(([k, v]) => [k, clamp(v as number)])
      ) as typeof rawAnalysis.persuasionMetrics,
    };

    // Store analysis if generationId provided
    const generationId = body.generationId;
    if (generationId) {
      await psychologyAnalyzer.storeAnalysis(userId, content, analysis, generationId);
    }

    return NextResponse.json({
      success: true,
      data: {
        content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        targetAudience,
        platform,
        contentType,
        analysis,
      },
    });
  } catch (error) {
    logger.error('Psychology analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    );
  }
  });
}

/**
 * GET /api/psychology/analyze
 * Get analysis capabilities and supported options
 */
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: {
        supportedPlatforms: ['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'email', 'web'],
        supportedContentTypes: ['post', 'ad', 'email', 'landing', 'tagline', 'headline'],
        maxContentLength: 5000,
        features: [
          'Psychological principle detection',
          'Emotional tone analysis',
          'Readability scoring',
          'Persuasion metrics',
          'AI-powered recommendations',
          'Engagement prediction',
        ],
      },
    });
  } catch (error) {
    logger.error('Psychology capabilities error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch capabilities' },
      { status: 500 }
    );
  }
}
