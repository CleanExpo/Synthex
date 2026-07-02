/**
 * Auto-Research Loop Health (SYN-1025)
 *
 * Operational proof layer for the research loop: verifies Redis/BullMQ
 * connectivity, the registered queue, required provider tokens, Obsidian
 * writeback availability, and the latest run — classifying each as ok/warn/fail.
 * Never exposes secret VALUES (only presence + status detail).
 *
 * @module lib/auto-research/health
 */

import { prisma } from '@/lib/prisma';
import { getQueueStats } from '@/lib/queue/bull-queue';
import {
  isEnabled as obsidianEnabled,
  writeNote,
  readNote,
} from '@/lib/obsidian/client';
// redis-unified is JS: exports `healthCheck()` → { status: 'healthy'|'degraded', implementation }
import { healthCheck as redisHealthCheck } from '@/lib/redis-unified';

export type HealthLevel = 'ok' | 'warn' | 'fail';

export interface HealthCheckResult {
  status: HealthLevel;
  detail: string;
  [key: string]: unknown;
}

export interface ResearchLoopHealth {
  /** Worst level across all component checks. */
  status: HealthLevel;
  checks: {
    redis: HealthCheckResult;
    queue: HealthCheckResult;
    apifyToken: HealthCheckResult;
    aiProvider: HealthCheckResult;
    obsidian: HealthCheckResult;
    lastRun: HealthCheckResult;
  };
  /** True when a recent run produced insights AND Obsidian writeback is enabled. */
  feedingSecondBrain: boolean;
  checkedAt: string;
}

const RESEARCH_QUEUE = 'auto-research';

export function worstLevel(levels: HealthLevel[]): HealthLevel {
  if (levels.includes('fail')) return 'fail';
  if (levels.includes('warn')) return 'warn';
  return 'ok';
}

async function checkRedis(): Promise<HealthCheckResult> {
  try {
    const h = (await redisHealthCheck()) as {
      status?: string;
      implementation?: string;
    };
    if (h?.status === 'healthy') {
      return { status: 'ok', detail: `redis ${h.implementation ?? 'connected'}` };
    }
    return {
      status: 'warn',
      detail: `redis degraded (${h?.implementation ?? 'unknown'})`,
    };
  } catch {
    return { status: 'fail', detail: 'redis unreachable' };
  }
}

async function checkQueue(): Promise<HealthCheckResult> {
  try {
    const stats = await getQueueStats(RESEARCH_QUEUE);
    return {
      status: 'ok',
      detail: 'auto-research queue reachable',
      waiting: stats.waiting,
      active: stats.active,
      failed: stats.failed,
    };
  } catch {
    return {
      status: 'fail',
      detail: 'auto-research queue unreachable (Redis/BullMQ down)',
    };
  }
}

function checkApifyToken(): HealthCheckResult {
  return process.env.APIFY_API_TOKEN
    ? { status: 'ok', detail: 'apify token present' }
    : {
        status: 'warn',
        detail: 'APIFY_API_TOKEN missing — scraping will not run',
      };
}

function checkAiProvider(): HealthCheckResult {
  const configured = !!(
    process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY
  );
  return configured
    ? { status: 'ok', detail: 'AI provider configured' }
    : {
        status: 'fail',
        detail: 'no AI provider key — analysis step will fail',
      };
}

function checkObsidian(): HealthCheckResult {
  return obsidianEnabled()
    ? { status: 'ok', detail: 'obsidian writeback enabled' }
    : {
        status: 'warn',
        detail: 'obsidian disabled — insights not written to 2nd brain',
      };
}

async function checkLastRun(orgId?: string): Promise<HealthCheckResult> {
  try {
    const where = orgId
      ? { OR: [{ organizationId: orgId }, { organizationId: null }] }
      : {};
    const run = await prisma.autoResearchRun.findFirst({
      where,
      orderBy: { startedAt: 'desc' },
      select: {
        runType: true,
        status: true,
        completedAt: true,
        insightsCount: true,
        error: true,
      },
    });
    if (!run) {
      return { status: 'warn', detail: 'no research runs yet', runStatus: null };
    }
    if (run.status === 'failed') {
      return {
        status: 'fail',
        detail: `last run failed: ${run.error ?? 'unknown error'}`,
        runStatus: 'failed',
        runType: run.runType,
      };
    }
    if (run.status === 'running') {
      return {
        status: 'ok',
        detail: 'a run is in progress',
        runStatus: 'running',
        runType: run.runType,
      };
    }
    return {
      status: 'ok',
      detail: `last run completed with ${run.insightsCount} insight(s)`,
      runStatus: 'completed',
      runType: run.runType,
      completedAt: run.completedAt,
      insightsCount: run.insightsCount,
    };
  } catch {
    return { status: 'fail', detail: 'could not read run history (DB error)' };
  }
}

/**
 * Snapshot the research loop's operational health. Org-scoped when orgId is
 * supplied (falls back to global + the org's own runs for "last run").
 */
export async function getResearchLoopHealth(
  orgId?: string
): Promise<ResearchLoopHealth> {
  const [redis, queue, lastRun] = await Promise.all([
    checkRedis(),
    checkQueue(),
    checkLastRun(orgId),
  ]);
  const apifyToken = checkApifyToken();
  const aiProvider = checkAiProvider();
  const obsidian = checkObsidian();

  const checks = { redis, queue, apifyToken, aiProvider, obsidian, lastRun };
  const status = worstLevel(Object.values(checks).map(c => c.status));

  const feedingSecondBrain =
    obsidian.status === 'ok' &&
    lastRun.runStatus === 'completed' &&
    typeof lastRun.insightsCount === 'number' &&
    lastRun.insightsCount > 0;

  return {
    status,
    checks,
    feedingSecondBrain,
    checkedAt: new Date().toISOString(),
  };
}

/** Dedicated, bounded health-check note — never touches real insights.md. */
function healthNotePath(orgId: string): string {
  return `Clients/${orgId}/_research-health-check.md`;
}

/**
 * Dry-run proof that Obsidian writeback works end-to-end for one org, without
 * real scraping and without polluting the client's insights file: writes a
 * bounded synthetic line to a dedicated health note and reads it back.
 */
export async function verifyObsidianWriteback(
  orgId: string
): Promise<HealthCheckResult> {
  if (!orgId) {
    return { status: 'fail', detail: 'no org context for writeback check' };
  }
  if (!obsidianEnabled()) {
    return {
      status: 'warn',
      detail: 'obsidian disabled — writeback not verified',
    };
  }
  try {
    const token = `health-check ${new Date().toISOString()}`;
    await writeNote(
      healthNotePath(orgId),
      `# Research loop writeback check\n\n${token}\n`
    );
    const readBack = await readNote(healthNotePath(orgId));
    return readBack.includes(token)
      ? { status: 'ok', detail: 'obsidian writeback round-trip ok' }
      : { status: 'fail', detail: 'writeback wrote but read-back mismatched' };
  } catch {
    return { status: 'fail', detail: 'obsidian writeback failed' };
  }
}
