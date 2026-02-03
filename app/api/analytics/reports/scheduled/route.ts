/**
 * Scheduled Reports API
 *
 * @description API endpoints for scheduled report management:
 * - POST: Create a scheduled report
 * - GET: List scheduled reports
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns error responses on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import {
  ScheduledReportManager,
  type ReportConfig,
  type ReportSchedule,
  type ExportFormat,
} from '@/src/services/analytics/report-builder';
import { getCache } from '@/lib/cache/cache-manager';

// ============================================================================
// POST - Create Scheduled Report
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      config,
      schedule,
      recipients,
      format = 'csv',
      organizationId,
      userId,
    } = body;

    // Validate required fields
    if (!organizationId) {
      return ResponseOptimizer.createErrorResponse('Organization ID is required', 400);
    }

    if (!userId) {
      return ResponseOptimizer.createErrorResponse('User ID is required', 400);
    }

    if (!config) {
      return ResponseOptimizer.createErrorResponse('Report config is required', 400);
    }

    if (!schedule) {
      return ResponseOptimizer.createErrorResponse('Schedule is required', 400);
    }

    if (!recipients || recipients.length === 0) {
      return ResponseOptimizer.createErrorResponse('At least one recipient is required', 400);
    }

    // Validate schedule
    if (!['daily', 'weekly', 'monthly'].includes(schedule.frequency)) {
      return ResponseOptimizer.createErrorResponse('Invalid schedule frequency', 400);
    }

    if (!schedule.time || !/^\d{2}:\d{2}$/.test(schedule.time)) {
      return ResponseOptimizer.createErrorResponse('Invalid schedule time format (use HH:mm)', 400);
    }

    // Create scheduled report
    const scheduledReport = await ScheduledReportManager.create(
      organizationId,
      userId,
      config as ReportConfig,
      schedule as ReportSchedule,
      recipients,
      format as ExportFormat
    );

    logger.info('Scheduled report created', {
      id: scheduledReport.id,
      name: scheduledReport.name,
      organizationId,
      frequency: schedule.frequency,
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        scheduledReport: {
          id: scheduledReport.id,
          name: scheduledReport.name,
          schedule: scheduledReport.schedule,
          nextRun: scheduledReport.nextRun,
          recipients: scheduledReport.recipients.length,
          format: scheduledReport.format,
          isActive: scheduledReport.isActive,
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
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const activeOnly = searchParams.get('active') === 'true';

    if (!organizationId) {
      return ResponseOptimizer.createErrorResponse('Organization ID is required', 400);
    }

    // Get scheduled reports from cache (in production, this would be from DB)
    const cache = getCache();
    const cachePattern = `scheduled_report:*`;

    // For now, return an empty list structure
    // In production, this would query the database
    const scheduledReports: Array<{
      id: string;
      name: string;
      frequency: string;
      nextRun: Date | null;
      lastRun: Date | null;
      recipients: number;
      isActive: boolean;
    }> = [];

    return ResponseOptimizer.createResponse(
      {
        data: scheduledReports,
        pagination: {
          total: scheduledReports.length,
          page: 1,
          limit: 20,
        },
      },
      { cacheType: 'api', cacheDuration: 60 }
    );
  } catch (error) {
    logger.error('Failed to list scheduled reports', { error });
    return ResponseOptimizer.createErrorResponse('Failed to list scheduled reports', 500);
  }
}
