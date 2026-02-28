/**
 * Health Dashboard API
 * Comprehensive system health and status endpoint
 *
 * @task UNI-423 - Monitoring & Observability Epic
 *
 * Endpoints:
 *   GET /api/monitoring/health-dashboard              - Full health report
 *   GET /api/monitoring/health-dashboard?view=quick   - Quick status check
 *   GET /api/monitoring/health-dashboard?view=errors  - Recent errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSystemHealth, getQuickHealth, getRecentErrors, getErrorStats } from '@/lib/observability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Timeout for health checks (generous for cold starts) */
const HEALTH_CHECK_TIMEOUT = 8000;

/**
 * Race a promise against a timeout. Returns the fallback on timeout
 * instead of throwing, so cold starts degrade gracefully.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallback), timeoutMs),
    ),
  ]);
}

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
        const health = await withTimeout(
          getQuickHealth(),
          HEALTH_CHECK_TIMEOUT,
          {
            status: 'degraded' as const,
            checks: { database: false, memory: true },
          },
        );

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
        const health = await withTimeout(
          getSystemHealth(),
          HEALTH_CHECK_TIMEOUT,
          {
            status: 'degraded' as const,
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            version: process.env.npm_package_version || '2.0.1',
            environment: process.env.NODE_ENV || 'development',
            components: [],
            metrics: {
              memory: { heapUsedMB: 0, heapTotalMB: 0, rssMB: 0, usagePercent: 0 },
              errors: { last5Minutes: 0, last1Hour: 0, bySeverity: {} },
              api: { requestsPerMinute: 0, averageResponseTime: 0, errorRate: 0 },
            },
            alerts: ['Health check timed out — possible cold start'],
          },
        );

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
  } catch (error: unknown) {
    console.error('Health dashboard error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error) || 'Failed to get health status',
        responseTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
