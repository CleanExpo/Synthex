import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { patternScraper } from '@/lib/services/pattern-scraper';

// This route should be called by a cron job (e.g., Vercel Cron or external service)
export async function GET(request: Request) {
  try {
    // Verify the request is from an authorized source
    const headersList = headers();
    const authHeader = headersList.get('authorization');
    
    // In production, verify this is from your cron service
    if (process.env.NODE_ENV === 'production') {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('Starting pattern analysis cron job...');

    // Scrape and analyze patterns from all platforms
    const patterns = await patternScraper.scrapeAllPlatforms();
    
    // Get insights
    const insights = await patternScraper.getInsights();

    console.log(`Analyzed ${patterns.length} patterns`);

    return NextResponse.json({
      success: true,
      message: 'Pattern analysis completed',
      stats: {
        patternsAnalyzed: patterns.length,
        avgViralityScore: insights.avgViralityScore,
        topPlatform: insights.platformPerformance?.[0]?.platform || 'N/A',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Pattern analysis cron error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze patterns' },
      { status: 500 }
    );
  }
}

// Manual trigger endpoint (for testing)
export async function POST(request: Request) {
  try {
    // Check for API key in production
    if (process.env.NODE_ENV === 'production') {
      const body = await request.json();
      if (body.apiKey !== process.env.ADMIN_API_KEY) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }
    }

    console.log('Manual pattern analysis triggered');

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
  } catch (error: any) {
    console.error('Manual pattern analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze patterns' },
      { status: 500 }
    );
  }
}