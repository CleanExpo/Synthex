/**
 * Database Health Check API
 *
 * @task UNI-436 - Database Connection Pooling
 *
 * GET /api/health/db - Check database connectivity and pool status
 */

import { NextResponse } from 'next/server';
import { checkDatabaseHealth, getPoolMetrics } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const revalidate = 0;

export async function GET() {
  const startTime = Date.now();

  try {
    // Perform health check
    const healthResult = await checkDatabaseHealth();
    const metrics = getPoolMetrics();

    const response = {
      status: healthResult.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: healthResult.healthy,
        latency: `${healthResult.latency}ms`,
        error: healthResult.error || null,
      },
      pool: {
        totalConnections: metrics.totalConnections,
        activeConnections: metrics.activeConnections,
        idleConnections: metrics.idleConnections,
        waitingRequests: metrics.waitingRequests,
        errors: metrics.errors,
        lastHealthCheck: metrics.lastHealthCheck?.toISOString() || null,
      },
      responseTime: `${Date.now() - startTime}ms`,
    };

    return NextResponse.json(response, {
      status: healthResult.healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          latency: null,
          error: errorMessage,
        },
        pool: null,
        responseTime: `${Date.now() - startTime}ms`,
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}

export const runtime = 'nodejs';
