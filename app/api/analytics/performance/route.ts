import { NextRequest, NextResponse } from 'next/server';

// Performance metrics storage (in-memory for development)
const performanceMetrics: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract metrics
    const { metrics, url, timestamp, userAgent } = body;
    
    // Log performance metrics
    console.log('[Performance Metrics]:', {
      url,
      fcp: metrics.fcp,
      lcp: metrics.lcp,
      fid: metrics.fid,
      cls: metrics.cls,
      ttfb: metrics.ttfb,
      timestamp,
    });

    // Check for poor performance
    const warnings: string[] = [];
    if (metrics.lcp > 2500) {
      warnings.push(`LCP is ${metrics.lcp}ms (should be < 2500ms)`);
    }
    if (metrics.fid > 100) {
      warnings.push(`FID is ${metrics.fid}ms (should be < 100ms)`);
    }
    if (metrics.cls > 0.1) {
      warnings.push(`CLS is ${metrics.cls} (should be < 0.1)`);
    }
    if (metrics.ttfb > 600) {
      warnings.push(`TTFB is ${metrics.ttfb}ms (should be < 600ms)`);
    }

    if (warnings.length > 0) {
      console.warn('[Performance Warnings]:', warnings);
    }

    // Store metrics
    performanceMetrics.push({
      ...body,
      warnings,
      receivedAt: new Date().toISOString(),
    });

    // Keep only last 500 metrics in memory
    if (performanceMetrics.length > 500) {
      performanceMetrics.splice(0, performanceMetrics.length - 500);
    }

    // In production, send to analytics service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to Google Analytics, DataDog, etc.
      // await sendToAnalyticsService(body);
    }

    return NextResponse.json({ 
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error('Error processing performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to process metrics' },
      { status: 500 }
    );
  }
}

// GET endpoint for performance summary (development only)
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  // Calculate averages
  const averages = {
    fcp: 0,
    lcp: 0,
    fid: 0,
    cls: 0,
    ttfb: 0,
  };

  if (performanceMetrics.length > 0) {
    const totals = performanceMetrics.reduce((acc, item) => {
      acc.fcp += item.metrics.fcp || 0;
      acc.lcp += item.metrics.lcp || 0;
      acc.fid += item.metrics.fid || 0;
      acc.cls += item.metrics.cls || 0;
      acc.ttfb += item.metrics.ttfb || 0;
      return acc;
    }, { fcp: 0, lcp: 0, fid: 0, cls: 0, ttfb: 0 });

    const count = performanceMetrics.length;
    averages.fcp = totals.fcp / count;
    averages.lcp = totals.lcp / count;
    averages.fid = totals.fid / count;
    averages.cls = totals.cls / count;
    averages.ttfb = totals.ttfb / count;
  }

  // Get recent metrics
  const recentMetrics = performanceMetrics.slice(-10);

  // Count warnings
  const totalWarnings = performanceMetrics.reduce((acc, item) => {
    return acc + (item.warnings?.length || 0);
  }, 0);

  return NextResponse.json({
    summary: {
      totalMetrics: performanceMetrics.length,
      totalWarnings,
      averages: {
        fcp: averages.fcp.toFixed(2) + 'ms',
        lcp: averages.lcp.toFixed(2) + 'ms',
        fid: averages.fid.toFixed(2) + 'ms',
        cls: averages.cls.toFixed(4),
        ttfb: averages.ttfb.toFixed(2) + 'ms',
      },
      scores: {
        fcp: averages.fcp < 1800 ? 'Good' : averages.fcp < 3000 ? 'Needs Improvement' : 'Poor',
        lcp: averages.lcp < 2500 ? 'Good' : averages.lcp < 4000 ? 'Needs Improvement' : 'Poor',
        fid: averages.fid < 100 ? 'Good' : averages.fid < 300 ? 'Needs Improvement' : 'Poor',
        cls: averages.cls < 0.1 ? 'Good' : averages.cls < 0.25 ? 'Needs Improvement' : 'Poor',
        ttfb: averages.ttfb < 600 ? 'Good' : averages.ttfb < 1500 ? 'Needs Improvement' : 'Poor',
      },
    },
    recentMetrics,
  });
}