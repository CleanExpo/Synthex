/**
 * Health Check Cron — POST /api/cron/health-check
 *
 * Runs every 5 minutes. Checks DB + Redis health and fires a Slack alert
 * via AlertManager if either service is unhealthy.
 *
 * Vercel Cron: "* /5 * * * *" (every 5 minutes)
 * Auth: Bearer CRON_SECRET header required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/prisma';
import { healthCheck as redisHealthCheck } from '@/lib/redis-unified';
import { alertManager, AlertSeverity } from '@/lib/alerts';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'HEALTH_CHECK');
  if (!auth.ok) return auth.response;

  const results: { db: string; redis: string; alerts: string[] } = {
    db: 'ok',
    redis: 'ok',
    alerts: [],
  };

  // Check DB
  try {
    const dbHealth = await checkDatabaseHealth();
    if (!dbHealth.healthy) {
      results.db = dbHealth.error ?? 'unhealthy';
      await alertManager.critical(
        'Database Unhealthy',
        `DB health check failed: ${dbHealth.error ?? 'unknown error'} (latency: ${dbHealth.latency}ms)`,
        'cron/health-check'
      );
      results.alerts.push('db-alert-sent');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.db = `error: ${msg}`;
    await alertManager
      .critical(
        'Database Health Check Error',
        `Could not run DB health check: ${msg}`,
        'cron/health-check'
      )
      .catch(() => {});
    results.alerts.push('db-error-alert-sent');
  }

  // Check Redis
  try {
    const redisHealth = await redisHealthCheck();
    if (!redisHealth.healthy) {
      results.redis = 'unhealthy';
      await alertManager.error(
        'Redis Unhealthy',
        `Redis health check failed. Implementation: ${redisHealth.implementation ?? 'unknown'}`,
        'cron/health-check'
      );
      results.alerts.push('redis-alert-sent');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.redis = `error: ${msg}`;
    await alertManager
      .error(
        'Redis Health Check Error',
        `Could not run Redis health check: ${msg}`,
        'cron/health-check'
      )
      .catch(() => {});
    results.alerts.push('redis-error-alert-sent');
  }

  const allHealthy = results.db === 'ok' && results.redis === 'ok';
  logger.info(`[health-check cron] db=${results.db} redis=${results.redis}`);

  return NextResponse.json(
    {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      ...results,
    },
    { status: allHealthy ? 200 : 207 }
  );
}
