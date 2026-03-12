/**
 * Readiness Probe Endpoint
 * Used by load balancers to check if the service is ready to accept traffic
 *
 * @task UNI-438 - Implement Load Balancer Health Checks
 *
 * This endpoint checks:
 * - Database connectivity
 * - Redis/cache connectivity
 * - Critical environment variables
 * - External service dependencies
 *
 * Response codes:
 * - 200: Service is ready to accept traffic
 * - 503: Service is not ready (dependencies unavailable)
 *
 * Used by:
 * - Kubernetes readinessProbe
 * - AWS ALB/NLB health checks
 * - Vercel edge network
 * - Custom load balancers
 */

import { NextResponse } from 'next/server';
import { prisma, checkDatabaseHealth } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const runtime = 'nodejs';

// Configuration
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds
const LATENCY_WARNING_THRESHOLD = 1000; // 1 second
const LATENCY_CRITICAL_THRESHOLD = 3000; // 3 seconds

interface DependencyCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  critical: boolean;
}

/**
 * Check database readiness
 */
async function checkDatabase(): Promise<DependencyCheck> {
  const startTime = Date.now();

  try {
    const result = await Promise.race([
      checkDatabaseHealth(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database check timeout')), HEALTH_CHECK_TIMEOUT)
      ),
    ]);

    const latency = Date.now() - startTime;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (!result.healthy) {
      status = 'unhealthy';
    } else if (latency > LATENCY_CRITICAL_THRESHOLD) {
      status = 'degraded';
    } else if (latency > LATENCY_WARNING_THRESHOLD) {
      status = 'degraded';
    }

    return {
      name: 'database',
      status,
      latency,
      message: result.healthy ? 'Connected' : result.error,
      critical: true,
    };
  } catch (error: unknown) {
    return {
      name: 'database',
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : String(error) || 'Connection failed',
      critical: true,
    };
  }
}

/**
 * Check Redis/cache readiness
 */
async function checkCache(): Promise<DependencyCheck> {
  const startTime = Date.now();

  try {
    // Dynamic import to avoid issues if Redis is not configured
    const { getRedisClient } = await import('@/lib/redis-client');
    const redis = getRedisClient();

    const health = await Promise.race([
      redis.healthCheck(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Cache check timeout')), HEALTH_CHECK_TIMEOUT)
      ),
    ]);

    const latency = health.latency || (Date.now() - startTime);
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (!health.connected) {
      // Memory fallback is acceptable, so degraded not unhealthy
      status = health.mode === 'memory' ? 'degraded' : 'unhealthy';
    } else if (latency > LATENCY_WARNING_THRESHOLD) {
      status = 'degraded';
    }

    return {
      name: 'cache',
      status,
      latency,
      message: `Mode: ${health.mode}`,
      critical: false, // Cache has memory fallback
    };
  } catch (error: unknown) {
    return {
      name: 'cache',
      status: 'degraded',
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : String(error) || 'Cache unavailable, using memory fallback',
      critical: false,
    };
  }
}

/**
 * Check environment variables
 */
function checkEnvironment(): DependencyCheck {
  const criticalVars = ['DATABASE_URL', 'JWT_SECRET'];

  const importantVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'OPENROUTER_API_KEY',
  ];

  const missingCritical = criticalVars.filter((v) => !process.env[v]);
  const missingImportant = importantVars.filter((v) => !process.env[v]);

  if (missingCritical.length > 0) {
    return {
      name: 'environment',
      status: 'unhealthy',
      message: `Missing critical: ${missingCritical.join(', ')}`,
      critical: true,
    };
  }

  if (missingImportant.length > 0) {
    return {
      name: 'environment',
      status: 'degraded',
      message: `Missing: ${missingImportant.join(', ')}`,
      critical: false,
    };
  }

  return {
    name: 'environment',
    status: 'healthy',
    message: 'All variables configured',
    critical: true,
  };
}

/**
 * Check memory usage
 */
function checkMemory(): DependencyCheck {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (usagePercent > 95) {
    status = 'unhealthy';
  } else if (usagePercent > 80) {
    status = 'degraded';
  }

  return {
    name: 'memory',
    status,
    message: `${heapUsedMB}MB / ${heapTotalMB}MB (${Math.round(usagePercent)}%)`,
    critical: false,
  };
}

export async function GET() {
  const startTime = Date.now();

  try {
    // Run all checks in parallel
    const [database, cache, environment, memory] = await Promise.all([
      checkDatabase(),
      checkCache(),
      Promise.resolve(checkEnvironment()),
      Promise.resolve(checkMemory()),
    ]);

    const checks: DependencyCheck[] = [database, cache, environment, memory];

    // Determine overall status
    const hasCriticalFailure = checks.some(
      (c) => c.critical && c.status === 'unhealthy'
    );
    const hasDegraded = checks.some((c) => c.status === 'degraded');
    const hasUnhealthy = checks.some((c) => c.status === 'unhealthy');

    let overallStatus: 'ready' | 'degraded' | 'not_ready' = 'ready';
    let statusCode = 200;

    if (hasCriticalFailure) {
      overallStatus = 'not_ready';
      statusCode = 503;
    } else if (hasUnhealthy || hasDegraded) {
      overallStatus = 'degraded';
      statusCode = 200; // Still accept traffic but signal degradation
    }

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      checks: checks.reduce(
        (acc, check) => {
          acc[check.name] = {
            status: check.status,
            latency: check.latency,
            message: check.message,
          };
          return acc;
        },
        {} as Record<string, unknown>
      ),
      summary: {
        healthy: checks.filter((c) => c.status === 'healthy').length,
        degraded: checks.filter((c) => c.status === 'degraded').length,
        unhealthy: checks.filter((c) => c.status === 'unhealthy').length,
        total: checks.length,
      },
    };

    return NextResponse.json(response, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Content-Type': 'application/json',
        'X-Health-Check': 'readiness',
        'X-Health-Status': overallStatus,
      },
    });
  } catch (error: unknown) {
    logger.error('Readiness check error:', error);

    return NextResponse.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error) || 'Health check failed',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Content-Type': 'application/json',
          'X-Health-Check': 'readiness',
          'X-Health-Status': 'not_ready',
        },
      }
    );
  }
}

// HEAD request for minimal overhead checks
export async function HEAD() {
  try {
    // Quick database ping only for HEAD requests
    const result = await Promise.race([
      checkDatabaseHealth(),
      new Promise<{ healthy: boolean }>((resolve) =>
        setTimeout(() => resolve({ healthy: false }), 2000)
      ),
    ]);

    return new NextResponse(null, {
      status: result.healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'X-Health-Check': 'readiness',
        'X-Health-Status': result.healthy ? 'ready' : 'not_ready',
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'X-Health-Check': 'readiness',
        'X-Health-Status': 'not_ready',
      },
    });
  }
}
