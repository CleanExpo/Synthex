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
      message: 'Database connection failed',
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
    // Use the same unified Redis service as /api/health/redis so readiness
    // reports the actual production cache backend (Redis Cloud on Vercel),
    // not the legacy Upstash-only wrapper's memory fallback.
    const { healthCheck, getImplementationType } = await import('@/lib/redis-unified');

    const health = await Promise.race([
      healthCheck(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Cache check timeout')), HEALTH_CHECK_TIMEOUT)
      ),
    ]);

    const latency = Date.now() - startTime;
    const implementation = await getImplementationType();
    let status = health.status;

    if (status === 'healthy' && latency > LATENCY_WARNING_THRESHOLD) {
      status = 'degraded';
    }

    return {
      name: 'cache',
      status,
      latency,
      message: `Implementation: ${implementation}; connection: ${health.connection}`,
      critical: false, // Cache has memory fallback
    };
  } catch (error: unknown) {
    return {
      name: 'cache',
      status: 'degraded',
      latency: Date.now() - startTime,
      message: 'Cache unavailable, using memory fallback',
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
  ];

  const missingCritical = criticalVars.filter((v) => !process.env[v]);
  const missingImportant = importantVars.filter((v) => !process.env[v]);

  // AI provider key: Synthex is OpenAI-only by default, but any supported
  // provider key satisfies the AI dependency. Only degrade when none is set.
  const hasAIProviderKey = !!(
    process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY
  );
  if (!hasAIProviderKey) {
    missingImportant.push('OPENAI_API_KEY');
  }

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
 * Check memory usage.
 *
 * Match the main /api/health resource semantics: V8 heap ratio is noisy in
 * serverless/local runtimes because heapTotal grows lazily. Only RSS against a
 * reported function memory limit should affect readiness. When no limit is
 * reported (local dev), surface the RSS for observability but keep the memory
 * check healthy.
 */
function checkMemory(): DependencyCheck {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);
  const limitMB = Number(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE) || 0;
  const rssPercent = limitMB > 0 ? (rssMB / limitMB) * 100 : 0;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (limitMB > 0) {
    if (rssPercent >= 95) {
      status = 'unhealthy';
    } else if (rssPercent >= 80) {
      status = 'degraded';
    }
  }

  return {
    name: 'memory',
    status,
    message:
      limitMB > 0
        ? `RSS: ${rssMB}MB / ${limitMB}MB (${Math.round(rssPercent)}%); heap ${heapUsedMB}MB / ${heapTotalMB}MB (${Math.round(heapPercent)}%)`
        : `RSS: ${rssMB}MB (no limit reported); heap ${heapUsedMB}MB / ${heapTotalMB}MB (${Math.round(heapPercent)}%)`,
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
        error: 'Health check failed',
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
