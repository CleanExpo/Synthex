/**
 * Scheduled Report Execution API Route
 *
 * @description Endpoint for executing scheduled reports (called by cron/scheduler):
 * - POST: Execute due scheduled reports
 * - GET: Check execution status
 *
 * This endpoint is designed to be called by:
 * 1. Vercel Cron Jobs (recommended)
 * 2. External scheduler (e.g., cron-job.org)
 * 3. Manual trigger for testing
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - CRON_SECRET: Secret for authenticating cron requests (CRITICAL)
 * - RESEND_API_KEY: Email delivery (for Resend)
 * - SENDGRID_API_KEY: Email delivery (for SendGrid)
 *
 * FAILURE MODE: Returns 500 on execution errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

interface ExecutionResult {
  scheduleId: string;
  reportId?: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  deliveries?: number;
}

/** Report filters configuration */
interface ReportFilters {
  platforms?: string[];
  campaigns?: string[];
  dateRange?: { start: string; end: string };
  [key: string]: unknown;
}

/** Schedule time configuration */
interface ScheduleTime {
  hour: number;
  minute: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

/** Generated report data structure */
interface ReportData {
  summary: Record<string, number>;
  byPlatform: Record<string, Record<string, number>>;
  byDay: Array<{ date: string; metrics: Record<string, number> }>;
  dateRange: { start: string; end: string };
  generatedAt: string;
}

/** Scheduled report record */
interface ScheduledReportRecord {
  id: string;
  userId: string;
  organizationId: string | null;
  name: string;
  reportType: string;
  frequency: string;
  schedule: ScheduleTime;
  dateRangeType: string;
  metrics: string[];
  filters: ReportFilters;
  format: string;
  recipients: string[];
  webhookUrl: string | null;
  isActive: boolean;
  nextRunAt: Date;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  failureCount: number;
}

/** Extended prisma client for scheduled reports */
interface PrismaWithScheduledReports {
  scheduledReport?: {
    findMany: (args: Record<string, unknown>) => Promise<ScheduledReportRecord[]>;
    update: (args: Record<string, unknown>) => Promise<ScheduledReportRecord>;
    count: (args?: Record<string, unknown>) => Promise<number>;
  };
  reportDelivery?: {
    create: (args: Record<string, unknown>) => Promise<unknown>;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Verify cron authentication
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // If no secret configured, allow in development
  if (!cronSecret && process.env.NODE_ENV === 'development') {
    return true;
  }

  if (!cronSecret) {
    logger.warn('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Calculate date range based on type and frequency
 */
function calculateDateRange(
  dateRangeType: string,
  frequency: string
): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (dateRangeType) {
    case 'rolling_7d':
      start.setDate(start.getDate() - 7);
      break;
    case 'rolling_30d':
      start.setDate(start.getDate() - 30);
      break;
    case 'rolling_90d':
      start.setDate(start.getDate() - 90);
      break;
    case 'last_period':
    default:
      // Based on frequency
      switch (frequency) {
        case 'daily':
          start.setDate(start.getDate() - 1);
          break;
        case 'weekly':
          start.setDate(start.getDate() - 7);
          break;
        case 'biweekly':
          start.setDate(start.getDate() - 14);
          break;
        case 'monthly':
          start.setMonth(start.getMonth() - 1);
          break;
        case 'quarterly':
          start.setMonth(start.getMonth() - 3);
          break;
      }
  }

  return { start, end };
}

/**
 * Generate report data (simplified - integrate with actual analytics)
 */
async function generateReportData(
  userId: string,
  _reportType: string,
  metrics: string[],
  filters: ReportFilters | null,
  dateRange: { start: Date; end: Date }
): Promise<ReportData> {
  // Fetch analytics events for the user
  const analyticsEvents = await prisma.analyticsEvent.findMany({
    where: {
      userId,
      timestamp: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      ...(filters?.platforms && { platform: { in: filters.platforms } }),
    },
    orderBy: { timestamp: 'asc' },
  });

  // Aggregate data from events
  const aggregated: Record<string, number> = {};
  const byPlatform: Record<string, Record<string, number>> = {};
  const byDay: { date: string; metrics: Record<string, number> }[] = [];

  // Initialize metrics
  for (const key of metrics) {
    aggregated[key] = 0;
  }

  for (const event of analyticsEvents) {
    const platform = event.platform || 'unknown';
    if (!byPlatform[platform]) {
      byPlatform[platform] = {};
      for (const key of metrics) {
        byPlatform[platform][key] = 0;
      }
    }

    // Count events by type mapping to metrics
    const eventMetricMap: Record<string, string> = {
      'page_view': 'impressions',
      'engagement': 'engagements',
      'click': 'clicks',
      'share': 'shares',
      'like': 'likes',
      'comment': 'comments',
      'follow': 'followers',
      'conversion': 'conversions',
    };

    const metricKey = eventMetricMap[event.type] || event.type;
    if (metrics.includes(metricKey)) {
      aggregated[metricKey] = (aggregated[metricKey] || 0) + 1;
      byPlatform[platform][metricKey] = (byPlatform[platform][metricKey] || 0) + 1;
    }
  }

  // Group by day
  const dayMap = new Map<string, Record<string, number>>();
  for (const event of analyticsEvents) {
    const day = event.timestamp.toISOString().split('T')[0];
    if (!dayMap.has(day)) {
      dayMap.set(day, {});
      for (const key of metrics) {
        dayMap.get(day)![key] = 0;
      }
    }
    const dayData = dayMap.get(day)!;
    const eventMetricMap: Record<string, string> = {
      'page_view': 'impressions',
      'engagement': 'engagements',
      'click': 'clicks',
      'share': 'shares',
      'like': 'likes',
      'comment': 'comments',
    };
    const metricKey = eventMetricMap[event.type] || event.type;
    if (metrics.includes(metricKey)) {
      dayData[metricKey] = (dayData[metricKey] || 0) + 1;
    }
  }

  for (const [date, metricsData] of dayMap) {
    byDay.push({ date, metrics: metricsData });
  }

  return {
    summary: aggregated,
    byPlatform,
    byDay: byDay.sort((a, b) => a.date.localeCompare(b.date)),
    dateRange: {
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Send report via email
 */
async function sendReportEmail(
  recipients: string[],
  reportName: string,
  reportData: ReportData,
  format: string
): Promise<number> {
  let sentCount = 0;

  // Try Resend first
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);

      for (const recipient of recipients) {
        try {
          await resend.emails.send({
            from: process.env.EMAIL_FROM || 'reports@synthex.social',
            to: recipient,
            subject: `${reportName} - ${new Date().toLocaleDateString()}`,
            html: generateEmailHtml(reportName, reportData),
            attachments: format !== 'json' ? undefined : [
              {
                filename: `${reportName.replace(/\s+/g, '_')}.json`,
                content: Buffer.from(JSON.stringify(reportData, null, 2)).toString('base64'),
              },
            ],
          });
          sentCount++;
        } catch (err) {
          logger.error(`Failed to send to ${recipient}:`, err);
        }
      }
      return sentCount;
    } catch (err) {
      logger.error('Resend error:', err);
    }
  }

  // Fallback to SendGrid
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey) {
    try {
      const sgMail = await import('@sendgrid/mail');
      sgMail.default.setApiKey(sendgridKey);

      for (const recipient of recipients) {
        try {
          await sgMail.default.send({
            from: process.env.EMAIL_FROM || 'reports@synthex.social',
            to: recipient,
            subject: `${reportName} - ${new Date().toLocaleDateString()}`,
            html: generateEmailHtml(reportName, reportData),
          });
          sentCount++;
        } catch (err) {
          logger.error(`Failed to send to ${recipient}:`, err);
        }
      }
      return sentCount;
    } catch (err) {
      logger.error('SendGrid error:', err);
    }
  }

  logger.warn('No email provider configured');
  return 0;
}

/**
 * Generate email HTML
 */
function generateEmailHtml(reportName: string, data: ReportData): string {
  const summary = data.summary || {};
  const metricsHtml = Object.entries(summary)
    .map(([key, value]) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #333;">${key.replace(/_/g, ' ').toUpperCase()}</td>
        <td style="padding: 12px; border-bottom: 1px solid #333; text-align: right; font-weight: bold;">${Number(value).toLocaleString()}</td>
      </tr>
    `)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; margin: 0; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #00d4ff; margin: 0 0 10px;">${reportName}</h1>
          <p style="color: #888; margin: 0;">Generated on ${new Date().toLocaleDateString()}</p>
        </div>

        <div style="background: #1a1a1a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #fff; margin: 0 0 20px; font-size: 18px;">Summary</h2>
          <table style="width: 100%; border-collapse: collapse; color: #ccc;">
            ${metricsHtml}
          </table>
        </div>

        <div style="background: linear-gradient(135deg, #00d4ff20, #06b6d420); border-radius: 12px; padding: 24px; text-align: center;">
          <p style="margin: 0 0 15px; color: #ccc;">View detailed analytics in your dashboard</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social'}/dashboard/reports"
             style="display: inline-block; background: linear-gradient(135deg, #00d4ff, #06b6d4); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold;">
            Open Dashboard
          </a>
        </div>

        <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
          <p>You're receiving this because you scheduled this report.</p>
          <p>© ${new Date().getFullYear()} Synthex. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send webhook notification
 */
async function sendWebhook(
  webhookUrl: string,
  reportName: string,
  reportData: ReportData,
  reportId: string
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Synthex-Event': 'report.generated',
      },
      body: JSON.stringify({
        event: 'report.generated',
        reportId,
        reportName,
        generatedAt: new Date().toISOString(),
        data: reportData,
      }),
    });

    return response.ok;
  } catch (err) {
    logger.error('Webhook delivery failed:', err);
    return false;
  }
}

/**
 * Calculate next run time
 */
function calculateNextRun(
  frequency: string,
  schedule: ScheduleTime,
  fromDate: Date = new Date()
): Date {
  const next = new Date(fromDate);
  next.setHours(schedule.hour, schedule.minute, 0, 0);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
  }

  return next;
}

// ============================================================================
// POST /api/reports/scheduled/execute
// Execute due scheduled reports
// ============================================================================

export async function POST(request: NextRequest) {
  // Verify authentication
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const results: ExecutionResult[] = [];
  const now = new Date();

  try {
    // Find all due scheduled reports
    const dueReports = await (prisma as unknown as PrismaWithScheduledReports).scheduledReport?.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      take: 50, // Process in batches
    }) || [];

    for (const scheduled of dueReports) {
      const result: ExecutionResult = {
        scheduleId: scheduled.id,
        status: 'failed',
      };

      try {
        // Calculate date range
        const dateRange = calculateDateRange(
          scheduled.dateRangeType,
          scheduled.frequency
        );

        // Generate report data
        const reportData = await generateReportData(
          scheduled.userId,
          scheduled.reportType,
          scheduled.metrics,
          scheduled.filters,
          dateRange
        );

        // Create report record
        const report = await prisma.report.create({
          data: {
            userId: scheduled.userId,
            organizationId: scheduled.organizationId,
            name: `${scheduled.name} - ${now.toLocaleDateString()}`,
            type: scheduled.reportType,
            status: 'completed',
            format: scheduled.format,
            dateRange: {
              start: dateRange.start.toISOString(),
              end: dateRange.end.toISOString(),
            },
            filters: scheduled.filters as unknown as undefined,
            data: reportData as unknown as undefined,
            generatedAt: now,
            expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        });

        result.reportId = report.id;

        // Send to recipients
        let deliveryCount = 0;
        if (scheduled.recipients?.length > 0) {
          deliveryCount = await sendReportEmail(
            scheduled.recipients,
            scheduled.name,
            reportData,
            scheduled.format
          );

          // Log deliveries
          for (const recipient of scheduled.recipients) {
            await (prisma as unknown as PrismaWithScheduledReports).reportDelivery?.create({
              data: {
                reportId: report.id,
                scheduledReportId: scheduled.id,
                deliveryType: 'email',
                recipient,
                status: deliveryCount > 0 ? 'sent' : 'failed',
                sentAt: deliveryCount > 0 ? now : null,
              },
            });
          }
        }

        // Send webhook if configured
        if (scheduled.webhookUrl) {
          const webhookSuccess = await sendWebhook(
            scheduled.webhookUrl,
            scheduled.name,
            reportData,
            report.id
          );

          await (prisma as unknown as PrismaWithScheduledReports).reportDelivery?.create({
            data: {
              reportId: report.id,
              scheduledReportId: scheduled.id,
              deliveryType: 'webhook',
              recipient: scheduled.webhookUrl,
              status: webhookSuccess ? 'delivered' : 'failed',
              deliveredAt: webhookSuccess ? now : null,
            },
          });

          if (webhookSuccess) deliveryCount++;
        }

        // Update scheduled report
        const nextRunAt = calculateNextRun(
          scheduled.frequency,
          scheduled.schedule,
          now
        );

        await (prisma as unknown as PrismaWithScheduledReports).scheduledReport?.update({
          where: { id: scheduled.id },
          data: {
            lastRunAt: now,
            lastRunStatus: 'success',
            lastReportId: report.id,
            nextRunAt,
            runCount: { increment: 1 },
          },
        });

        result.status = 'success';
        result.deliveries = deliveryCount;
      } catch (err) {
        logger.error(`Failed to execute scheduled report ${scheduled.id}:`, err);

        // Update failure count
        await (prisma as unknown as PrismaWithScheduledReports).scheduledReport?.update({
          where: { id: scheduled.id },
          data: {
            lastRunAt: now,
            lastRunStatus: 'failed',
            failureCount: { increment: 1 },
            // Deactivate after 5 consecutive failures
            ...(scheduled.failureCount >= 4 && { isActive: false }),
          },
        });

        result.status = 'failed';
        result.error = (err as Error).message;
      }

      results.push(result);
    }

    return NextResponse.json({
      executed: results.length,
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    logger.error('Scheduled report execution error:', error);
    return NextResponse.json(
      { error: 'Execution failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/reports/scheduled/execute
// Check execution status (for monitoring)
// ============================================================================

export async function GET(request: NextRequest) {
  // Verify authentication
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const now = new Date();

    // Get counts
    const [total, active, due, recentlyRun, failed] = await Promise.all([
      (prisma as unknown as PrismaWithScheduledReports).scheduledReport?.count() || 0,
      (prisma as unknown as PrismaWithScheduledReports).scheduledReport?.count({ where: { isActive: true } }) || 0,
      (prisma as unknown as PrismaWithScheduledReports).scheduledReport?.count({
        where: { isActive: true, nextRunAt: { lte: now } },
      }) || 0,
      (prisma as unknown as PrismaWithScheduledReports).scheduledReport?.count({
        where: {
          lastRunAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      }) || 0,
      (prisma as unknown as PrismaWithScheduledReports).scheduledReport?.count({
        where: { lastRunStatus: 'failed', failureCount: { gte: 3 } },
      }) || 0,
    ]);

    return NextResponse.json({
      status: 'healthy',
      stats: {
        total,
        active,
        due,
        recentlyRun,
        failedReports: failed,
      },
      timestamp: now.toISOString(),
    });
  } catch (error) {
    logger.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Status check failed' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for email libraries
export const runtime = 'nodejs';
