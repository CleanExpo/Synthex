/**
 * Cached Viral Patterns API
 * Returns viral content patterns with Redis caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { cachedRoute } from '@/lib/middleware/cache-middleware';
import { createClient } from '@supabase/supabase-js';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';

/** Pattern record from viral patterns table */
interface PatternRecord {
  id: string;
  platform: string;
  engagement_rate: number;
  shares?: number;
  created_at: string;
  [key: string]: unknown;
}

// Initialize Supabase client
// Lazy Supabase client — avoids crash during Next.js build
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

async function handler(req: NextRequest) {
  try {
    // Auth guard
    const userId = await getUserIdFromRequestOrCookies(req);
    if (!userId) return unauthorizedResponse();

    // Resolve org context — deny if no org (prevents cross-org data leak)
    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organisation context found' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform') || 'all';
    const limit = parseInt(searchParams.get('limit') || '10');
    const timeframe = searchParams.get('timeframe') || '7d';

    // Fetch viral patterns from database — scoped to the authenticated user's org
    let query = getSupabase()
      .from('viral_patterns')
      .select('*')
      .eq('organization_id', organizationId)
      .order('engagement_rate', { ascending: false })
      .limit(limit);

    if (platform !== 'all') {
      query = query.eq('platform', platform);
    }

    // Add timeframe filter
    const now = new Date();
    const timeframeMap: Record<string, number> = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };

    const daysAgo = timeframeMap[timeframe] || 7;
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    query = query.gte('created_at', startDate.toISOString());

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch patterns' },
        { status: 500 }
      );
    }

    // Calculate trending score
    const patternsWithScore = (data || []).map(pattern => ({
      ...(pattern as Record<string, unknown>),
      trendingScore: calculateTrendingScore(pattern as PatternRecord),
      cacheTimestamp: new Date().toISOString(),
    }));

    return NextResponse.json({
      success: true,
      platform,
      timeframe,
      count: patternsWithScore.length,
      patterns: patternsWithScore,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching patterns:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateTrendingScore(pattern: PatternRecord): number {
  const engagementWeight = 0.4;
  const recencyWeight = 0.3;
  const virialityWeight = 0.3;

  // Calculate recency score (0-1)
  const now = Date.now();
  const createdAt = new Date(pattern.created_at).getTime();
  const ageInHours = (now - createdAt) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 1 - ageInHours / 168); // 168 hours = 1 week

  // Normalize engagement rate (0-1)
  const engagementScore = Math.min(1, pattern.engagement_rate / 10);

  // Calculate virality score based on share rate
  const viralityScore = Math.min(1, (pattern.shares || 0) / 1000);

  return (
    engagementScore * engagementWeight +
    recencyScore * recencyWeight +
    viralityScore * virialityWeight
  );
}

// Export cached version with 5 minute TTL
export const GET = cachedRoute(handler, {
  ttl: 300, // 5 minutes
  varyBy: ['authorization'], // Vary cache by user
  excludeQuery: ['_t'], // Exclude timestamp params from cache key
});
