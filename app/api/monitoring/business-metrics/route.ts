/**
 * Business Metrics API
 * Aggregated business KPIs and analytics for the SYNTHEX platform
 *
 * @task UNI-425 - Implement Business Metrics Dashboard
 *
 * Endpoints:
 *   GET /api/monitoring/business-metrics              - Full business metrics report
 *   GET /api/monitoring/business-metrics?view=quick   - Quick summary metrics
 *   GET /api/monitoring/business-metrics?period=...   - Metrics for specific period
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBusinessMetrics,
  getQuickMetrics,
  BusinessMetricsPeriod,
} from '@/lib/metrics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_PERIODS = [
  'today',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'all_time',
];

/**
 * GET /api/monitoring/business-metrics
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'full';
    const periodParam = searchParams.get('period') || 'last_30_days';

    // Validate period parameter
    if (!VALID_PERIODS.includes(periodParam)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid period. Valid values: ${VALID_PERIODS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const period = periodParam as BusinessMetricsPeriod;

    switch (view) {
      case 'quick': {
        const metrics = await getQuickMetrics();
        return NextResponse.json(
          {
            success: true,
            metrics,
            responseTime: Date.now() - startTime,
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'no-store, max-age=0',
            },
          }
        );
      }

      case 'full':
      default: {
        const report = await getBusinessMetrics(period);

        return NextResponse.json(
          {
            success: true,
            report,
            responseTime: Date.now() - startTime,
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'no-store, max-age=0',
              'X-Metrics-Period': period,
            },
          }
        );
      }
    }
  } catch (error: any) {
    console.error('Business metrics error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get business metrics',
        responseTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
