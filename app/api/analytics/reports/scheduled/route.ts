/**
 * Scheduled Reports API
 *
 * @description API endpoints for scheduled report management:
 * - POST: Create a scheduled report
 * - GET: List scheduled reports
 * - DELETE: Cancel a scheduled report
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns error responses on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';

// Lazy getter to avoid module load crash
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET required');
  return secret;
}

// Helper to extract user ID from request
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token =
    request.cookies.get('auth-token')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJWTSecret()) as {
      sub?: string;
      userId?: string;
      id?: string;
    };
    return decoded.sub || decoded.userId || decoded.id || null;
  } catch {
    return null;
  }
}

// Validation schemas
const ScheduleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format'),
  dayOfWeek: z.number().min(0).max(6).optional(), // 0=Sunday, 6=Saturday
  dayOfMonth: z.number().min(1).max(28).optional(),
  timezone: z.string().default('UTC'),
});

const ReportConfigSchema = z.object({
  type: z.enum(['overview', 'engagement', 'content', 'audience', 'campaigns', 'growth', 'custom']).default('overview'),
  name: z.string().min(1).max(200),
  metrics: z.array(z.string()).default(['impressions', 'engagements', 'clicks']),
  dimensions: z.array(z.string()).default(['date']),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  platforms: z.array(z.string()).optional(),
  campaigns: z.array(z.string()).optional(),
});

const CreateScheduledReportSchema = z.object({
  config: ReportConfigSchema,
  schedule: ScheduleSchema,
  recipients: z.array(z.string().email()).min(1, 'At least one recipient is required'),
  format: z.enum(['csv', 'pdf', 'json']).default('csv'),
});

// ============================================================================
// POST - Create Scheduled Report
// ============================================================================

export async function POST(request: NextRequest) {
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

    // Get user ID
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const parseResult = CreateScheduledReportSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { config, schedule, recipients, format } = parseResult.data;

    // Calculate next run time
    const nextRun = calculateNextRun(schedule);

    // Create scheduled report in database
    const report = await prisma.report.create({
      data: {
        userId,
        name: config.name,
        type: 'scheduled',
        status: 'pending',
        format,
        filters: {
          config,
          schedule,
          recipients,
          isActive: true,
          lastRun: null,
          nextRun: nextRun.toISOString(),
        },
        dateRange: {
          // Dynamic range - will be calculated at report execution time
          type: schedule.frequency,
        },
      },
    });

    // Audit log
    await auditLogger.log({
      userId,
      action: 'analytics.scheduled_report_created',
      resource: 'scheduled_report',
      resourceId: report.id,
      category: 'analytics',
      severity: 'low',
      outcome: 'success',
      details: {
        name: config.name,
        frequency: schedule.frequency,
        recipients: recipients.length,
        format,
      },
    });

    logger.info('Scheduled report created', {
      id: report.id,
      name: config.name,
      userId,
      frequency: schedule.frequency,
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        scheduledReport: {
          id: report.id,
          name: config.name,
          schedule,
          nextRun: nextRun.toISOString(),
          recipients: recipients.length,
          format,
          isActive: true,
        },
      },
      { status: 201, cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to create scheduled report', { error });
    return ResponseOptimizer.createErrorResponse('Failed to create scheduled report', 500);
  }
}

// ============================================================================
// GET - List Scheduled Reports
// ============================================================================

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

    // Get user ID
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      userId,
      type: 'scheduled',
    };

    // Get total count
    const total = await prisma.report.count({ where: whereClause });

    // Get scheduled reports from database
    const reports = await prisma.report.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        format: true,
        status: true,
        filters: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    // Transform reports to scheduled report format
    const scheduledReports = reports
      .map((report) => {
        const filters = (report.filters as any) || {};
        const isActive = filters.isActive !== false;

        // Filter by active status if requested
        if (activeOnly && !isActive) {
          return null;
        }

        return {
          id: report.id,
          name: report.name,
          frequency: filters.schedule?.frequency || 'unknown',
          nextRun: filters.nextRun || null,
          lastRun: filters.lastRun || null,
          recipients: filters.recipients?.length || 0,
          format: report.format,
          isActive,
          createdAt: report.createdAt,
        };
      })
      .filter(Boolean);

    await auditLogger.log({
      userId,
      action: 'analytics.scheduled_reports_viewed',
      resource: 'scheduled_report',
      resourceId: userId,
      category: 'analytics',
      severity: 'low',
      outcome: 'success',
      details: { count: scheduledReports.length },
    });

    return ResponseOptimizer.createResponse(
      {
        data: scheduledReports,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      { cacheType: 'api', cacheDuration: 60 }
    );
  } catch (error) {
    logger.error('Failed to list scheduled reports', { error });
    return ResponseOptimizer.createErrorResponse('Failed to list scheduled reports', 500);
  }
}

// ============================================================================
// DELETE - Cancel Scheduled Report
// ============================================================================

export async function DELETE(request: NextRequest) {
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

    // Get user ID
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      );
    }

    // Find the report
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        userId,
        type: 'scheduled',
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      );
    }

    // Deactivate the scheduled report (soft delete)
    const filters = (report.filters as any) || {};
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'cancelled',
        filters: {
          ...filters,
          isActive: false,
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    await auditLogger.log({
      userId,
      action: 'analytics.scheduled_report_cancelled',
      resource: 'scheduled_report',
      resourceId: reportId,
      category: 'analytics',
      severity: 'medium',
      outcome: 'success',
      details: { name: report.name },
    });

    logger.info('Scheduled report cancelled', {
      id: reportId,
      userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Scheduled report cancelled',
    });
  } catch (error) {
    logger.error('Failed to cancel scheduled report', { error });
    return ResponseOptimizer.createErrorResponse('Failed to cancel scheduled report', 500);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateNextRun(schedule: z.infer<typeof ScheduleSchema>): Date {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);

  // Start with today at the specified time
  const nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

  // If that time has passed today, move to next occurrence
  if (nextRun <= now) {
    switch (schedule.frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        // Move to next week on the specified day
        const targetDay = schedule.dayOfWeek ?? 1; // Default Monday
        const daysUntilTarget = (targetDay - nextRun.getDay() + 7) % 7 || 7;
        nextRun.setDate(nextRun.getDate() + daysUntilTarget);
        break;
      case 'monthly':
        // Move to next month on the specified day
        const targetDayOfMonth = schedule.dayOfMonth ?? 1;
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(Math.min(targetDayOfMonth, getDaysInMonth(nextRun)));
        break;
    }
  } else {
    // Adjust for weekly/monthly if needed
    switch (schedule.frequency) {
      case 'weekly':
        const targetDay = schedule.dayOfWeek ?? 1;
        if (nextRun.getDay() !== targetDay) {
          const daysUntilTarget = (targetDay - nextRun.getDay() + 7) % 7;
          nextRun.setDate(nextRun.getDate() + daysUntilTarget);
        }
        break;
      case 'monthly':
        const targetDayOfMonth = schedule.dayOfMonth ?? 1;
        if (nextRun.getDate() !== targetDayOfMonth) {
          if (nextRun.getDate() > targetDayOfMonth) {
            nextRun.setMonth(nextRun.getMonth() + 1);
          }
          nextRun.setDate(Math.min(targetDayOfMonth, getDaysInMonth(nextRun)));
        }
        break;
    }
  }

  return nextRun;
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

// Node.js runtime required
export const runtime = 'nodejs';
