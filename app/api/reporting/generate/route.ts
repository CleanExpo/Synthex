/**
 * Report Generation API - Generate Endpoint
 *
 * Create new reports with PDF, CSV, or JSON export
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { reportGenerator } from '@/lib/reports/report-generator';
import { z } from 'zod';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const GenerateRequestSchema = z.object({
  name: z.string().min(1, 'Report name is required').max(200),
  type: z.enum(['campaign', 'analytics', 'ab-test', 'psychology', 'comprehensive']),
  format: z.enum(['pdf', 'csv', 'json']).default('pdf'),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  filters: z.object({
    campaignIds: z.array(z.string()).optional(),
    platforms: z.array(z.string()).optional(),
    metrics: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * POST /api/reporting/generate
 * Generate a new report
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = GenerateRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const result = await reportGenerator.generateReport(userId, validation.data);

    return NextResponse.json({
      success: true,
      data: {
        reportId: result.reportId,
        status: result.status,
        message: 'Report generation started. Check status at /api/reporting/reports/{reportId}',
      },
    }, { status: 202 });
  } catch (error) {
    logger.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reporting/generate
 * Get available report types and options
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      reportTypes: [
        {
          id: 'campaign',
          name: 'Campaign Report',
          description: 'Campaign performance metrics and insights',
        },
        {
          id: 'analytics',
          name: 'Analytics Report',
          description: 'Event tracking and user behavior analytics',
        },
        {
          id: 'ab-test',
          name: 'A/B Testing Report',
          description: 'A/B test results and statistical analysis',
        },
        {
          id: 'psychology',
          name: 'Psychology Report',
          description: 'Psychology principle effectiveness metrics',
        },
        {
          id: 'comprehensive',
          name: 'Comprehensive Report',
          description: 'Full platform analysis across all metrics',
        },
      ],
      formats: ['pdf', 'csv', 'json'],
      features: [
        'Automated data aggregation',
        'Custom date range selection',
        'Platform and campaign filtering',
        'PDF export with charts',
        'CSV export for spreadsheet analysis',
        'JSON export for API integration',
      ],
    },
  });
}
