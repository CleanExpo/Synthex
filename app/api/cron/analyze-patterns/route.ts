import { NextRequest, NextResponse } from 'next/server';
import { patternScraper } from '@/lib/services/pattern-scraper';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const maxDuration = 300;

// This route should be called by a cron job (e.g., Vercel Cron or external service)
export async function GET(request: NextRequest) {
  // Verify the request is from an authorized source
  const auth = verifyCronRequest(request, 'ANALYZE_PATTERNS');
  if (!auth.ok) return auth.response;

  try {
    // Scrape and analyze patterns from all platforms
    const patterns = await patternScraper.scrapeAllPlatforms();

    // Get insights
    const insights = await patternScraper.getInsights();

    return NextResponse.json({
      success: true,
      message: 'Pattern analysis completed',
      stats: {
        patternsAnalyzed: patterns.length,
        avgViralityScore: insights.avgViralityScore,
        topPlatform:
          (insights as { platformPerformance?: Array<{ platform: string }> })
            .platformPerformance?.[0]?.platform || 'N/A',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('Pattern analysis cron error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze patterns' },
      { status: 500 }
    );
  }
}

// Manual trigger endpoint (for testing)
export async function POST(request: NextRequest) {
  // Enforce CRON_SECRET on POST as well
  const auth = verifyCronRequest(request, 'ANALYZE_PATTERNS');
  if (!auth.ok) return auth.response;

  try {
    // Scrape and analyze patterns
    const patterns = await patternScraper.scrapeAllPlatforms();

    // Get trending patterns
    const trending = await patternScraper.getTrendingPatterns(undefined, 5);

    // Get insights
    const insights = await patternScraper.getInsights();

    return NextResponse.json({
      success: true,
      message: 'Manual pattern analysis completed',
      data: {
        patternsAnalyzed: patterns.length,
        trending: trending.slice(0, 3),
        insights,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('Manual pattern analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze patterns' },
      { status: 500 }
    );
  }
}
