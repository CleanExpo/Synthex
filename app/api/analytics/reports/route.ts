/**
 * Analytics Reports API
 *
 * @description API endpoints for report generation and management:
 * - POST: Generate a new report
 * - GET: List available reports and presets
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns cached data on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import {
  ReportBuilder,
  ReportExporter,
  PRESET_REPORTS,
  type ReportConfig,
  type MetricType,
  type TimeGranularity,
  type ExportFormat,
} from '@/src/services/analytics/report-builder';

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

// Validation schema for report generation
const GenerateReportSchema = z.object({
  type: z.enum(['overview', 'engagement', 'content', 'audience', 'campaigns', 'growth', 'custom']).default('overview'),
  name: z.string().min(1).max(200).default('Custom Report'),
  metrics: z.array(z.string()).default(['impressions', 'engagements', 'clicks']),
  dimensions: z.array(z.string()).default(['date']),
  granularity: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']).default('day'),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
  platforms: z.array(z.string()).optional(),
  campaigns: z.array(z.string()).optional(),
  compareWith: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  limit: z.number().positive().optional(),
  sortBy: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
  exportFormat: z.enum(['json', 'csv', 'pdf']).optional(),
  organizationId: z.string().optional(), // Optional now, will use userId if not provided
});

// ============================================================================
// POST - Generate Report
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

    const parseResult = GenerateReportSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const {
      type,
      name,
      metrics,
      dimensions,
      granularity,
      dateRange,
      platforms,
      campaigns,
      compareWith,
      limit,
      sortBy,
      exportFormat,
      organizationId,
    } = parseResult.data;

    // Use organizationId if provided, otherwise use userId
    const effectiveOrgId = organizationId || userId;

    // Build report
    const builder = new ReportBuilder(effectiveOrgId)
      .type(type)
      .name(name)
      .metrics(metrics as MetricType[])
      .dimensions(dimensions)
      .granularity(granularity as TimeGranularity)
      .dateRange(new Date(dateRange.start), new Date(dateRange.end));

    // Apply optional filters
    if (platforms?.length) {
      builder.platforms(platforms);
    }
    if (campaigns?.length) {
      builder.campaigns(campaigns);
    }
    if (compareWith?.start && compareWith?.end) {
      builder.compareWith(new Date(compareWith.start), new Date(compareWith.end));
    }
    if (limit) {
      builder.limit(limit);
    }
    if (sortBy?.field) {
      builder.sortBy(sortBy.field, sortBy.direction || 'desc');
    }

    // Execute report
    const report = await builder.execute();

    // Export if format specified
    if (exportFormat && ['json', 'csv', 'pdf'].includes(exportFormat)) {
      const exported = await ReportExporter.export(report, exportFormat as ExportFormat);

      // Convert Buffer to Uint8Array if needed for response
      const content = Buffer.isBuffer(exported.content)
        ? new Uint8Array(exported.content)
        : exported.content;

      // Audit log export
      await auditLogger.log({
        userId,
        action: 'analytics.report_exported',
        resource: 'report',
        resourceId: report.id,
        category: 'api',
        severity: 'low',
        outcome: 'success',
        details: { type, exportFormat, rowCount: report.metadata.rowCount },
      });

      // Return file download response
      const response = new NextResponse(content, {
        headers: {
          'Content-Type': exported.mimeType,
          'Content-Disposition': `attachment; filename="${exported.filename}"`,
        },
      });

      return response;
    }

    // Audit log report generation
    await auditLogger.log({
      userId,
      action: 'analytics.report_generated',
      resource: 'report',
      resourceId: report.id,
      category: 'api',
      severity: 'low',
      outcome: 'success',
      details: {
        type,
        name,
        rowCount: report.metadata.rowCount,
        executionTime: report.metadata.executionTime,
      },
    });

    logger.info('Report generated', {
      reportId: report.id,
      type: report.config.type,
      userId,
      rowCount: report.metadata.rowCount,
      executionTime: report.metadata.executionTime,
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        report,
      },
      { cacheType: 'api', cacheDuration: 300 }
    );
  } catch (error) {
    logger.error('Failed to generate report', { error });
    return ResponseOptimizer.createErrorResponse('Failed to generate report', 500);
  }
}

// ============================================================================
// GET - List Reports and Presets
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

    // Get user ID for audit logging
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const preset = searchParams.get('preset');

    // If preset requested, return specific preset config
    if (preset) {
      const presetConfig = PRESET_REPORTS[preset];
      if (!presetConfig) {
        return ResponseOptimizer.createErrorResponse(`Preset "${preset}" not found`, 404);
      }

      await auditLogger.log({
        userId,
        action: 'analytics.preset_viewed',
        resource: 'report_preset',
        resourceId: preset,
        category: 'api',
        severity: 'low',
        outcome: 'success',
        details: { preset },
      });

      return ResponseOptimizer.createResponse(
        {
          preset,
          config: presetConfig,
        },
        { cacheType: 'api', cacheDuration: 3600 }
      );
    }

    // Return all presets and available options
    return ResponseOptimizer.createResponse(
      {
        presets: Object.entries(PRESET_REPORTS).map(([key, config]) => ({
          id: key,
          name: config.name,
          type: config.type,
          description: getPresetDescription(key),
        })),
        options: {
          types: ['overview', 'engagement', 'content', 'audience', 'campaigns', 'growth', 'custom'],
          metrics: [
            'impressions',
            'engagements',
            'likes',
            'comments',
            'shares',
            'clicks',
            'followers',
            'reach',
            'conversions',
            'revenue',
          ],
          granularities: ['hour', 'day', 'week', 'month', 'quarter', 'year'],
          exportFormats: ['json', 'csv', 'pdf'],
        },
      },
      { cacheType: 'api', cacheDuration: 3600 }
    );
  } catch (error) {
    logger.error('Failed to list reports', { error });
    return ResponseOptimizer.createErrorResponse('Failed to list reports', 500);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPresetDescription(preset: string): string {
  const descriptions: Record<string, string> = {
    weeklyOverview: 'A comprehensive overview of your weekly performance across all platforms',
    monthlyEngagement: 'Detailed engagement metrics broken down by day and platform',
    contentPerformance: 'Analyze how different content types perform',
    audienceGrowth: 'Track your audience growth and reach over time',
    campaignROI: 'Measure the return on investment for your campaigns',
  };
  return descriptions[preset] || 'Custom report preset';
}

// Node.js runtime required
export const runtime = 'nodejs';
