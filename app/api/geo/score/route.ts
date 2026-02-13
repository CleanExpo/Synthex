/**
 * GEO Quick Score API — Lightweight scoring without database storage
 *
 * POST /api/geo/score
 * Body: { contentText: string, platform?: string }
 * Returns: { score: GEOScore, tier: string }
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET (CRITICAL)
 *
 * FAILURE MODE: Service will not start if missing
 *
 * @module app/api/geo/score/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { analyzeGEO } from '@/lib/geo/geo-analyzer';
import type { GEOPlatform } from '@/lib/geo/types';

const scoreSchema = z.object({
  contentText: z.string().min(50, 'Content must be at least 50 characters'),
  platform: z.enum(['google_aio', 'chatgpt', 'perplexity', 'bing_copilot', 'all']).optional().default('all'),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = scoreSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const result = await analyzeGEO({
      contentText: validation.data.contentText,
      platform: validation.data.platform as GEOPlatform,
    });

    // Return only the score (lightweight)
    const tier = result.score.overall >= 80 ? 'excellent'
      : result.score.overall >= 60 ? 'good'
      : result.score.overall >= 40 ? 'needs_work'
      : 'poor';

    return NextResponse.json({
      score: result.score,
      tier,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('GEO score error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to score content' },
      { status: 500 }
    );
  }
}
