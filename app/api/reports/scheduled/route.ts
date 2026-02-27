/**
 * Scheduled Reports API Route
 *
 * @description Manages scheduled report configurations:
 * - GET: List scheduled reports
 * - POST: Create scheduled report
 * - PATCH: Update schedule
 * - DELETE: Delete/deactivate schedule
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * FAILURE MODE: Returns 500 on database errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Scheduled report where clause */
interface ScheduledReportWhereClause {
  userId: string;
  isActive?: boolean;
  frequency?: string;
}

/** Scheduled report record */
interface ScheduledReportRecord {
  id: string;
  userId: string;
  frequency: string;
  schedule: unknown;
  nextRunAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Extended Prisma client with scheduled report model */
interface ExtendedPrismaClient {
  scheduledReport?: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<ScheduledReportRecord | null>;
    findMany: (args: { where: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; skip?: number; include?: Record<string, unknown> }) => Promise<ScheduledReportRecord[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<ScheduledReportRecord>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<ScheduledReportRecord>;
    delete: (args: { where: { id: string } }) => Promise<void>;
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
}

/** Get prisma with extended models */
const extendedPrisma = prisma as unknown as typeof prisma & ExtendedPrismaClient;

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const scheduleSchema = z.object({
  dayOfWeek: z.number().min(0).max(6).optional(), // 0 = Sunday
  dayOfMonth: z.number().min(1).max(31).optional(),
  hour: z.number().min(0).max(23),
  minute: z.number().min(0).max(59),
  timezone: z.string().default('UTC'),
});

const createScheduledReportSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  templateId: z.string().optional(),
  reportType: z.enum(['overview', 'engagement', 'content', 'audience', 'campaigns', 'growth', 'custom']),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly']),
  schedule: scheduleSchema,
  format: z.enum(['pdf', 'csv', 'json']).default('pdf'),
  dateRangeType: z.enum(['last_period', 'custom', 'rolling_7d', 'rolling_30d', 'rolling_90d']).default('last_period'),
  filters: z.record(z.unknown()).optional(),
  metrics: z.array(z.string()).min(1),
  recipients: z.array(z.string().email()).min(1),
  webhookUrl: z.string().url().optional(),
});

const updateScheduledReportSchema = createScheduledReportSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate the next run time based on frequency and schedule
 */
function calculateNextRun(
  frequency: string,
  schedule: { dayOfWeek?: number; dayOfMonth?: number; hour: number; minute: number; timezone: string },
  fromDate: Date = new Date()
): Date {
  const now = fromDate;
  const next = new Date(now);

  // Set the time
  next.setHours(schedule.hour, schedule.minute, 0, 0);

  switch (frequency) {
    case 'daily':
      // If the time has passed today, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case 'weekly':
      // Find the next occurrence of the specified day
      const targetDay = schedule.dayOfWeek ?? 1; // Default to Monday
      const currentDay = next.getDay();
      let daysUntilTarget = targetDay - currentDay;
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && next <= now)) {
        daysUntilTarget += 7;
      }
      next.setDate(next.getDate() + daysUntilTarget);
      break;

    case 'biweekly':
      // Every two weeks on the specified day
      const biweeklyDay = schedule.dayOfWeek ?? 1;
      const currDay = next.getDay();
      let daysDiff = biweeklyDay - currDay;
      if (daysDiff < 0 || (daysDiff === 0 && next <= now)) {
        daysDiff += 14;
      }
      next.setDate(next.getDate() + daysDiff);
      break;

    case 'monthly':
      // On the specified day of the month
      const targetDate = schedule.dayOfMonth ?? 1;
      next.setDate(targetDate);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      // Handle months with fewer days
      if (next.getDate() !== targetDate) {
        next.setDate(0); // Last day of previous month
      }
      break;

    case 'quarterly':
      // First day of next quarter
      const currentQuarter = Math.floor(next.getMonth() / 3);
      const nextQuarterMonth = (currentQuarter + 1) * 3;
      next.setMonth(nextQuarterMonth, schedule.dayOfMonth ?? 1);
      if (next <= now) {
        next.setMonth(next.getMonth() + 3);
      }
      break;
  }

  return next;
}

// ============================================================================
// GET /api/reports/scheduled
// List scheduled reports
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
        401
      );
    }

    const userId = security.context.userId!;
    const { searchParams } = new URL(request.url);

    const activeOnly = searchParams.get('activeOnly') === 'true';
    const frequency = searchParams.get('frequency');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    const where: ScheduledReportWhereClause = { userId };

    if (activeOnly) {
      where.isActive = true;
    }

    if (frequency) {
      where.frequency = frequency;
    }

    const [scheduledReports, total] = await Promise.all([
      extendedPrisma.scheduledReport?.findMany({
        where,
        orderBy: { nextRunAt: 'asc' },
        take: limit,
        skip: offset,
        include: {
          template: {
            select: { id: true, name: true, category: true },
          },
        },
      }) || [],
      extendedPrisma.scheduledReport?.count({ where }) || 0,
    ]);

    return NextResponse.json({
      scheduledReports: scheduledReports || [],
      total: total || 0,
      hasMore: (scheduledReports?.length || 0) === limit,
    });
  } catch (error) {
    console.error('Get scheduled reports error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled reports' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/reports/scheduled
// Create a scheduled report
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
        401
      );
    }

    const userId = security.context.userId!;
    const body = await request.json();

    // Validate input
    const validation = createScheduledReportSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, email: true },
    });

    // Calculate next run time
    const nextRunAt = calculateNextRun(data.frequency, data.schedule);

    // Create scheduled report
    const scheduledReport = await extendedPrisma.scheduledReport?.create({
      data: {
        userId,
        organizationId: user?.organizationId,
        name: data.name,
        description: data.description,
        templateId: data.templateId,
        reportType: data.reportType,
        frequency: data.frequency,
        schedule: data.schedule,
        format: data.format,
        dateRangeType: data.dateRangeType,
        filters: data.filters,
        metrics: data.metrics,
        recipients: data.recipients,
        webhookUrl: data.webhookUrl,
        isActive: true,
        nextRunAt,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'report.scheduled.create',
        resource: 'scheduled_report',
        resourceId: scheduledReport?.id,
        category: 'data',
        outcome: 'success',
        details: {
          name: data.name,
          frequency: data.frequency,
          recipientCount: data.recipients.length,
        },
      },
    });

    return NextResponse.json({
      scheduledReport,
      nextRunAt,
      created: true,
    });
  } catch (error) {
    console.error('Create scheduled report error:', error);
    return NextResponse.json(
      { error: 'Failed to create scheduled report' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/reports/scheduled
// Update a scheduled report
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('id');

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateScheduledReportSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    // IDOR FIX: Verify ownership using findFirst with both id AND userId
    // Previously used findUnique(id) then checked userId separately, which
    // returned 403 and leaked resource existence
    const existing = await extendedPrisma.scheduledReport?.findFirst({
      where: { id: scheduleId, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      );
    }

    const data = validation.data;

    // Recalculate next run if schedule changed
    let nextRunAt = existing.nextRunAt;
    if (data.frequency || data.schedule) {
      const frequency = data.frequency || existing.frequency;
      const schedule = data.schedule || (existing.schedule as { hour: number; minute: number; timezone: string; dayOfWeek?: number; dayOfMonth?: number });
      nextRunAt = calculateNextRun(frequency, schedule);
    }

    // Update
    const scheduledReport = await extendedPrisma.scheduledReport?.update({
      where: { id: scheduleId },
      data: {
        ...data,
        nextRunAt,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      scheduledReport,
      nextRunAt,
      updated: true,
    });
  } catch (error) {
    console.error('Update scheduled report error:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled report' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/reports/scheduled
// Delete a scheduled report
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
        401
      );
    }

    const userId = security.context.userId!;
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('id');

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    // IDOR FIX: Verify ownership using findFirst with both id AND userId
    // Previously used findUnique(id) then checked userId separately, which
    // returned 403 and leaked resource existence
    const existing = await extendedPrisma.scheduledReport?.findFirst({
      where: { id: scheduleId, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      );
    }

    // Delete
    await extendedPrisma.scheduledReport?.delete({
      where: { id: scheduleId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'report.scheduled.delete',
        resource: 'scheduled_report',
        resourceId: scheduleId,
        category: 'data',
        outcome: 'success',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Scheduled report deleted successfully',
    });
  } catch (error) {
    console.error('Delete scheduled report error:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled report' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
