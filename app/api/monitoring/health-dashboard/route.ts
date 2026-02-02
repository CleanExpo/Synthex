/**
 * Health Dashboard API
 * Comprehensive system health and status endpoint
 *
 * @task UNI-423 - Monitoring & Observability Epic
 *
 * Endpoints:
 *   GET /api/monitoring/health-dashboard         - Full health report
 *   GET /api/monitoring/health-dashboard?quick   - Quick status check
 *   GET /api/monitoring/health-dashboard?errors  - Recent errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSystemHealth, getQuickHealth, getRecentErrors, getErrorStats } from '@/lib/observability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/monitoring/health-dashboard
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'full';

    switch (view) {
      case 'quick': {
        const health = await getQuickHealth();
        return NextResponse.json(
          {
            success: true,
            ...health,
            responseTime: Date.now() - startTime,
          },
          {
            status: health.status === 'unhealthy' ? 503 : 200,
            headers: {
              'Cache-Control': 'no-store, max-age=0',
            },
          }
        );
      }

      case 'errors': {
        const count = parseInt(searchParams.get('count') || '50', 10);
        const severity = searchParams.get('severity') as any;
        const category = searchParams.get('category') as any;
        const sinceMinutes = parseInt(searchParams.get('since') || '60', 10);

        const errors = getRecentErrors(count, {
          severity,
          category,
          since: new Date(Date.now() - sinceMinutes * 60 * 1000),
        });

        const stats = getErrorStats(sinceMinutes);

        return NextResponse.json(
          {
            success: true,
            errors,
            stats,
            count: errors.length,
            period: `${sinceMinutes} minutes`,
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
        const health = await getSystemHealth();

        return NextResponse.json(
          {
            success: true,
            health,
            responseTime: Date.now() - startTime,
          },
          {
            status: health.status === 'unhealthy' ? 503 : 200,
            headers: {
              'Cache-Control': 'no-store, max-age=0',
              'X-Health-Status': health.status,
            },
          }
        );
      }
    }
  } catch (error: any) {
    console.error('Health dashboard error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get health status',
        responseTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
