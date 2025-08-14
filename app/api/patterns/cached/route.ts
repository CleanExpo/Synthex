/**
 * Cached Viral Patterns API
 * Returns viral content patterns with Redis caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { cachedRoute } from '@/src/middleware/cache-middleware';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform') || 'all';
    const limit = parseInt(searchParams.get('limit') || '10');
    const timeframe = searchParams.get('timeframe') || '7d';
    
    // Fetch viral patterns from database
    let query = supabase
      .from('viral_patterns')
      .select('*')
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
      '90d': 90
    };
    
    const daysAgo = timeframeMap[timeframe] || 7;
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    query = query.gte('created_at', startDate.toISOString());
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch patterns', details: error.message },
        { status: 500 }
      );
    }
    
    // Calculate trending score
    const patternsWithScore = (data || []).map(pattern => ({
      ...pattern,
      trendingScore: calculateTrendingScore(pattern),
      cacheTimestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      success: true,
      platform,
      timeframe,
      count: patternsWithScore.length,
      patterns: patternsWithScore,
      cached: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching patterns:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateTrendingScore(pattern: any): number {
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
  excludeQuery: ['_t'] // Exclude timestamp params from cache key
});