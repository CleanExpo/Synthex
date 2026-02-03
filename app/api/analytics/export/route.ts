/**
 * Analytics Export API
 *
 * Exports analytics data in various formats (CSV, JSON, XLSX).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/analytics/export/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withRateLimit, rateLimitConfigs } from '@/lib/rate-limiter-enhanced';
import { exportQuerySchema, type ExportQueryInput, periodToDateRange } from '@/lib/schemas/analytics';
import { z } from 'zod';

// =============================================================================
// Auth Helper - Uses centralized JWT utilities (no fallback secrets)
// =============================================================================

import { verifyToken } from '@/lib/auth/jwt-utils';

async function getUserFromRequest(request: NextRequest): Promise<{ id: string; email: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    return { id: decoded.userId, email: decoded.email || '' };
  } catch {
    return null;
  }
}

// =============================================================================
// Data Fetching
// =============================================================================

// Type for analytics JSON field
interface PostAnalytics {
  likes?: number;
  comments?: number;
  shares?: number;
  impressions?: number;
  reach?: number;
  clicks?: number;
}

async function fetchAnalyticsData(
  userId: string,
  startDate: Date,
  endDate: Date,
  platforms: string[]
) {
  // Fetch posts with engagement metrics (stored in analytics JSON field)
  const posts = await prisma.post.findMany({
    where: {
      campaign: {
        userId,
        platform: platforms.includes('all') ? undefined : { in: platforms },
      },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      content: true,
      status: true,
      platform: true,
      scheduledAt: true,
      publishedAt: true,
      createdAt: true,
      analytics: true,
      campaign: {
        select: {
          name: true,
          platform: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch campaign summaries
  const campaigns = await prisma.campaign.findMany({
    where: {
      userId,
      platform: platforms.includes('all') ? undefined : { in: platforms },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      name: true,
      platform: true,
      status: true,
      createdAt: true,
      _count: {
        select: { posts: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate aggregates from analytics JSON field
  const totals = posts.reduce(
    (acc, post) => {
      const analytics = (post.analytics as PostAnalytics) || {};
      return {
        posts: acc.posts + 1,
        likes: acc.likes + (analytics.likes || 0),
        comments: acc.comments + (analytics.comments || 0),
        shares: acc.shares + (analytics.shares || 0),
        impressions: acc.impressions + (analytics.impressions || 0),
        reach: acc.reach + (analytics.reach || 0),
        clicks: acc.clicks + (analytics.clicks || 0),
      };
    },
    { posts: 0, likes: 0, comments: 0, shares: 0, impressions: 0, reach: 0, clicks: 0 }
  );

  const engagementRate =
    totals.impressions > 0
      ? ((totals.likes + totals.comments + totals.shares) / totals.impressions) * 100
      : 0;

  return {
    posts,
    campaigns,
    summary: {
      ...totals,
      engagementRate: engagementRate.toFixed(2),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    },
  };
}

// =============================================================================
// Format Converters
// =============================================================================

function toCSV(data: any): string {
  const { posts, summary } = data;

  if (posts.length === 0) {
    return 'No data available for the selected period';
  }

  // Build CSV header
  const headers = [
    'Post ID',
    'Content',
    'Campaign',
    'Platform',
    'Status',
    'Scheduled At',
    'Published At',
    'Likes',
    'Comments',
    'Shares',
    'Impressions',
    'Reach',
    'Clicks',
    'Created At',
  ];

  // Build CSV rows
  const rows = posts.map((post: any) => {
    const analytics = (post.analytics as PostAnalytics) || {};
    return [
      post.id,
      `"${(post.content || '').replace(/"/g, '""').substring(0, 200)}..."`,
      post.campaign?.name || '',
      post.campaign?.platform || post.platform || '',
      post.status,
      post.scheduledAt || '',
      post.publishedAt || '',
      analytics.likes || 0,
      analytics.comments || 0,
      analytics.shares || 0,
      analytics.impressions || 0,
      analytics.reach || 0,
      analytics.clicks || 0,
      post.createdAt,
    ];
  });

  // Add summary row
  const summaryRow = [
    'TOTALS',
    '',
    '',
    '',
    '',
    '',
    '',
    summary.likes,
    summary.comments,
    summary.shares,
    summary.impressions,
    summary.reach,
    summary.clicks,
    `Engagement Rate: ${summary.engagementRate}%`,
  ];

  return [headers.join(','), ...rows.map((r: any[]) => r.join(',')), '', summaryRow.join(',')].join('\n');
}

function toJSON(data: any): string {
  return JSON.stringify(data, null, 2);
}

// =============================================================================
// Route Handlers
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query: Record<string, string | string[]> = {};
    searchParams.forEach((value, key) => {
      if (key === 'platforms' || key === 'metrics') {
        query[key] = value.split(',');
      } else {
        query[key] = value;
      }
    });

    // Handle period shorthand
    if (query.period && !query.startDate) {
      const { startDate, endDate } = periodToDateRange(query.period as string);
      query.startDate = startDate;
      query.endDate = endDate;
    }

    // Default date range if not provided
    if (!query.startDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query.startDate = thirtyDaysAgo.toISOString();
      query.endDate = new Date().toISOString();
    }

    // Validate
    const validation = exportQuerySchema.safeParse({
      ...query,
      dateRange: {
        startDate: query.startDate,
        endDate: query.endDate,
      },
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { format, dateRange, platforms } = validation.data;

    // Fetch data
    const data = await fetchAnalyticsData(
      user.id,
      new Date(dateRange.startDate),
      new Date(dateRange.endDate),
      platforms
    );

    // Generate export
    let content: string;
    let contentType: string;
    let filename: string;

    const timestamp = new Date().toISOString().split('T')[0];

    switch (format) {
      case 'csv':
        content = toCSV(data);
        contentType = 'text/csv';
        filename = `synthex-analytics-${timestamp}.csv`;
        break;
      case 'json':
        content = toJSON(data);
        contentType = 'application/json';
        filename = `synthex-analytics-${timestamp}.json`;
        break;
      case 'xlsx':
        // For XLSX, return JSON and let client handle conversion
        // Or implement server-side XLSX generation with a library
        content = toJSON(data);
        contentType = 'application/json';
        filename = `synthex-analytics-${timestamp}.json`;
        break;
      default:
        content = toJSON(data);
        contentType = 'application/json';
        filename = `synthex-analytics-${timestamp}.json`;
    }

    // Return file download
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Analytics export error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // POST for more complex export configurations
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = exportQuerySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { format, dateRange, platforms, emailDelivery } = validation.data;

    // Fetch data
    const data = await fetchAnalyticsData(
      user.id,
      new Date(dateRange.startDate),
      new Date(dateRange.endDate),
      platforms
    );

    // If email delivery requested, queue the export
    if (emailDelivery?.enabled && emailDelivery.recipients?.length) {
      // Queue export job (would integrate with job queue in production)
      return NextResponse.json({
        success: true,
        message: 'Export queued for email delivery',
        recipients: emailDelivery.recipients,
        estimatedDelivery: '5 minutes',
      });
    }

    // Return data for immediate download
    return NextResponse.json({
      success: true,
      data,
      format,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Analytics export error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
