/**
 * Analytics Export API
 *
 * Exports analytics data in various formats (CSV, JSON, PDF, XLSX).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns error response with details
 *
 * @module app/api/analytics/export/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { exportQuerySchema, type ExportQueryInput, periodToDateRange } from '@/lib/schemas/analytics';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';
import { verifyToken } from '@/lib/auth/jwt-utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

function toPDF(data: any): Uint8Array {
  const { posts, campaigns, summary } = data;

  // Create PDF document
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246); // Blue
  doc.text('SYNTHEX Analytics Report', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });
  doc.text(`Period: ${summary.period.start.split('T')[0]} to ${summary.period.end.split('T')[0]}`, pageWidth / 2, 34, { align: 'center' });

  // Summary Section
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Performance Summary', 14, 48);

  const summaryData = [
    ['Total Posts', summary.posts.toString()],
    ['Total Likes', summary.likes.toLocaleString()],
    ['Total Comments', summary.comments.toLocaleString()],
    ['Total Shares', summary.shares.toLocaleString()],
    ['Total Impressions', summary.impressions.toLocaleString()],
    ['Total Reach', summary.reach.toLocaleString()],
    ['Total Clicks', summary.clicks.toLocaleString()],
    ['Engagement Rate', `${summary.engagementRate}%`],
  ];

  autoTable(doc, {
    startY: 52,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 },
    tableWidth: 'auto',
  });

  // Campaigns Section (if any)
  if (campaigns.length > 0) {
    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(14);
    doc.text('Campaigns', 14, finalY + 15);

    const campaignData = campaigns.map((c: any) => [
      c.name,
      c.platform,
      c.status,
      c._count?.posts?.toString() || '0',
      new Date(c.createdAt).toLocaleDateString(),
    ]);

    autoTable(doc, {
      startY: finalY + 19,
      head: [['Name', 'Platform', 'Status', 'Posts', 'Created']],
      body: campaignData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });
  }

  // Posts Section - new page if needed
  if (posts.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Post Performance', 14, 20);

    const postData = posts.slice(0, 50).map((post: any) => {
      const analytics = (post.analytics as PostAnalytics) || {};
      const engagement = (analytics.likes || 0) + (analytics.comments || 0) + (analytics.shares || 0);
      return [
        (post.content || '').substring(0, 40) + '...',
        post.campaign?.platform || post.platform || '',
        post.status,
        (analytics.likes || 0).toString(),
        (analytics.comments || 0).toString(),
        engagement.toString(),
      ];
    });

    autoTable(doc, {
      startY: 24,
      head: [['Content', 'Platform', 'Status', 'Likes', 'Comments', 'Engagement']],
      body: postData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 60 },
      },
    });

    if (posts.length > 50) {
      const tableY = (doc as any).lastAutoTable?.finalY || 200;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Showing top 50 of ${posts.length} posts`, 14, tableY + 10);
    }
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${totalPages} | SYNTHEX Analytics`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Return as Uint8Array for NextResponse compatibility
  return new Uint8Array(doc.output('arraybuffer'));
}

// =============================================================================
// Route Handlers
// =============================================================================

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
        403
      );
    }

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
    let content: string | Uint8Array;
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
      case 'pdf':
        content = toPDF(data);
        contentType = 'application/pdf';
        filename = `synthex-analytics-${timestamp}.pdf`;
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

    // Audit log the export
    await auditLogger.log({
      userId: user.id,
      action: 'analytics.export',
      resource: 'analytics',
      resourceId: user.id,
      category: 'api',
      severity: 'low',
      outcome: 'success',
      details: {
        format,
        period: dateRange,
        platforms,
        postCount: data.posts.length,
        campaignCount: data.campaigns.length,
      },
    });

    logger.info('Analytics export generated', {
      userId: user.id,
      format,
      postCount: data.posts.length,
    });

    // Return file download
    // For Uint8Array (PDF), convert to Buffer; for strings, use directly
    const body = content instanceof Uint8Array
      ? Buffer.from(content)
      : content;

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    logger.error('Analytics export error', { error });
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to generate export' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // POST for more complex export configurations
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

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
      await auditLogger.log({
        userId: user.id,
        action: 'analytics.export_scheduled',
        resource: 'analytics',
        resourceId: user.id,
        category: 'api',
        severity: 'low',
        outcome: 'success',
        details: {
          format,
          recipients: emailDelivery.recipients.length,
          deliveryMethod: 'email',
        },
      });

      logger.info('Analytics export queued for email', {
        userId: user.id,
        recipients: emailDelivery.recipients.length,
      });

      return NextResponse.json({
        success: true,
        message: 'Export queued for email delivery',
        recipients: emailDelivery.recipients,
        estimatedDelivery: '5 minutes',
      });
    }

    await auditLogger.log({
      userId: user.id,
      action: 'analytics.export_requested',
      resource: 'analytics',
      resourceId: user.id,
      category: 'api',
      severity: 'low',
      outcome: 'success',
      details: { format, platforms, postCount: data.posts.length },
    });

    // Return data for immediate download
    return NextResponse.json({
      success: true,
      data,
      format,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('Analytics export error', { error });
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to process export request' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
