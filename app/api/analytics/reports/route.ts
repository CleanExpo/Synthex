/**
 * Analytics Reports API
 *
 * @description API endpoints for report generation and management:
 * - POST: Generate a new report
 * - GET: List available reports and presets
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns cached data on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import {
  ReportBuilder,
  ReportExporter,
  PRESET_REPORTS,
  type ReportConfig,
  type MetricType,
  type TimeGranularity,
  type ExportFormat,
} from '@/src/services/analytics/report-builder';

// ============================================================================
// POST - Generate Report
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type = 'overview',
      name = 'Custom Report',
      metrics = ['impressions', 'engagements', 'clicks'],
      dimensions = ['date'],
      granularity = 'day',
      dateRange,
      platforms,
      campaigns,
      compareWith,
      limit,
      sortBy,
      exportFormat,
      organizationId,
    } = body;

    // Validate required fields
    if (!organizationId) {
      return ResponseOptimizer.createErrorResponse('Organization ID is required', 400);
    }

    if (!dateRange?.start || !dateRange?.end) {
      return ResponseOptimizer.createErrorResponse('Date range is required', 400);
    }

    // Build report
    const builder = new ReportBuilder(organizationId)
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

      // Return file download response
      const response = new NextResponse(content, {
        headers: {
          'Content-Type': exported.mimeType,
          'Content-Disposition': `attachment; filename="${exported.filename}"`,
        },
      });

      return response;
    }

    logger.info('Report generated', {
      reportId: report.id,
      type: report.config.type,
      organizationId,
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
    const { searchParams } = new URL(request.url);
    const preset = searchParams.get('preset');

    // If preset requested, return specific preset config
    if (preset) {
      const presetConfig = PRESET_REPORTS[preset];
      if (!presetConfig) {
        return ResponseOptimizer.createErrorResponse(`Preset "${preset}" not found`, 404);
      }

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
