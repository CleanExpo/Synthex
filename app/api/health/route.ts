/**
 * Comprehensive Health Check Endpoint
 * Main health check for SYNTHEX API
 *
 * @task UNI-438 - Implement Load Balancer Health Checks
 *
 * Available health check endpoints:
 * - GET /api/health       - Comprehensive health (this endpoint)
 * - GET /api/health/live  - Liveness probe (is process alive?)
 * - GET /api/health/ready - Readiness probe (can accept traffic?)
 * - GET /api/health/db    - Database-specific health
 * - GET /api/health/redis - Redis/cache health
 * - GET /api/health/scaling - Scaling metrics
 *
 * Load Balancer Configuration:
 * - AWS ALB: Use /api/health/ready with 200 success codes
 * - Kubernetes: livenessProbe=/api/health/live, readinessProbe=/api/health/ready
 * - Vercel: Automatic edge health checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { testConnection } from '@/lib/supabase-client';
import { checkDatabaseHealth, getPoolMetrics } from '@/lib/prisma';
import { EnvValidator } from '@/lib/security/env-validator';

// Force dynamic rendering - prevent static generation
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Track server start time
const serverStartTime = Date.now();

// Version info
const VERSION = process.env.npm_package_version || '2.0.1';
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Check database health with timeout
 */
async function checkDatabase(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const result = await Promise.race([
      checkDatabaseHealth(),
      new Promise<{ healthy: false; error: string }>((resolve) =>
        setTimeout(() => resolve({ healthy: false, error: 'Timeout' }), 5000)
      ),
    ]);

    const latency = Date.now() - startTime;

    return {
      status: result.healthy ? (latency > 1000 ? 'degraded' : 'healthy') : 'unhealthy',
      latency,
      message: result.healthy ? 'Connected' : result.error || 'Connection failed',
      details: {
        pool: getPoolMetrics(),
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Check cache health
 */
async function checkCache(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const { getRedisClient } = await import('@/lib/redis-client');
    const redis = getRedisClient();
    const health = await redis.healthCheck();

    return {
      status: health.connected ? 'healthy' : (health.mode === 'memory' ? 'degraded' : 'unhealthy'),
      latency: health.latency || (Date.now() - startTime),
      message: `Mode: ${health.mode}`,
      details: {
        mode: health.mode,
        nodes: health.nodes,
      },
    };
  } catch (error) {
    return {
      status: 'degraded',
      latency: Date.now() - startTime,
      message: 'Using memory fallback',
    };
  }
}

/**
 * Check environment configuration using canonical EnvValidator.
 * Reports counts only -- never exposes env var names or values.
 */
function checkEnvironment(): HealthCheckResult {
  const validator = EnvValidator.getInstance();
  const result = validator.validate(false);

  const { totalRequired, totalOptional, missingRequired, configured } = result.summary;
  const missingRequiredCount = missingRequired.length;
  const configuredCount = configured.length;
  const totalDefined = totalRequired + totalOptional;

  if (missingRequiredCount > 0) {
    return {
      status: 'unhealthy',
      message: `${missingRequiredCount} required var(s) missing`,
      details: {
        totalDefined,
        totalRequired,
        configured: configuredCount,
        missingRequired: missingRequiredCount,
        errors: result.errors.length,
        warnings: result.warnings.length,
      },
    };
  }

  if (result.warnings.length > 0) {
    return {
      status: 'degraded',
      message: `${result.warnings.length} optional var(s) not configured`,
      details: {
        totalDefined,
        totalRequired,
        configured: configuredCount,
        missingRequired: 0,
        errors: 0,
        warnings: result.warnings.length,
      },
    };
  }

  return {
    status: 'healthy',
    message: 'All configured',
    details: {
      totalDefined,
      totalRequired,
      configured: configuredCount,
      missingRequired: 0,
      errors: 0,
      warnings: 0,
    },
  };
}

/**
 * Check system resources
 */
function checkResources(): HealthCheckResult {
  const mem = process.memoryUsage();
  const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;

  return {
    status: heapPercent > 90 ? 'unhealthy' : heapPercent > 75 ? 'degraded' : 'healthy',
    message: `Heap: ${Math.round(heapPercent)}%`,
    details: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
      externalMB: Math.round(mem.external / 1024 / 1024),
    },
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check if this is a simple ping (for load balancers that just need 200)
    const { searchParams } = new URL(request.url);
    const simple = searchParams.get('simple') === 'true';

    if (simple) {
      // Ultra-lightweight response for frequent polling
      return NextResponse.json(
        { status: 'ok', timestamp: new Date().toISOString() },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'X-Health-Check': 'simple',
          },
        }
      );
    }

    // Run all health checks in parallel
    const [database, cache, environment, resources] = await Promise.all([
      checkDatabase(),
      checkCache(),
      Promise.resolve(checkEnvironment()),
      Promise.resolve(checkResources()),
    ]);

    const checks = { database, cache, environment, resources };

    // Determine overall status
    const statuses = Object.values(checks).map((c) => c.status);
    const hasUnhealthy = statuses.includes('unhealthy');
    const hasDegraded = statuses.includes('degraded');

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (hasUnhealthy) overallStatus = 'unhealthy';
    else if (hasDegraded) overallStatus = 'degraded';

    // Build response
    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: VERSION,
      buildId: BUILD_ID,
      environment: process.env.NODE_ENV || 'development',
      region: process.env.VERCEL_REGION || 'local',
      uptime: Math.floor((Date.now() - serverStartTime) / 1000),
      responseTime: Date.now() - startTime,
      checks: Object.fromEntries(
        Object.entries(checks).map(([key, value]) => [
          key,
          {
            status: value.status,
            latency: value.latency,
            message: value.message,
            ...(searchParams.get('details') === 'true' && value.details
              ? { details: value.details }
              : {}),
          },
        ])
      ),
      endpoints: {
        live: '/api/health/live',
        ready: '/api/health/ready',
        database: '/api/health/db',
        redis: '/api/health/redis',
        scaling: '/api/health/scaling',
      },
    };

    // Determine HTTP status code
    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

    return NextResponse.json(response, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'X-Health-Status': overallStatus,
        'X-Response-Time': `${Date.now() - startTime}ms`,
      },
    });
  } catch (error) {
    console.error('Health check error:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: VERSION,
        buildId: BUILD_ID,
        environment: process.env.NODE_ENV || 'development',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'X-Health-Status': 'unhealthy',
        },
      }
    );
  }
}

// HEAD request for minimal overhead health checks
export async function HEAD() {
  try {
    const result = await Promise.race([
      checkDatabaseHealth(),
      new Promise<{ healthy: boolean }>((resolve) =>
        setTimeout(() => resolve({ healthy: false }), 2000)
      ),
    ]);

    return new NextResponse(null, {
      status: result.healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Health-Status': result.healthy ? 'healthy' : 'unhealthy',
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Health-Status': 'unhealthy',
      },
    });
  }
}