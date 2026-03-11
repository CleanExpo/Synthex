/**
 * Algorithm Sentinel — Main Orchestrator
 *
 * Runs a full sentinel check for a given user:
 * 1. Seed algorithm updates to DB
 * 2. Resolve user's site URL from their profile
 * 3. Check site health via GSC + PSI
 * 4. Run alert engine comparing current vs previous snapshot
 * 5. Return a summary of what was done
 *
 * Called by:
 * - /api/cron/sentinel (scheduled)
 * - /api/sentinel/check (manual trigger)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { seedAlgorithmUpdates, getRecentUpdates } from './algorithm-feed';
import { checkSiteHealth, getLatestSnapshot } from './health-checker';
import { runAlertEngine } from './alert-engine';

export interface SentinelCheckResult {
  userId: string;
  orgId: string;
  siteUrl: string | null;
  healthScore: number | null;
  alertsCreated: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Resolve the site URL to monitor for a user.
 * Priority: user.website → organization.website → null
 */
async function resolveSiteUrl(userId: string, orgId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { website: true },
  });

  if (user?.website) return user.website;

  if (orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { website: true },
    });
    if (org?.website) return org.website;
  }

  return null;
}

/**
 * Run a full sentinel check for a single user.
 */
export async function runSentinelCheck(
  userId: string,
  orgId: string
): Promise<SentinelCheckResult> {
  logger.info(`[SentinelAgent] Starting check for user ${userId}`);

  // ── Step 1: Seed algorithm updates ─────────────────────────────────────
  await seedAlgorithmUpdates();

  // ── Step 2: Resolve site URL ────────────────────────────────────────────
  const siteUrl = await resolveSiteUrl(userId, orgId);

  if (!siteUrl) {
    logger.info(`[SentinelAgent] No site URL for user ${userId} — skipping`);
    return {
      userId,
      orgId,
      siteUrl: null,
      healthScore: null,
      alertsCreated: 0,
      skipped: true,
      reason: 'No site URL configured. Add your website URL in profile settings.',
    };
  }

  // ── Step 3: Fetch previous snapshot (baseline) ──────────────────────────
  const previousSnapshot = await getLatestSnapshot(userId, siteUrl);

  // ── Step 4: Check current site health ──────────────────────────────────
  let report;
  try {
    report = await checkSiteHealth(siteUrl, userId, orgId);
  } catch (err) {
    logger.error(`[SentinelAgent] Health check failed for ${siteUrl}:`, err);
    return {
      userId,
      orgId,
      siteUrl,
      healthScore: null,
      alertsCreated: 0,
      skipped: true,
      reason: 'Health check failed. Will retry on next scheduled run.',
    };
  }

  // ── Step 5: Fetch current snapshot from DB (just persisted by health-checker)
  const currentSnapshot = await getLatestSnapshot(userId, siteUrl);
  if (!currentSnapshot) {
    return {
      userId,
      orgId,
      siteUrl,
      healthScore: report.healthScore,
      alertsCreated: 0,
      skipped: false,
    };
  }

  // ── Step 6: Get recent algorithm updates ────────────────────────────────
  const recentUpdates = await getRecentUpdates(30);

  // ── Step 7: Run alert engine ────────────────────────────────────────────
  const alerts = await runAlertEngine(currentSnapshot, previousSnapshot, recentUpdates);

  logger.info(
    `[SentinelAgent] Completed check for ${siteUrl}. Score: ${report.healthScore}, Alerts: ${alerts.length}`
  );

  return {
    userId,
    orgId,
    siteUrl,
    healthScore: report.healthScore,
    alertsCreated: alerts.length,
    skipped: false,
  };
}

/**
 * Run sentinel checks for all active users (for cron).
 * Limits to users who have a website configured to avoid wasted calls.
 */
export async function runSentinelCheckForAllUsers(): Promise<{
  processed: number;
  skipped: number;
  errors: number;
  totalAlerts: number;
}> {
  const users = await prisma.user.findMany({
    where: {
      website: { not: null },
    },
    select: {
      id: true,
      organizationId: true,
      website: true,
    },
    take: 100, // Safety limit for cron run
  });

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let totalAlerts = 0;

  for (const user of users) {
    try {
      const result = await runSentinelCheck(user.id, user.organizationId ?? '');
      if (result.skipped) {
        skipped++;
      } else {
        processed++;
        totalAlerts += result.alertsCreated;
      }
    } catch (err) {
      logger.error(`[SentinelAgent] Error processing user ${user.id}:`, err);
      errors++;
    }
  }

  return { processed, skipped, errors, totalAlerts };
}
