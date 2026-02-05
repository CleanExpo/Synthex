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

const AnalyzeRequestSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  targetAudience: z.string().optional(),
  platform: z.enum(['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok', 'email', 'web']).optional(),
  contentType: z.enum(['post', 'ad', 'email', 'landing', 'tagline', 'headline']).optional(),
});

// Helper to get user ID from auth
async function getUserId(request: NextRequest): Promise<string | null> {
  const authToken = request.cookies.get('auth-token')?.value;
  if (!authToken) return null;
  return 'demo-user-001';
}

/**
 * POST /api/psychology/analyze
 * Analyze content for psychological persuasion effectiveness
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = AnalyzeRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { content, targetAudience, platform, contentType } = validation.data;

    // Perform analysis
    const analysis = await psychologyAnalyzer.analyzeContent(content, {
      targetAudience,
      platform,
      contentType,
    });

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
    console.error('Psychology analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    );
  }
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
    console.error('Psychology capabilities error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch capabilities' },
      { status: 500 }
    );
  }
}
