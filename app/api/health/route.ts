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
import { getEnvStatus, type EnvStatus } from '@/lib/env-check';
import { logger } from '@/lib/logger';

// Force dynamic rendering - prevent static generation
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
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
      new Promise<{ healthy: false; error: string }>(resolve =>
        setTimeout(() => resolve({ healthy: false, error: 'Timeout' }), 5000)
      ),
    ]);

    const latency = Date.now() - startTime;

    // Threshold tuned for production reality (SYN-805): Synthex runs on
    // Vercel SFO and the Supabase project lives in ap-southeast-2 (Sydney).
    // Cross-region first-hit latency is consistently 1700-1900 ms because
    // the lambda is cold and the DB connection is bootstrapping. Warm
    // queries are 150-220 ms. The previous 1000 ms threshold reported
    // "degraded" on every cold start despite the system being healthy.
    // 2500 ms covers cold start with a 600 ms safety margin while still
    // catching real degradation (genuine DB problems push past 3 s).
    return {
      status: result.healthy
        ? latency > 2500
          ? 'degraded'
          : 'healthy'
        : 'unhealthy',
      latency,
      message: result.healthy
        ? 'Connected'
        : result.error || 'Connection failed',
      details: {
        pool: getPoolMetrics(),
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: 'Database connection failed',
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
    const health = await Promise.race([
      redis.healthCheck(),
      new Promise<{
        connected: false;
        mode: 'memory';
        latency: undefined;
        nodes: undefined;
      }>(resolve =>
        setTimeout(
          () =>
            resolve({
              connected: false,
              mode: 'memory',
              latency: undefined,
              nodes: undefined,
            }),
          3000
        )
      ),
    ]);

    return {
      status: health.connected
        ? 'healthy'
        : health.mode === 'memory'
          ? 'degraded'
          : 'unhealthy',
      latency: health.latency || Date.now() - startTime,
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

  const { totalRequired, totalOptional, missingRequired, configured } =
    result.summary;
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
    // SYN-805: Optional vars being unset is — by definition — acceptable,
    // so it must not flip the overall env check to "degraded". The previous
    // behaviour caused the entire /api/health response to report status
    // "degraded" in production solely because integrations like Twilio /
    // Slack webhooks / per-feature CRON_SECRETs were not configured,
    // making the health check useless as a real-vs-noise signal. Now we
    // stay "healthy" but surface the count + warnings so observers can
    // still see which optional integrations are inactive.
    return {
      status: 'healthy',
      message: `${result.warnings.length} optional var(s) not configured (acceptable)`,
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
 * Check system resources.
 *
 * On Vercel serverless, `heapUsed/heapTotal` is NOT a reliable saturation
 * signal — V8 grows `heapTotal` lazily, so a 90%+ ratio just means V8
 * hasn't expanded yet, not that we're out of memory. The meaningful
 * metric is `rss` against the Lambda function memory limit.
 *
 * Behaviour (post-2026-04-29 — overnight smoke loop showed the previous
 * heap-ratio threshold was triggering false 503s on every /api/health
 * call when V8 hadn't grown the heap):
 *   - rss >= 95 % of function memory limit  → 'unhealthy' (real OOM risk)
 *   - rss >= 80 % of function memory limit  → 'degraded' (warn)
 *   - otherwise                              → 'healthy'
 *
 * If the function-memory limit is unknown (local dev), fall back to
 * 'healthy' regardless of heap ratio — the heap ratio is reported in
 * `details` for observability but never drives the status code.
 */
function checkResources(): HealthCheckResult {
  const mem = process.memoryUsage();
  const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;
  const rssMB = mem.rss / 1024 / 1024;

  // Vercel exposes function memory limit via AWS_LAMBDA_FUNCTION_MEMORY_SIZE (MB).
  const limitMB = Number(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE) || 0;
  const rssPercent = limitMB > 0 ? (rssMB / limitMB) * 100 : 0;

  let status: HealthCheckResult['status'] = 'healthy';
  if (limitMB > 0) {
    if (rssPercent >= 95) status = 'unhealthy';
    else if (rssPercent >= 80) status = 'degraded';
  }

  return {
    status,
    message:
      limitMB > 0
        ? `RSS: ${Math.round(rssMB)}MB / ${limitMB}MB (${Math.round(rssPercent)}%)`
        : `RSS: ${Math.round(rssMB)}MB (no limit reported)`,
    details: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      heapPercent: Math.round(heapPercent),
      rssMB: Math.round(rssMB),
      externalMB: Math.round(mem.external / 1024 / 1024),
      limitMB: limitMB || null,
      rssPercent: limitMB > 0 ? Math.round(rssPercent) : null,
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
      const envStatus: EnvStatus = getEnvStatus();
      return NextResponse.json(
        {
          status: 'ok',
          timestamp: new Date().toISOString(),
          env: {
            required: envStatus.required,
            warnings: envStatus.warnings,
          },
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'X-Health-Check': 'simple',
          },
        }
      );
    }

    // Snapshot env-check status before parallel checks (sync, no await needed)
    const envStatus: EnvStatus = getEnvStatus();

    // Run all health checks in parallel
    const [database, cache, environment, resources] = await Promise.all([
      checkDatabase(),
      checkCache(),
      Promise.resolve(checkEnvironment()),
      Promise.resolve(checkResources()),
    ]);

    const checks = { database, cache, environment, resources };

    // Determine overall status
    const statuses = Object.values(checks).map(c => c.status);
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
      env: {
        required: envStatus.required,
        warnings: envStatus.warnings,
      },
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
    logger.error('Health check error:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: VERSION,
        buildId: BUILD_ID,
        environment: process.env.NODE_ENV || 'development',
        responseTime: Date.now() - startTime,
        error: 'Health check failed',
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
      new Promise<{ healthy: boolean }>(resolve =>
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
