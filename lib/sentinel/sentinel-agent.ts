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
async function resolveSiteUrl(
  userId: string,
  orgId: string
): Promise<string | null> {
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
  orgId: string,
  knownSiteUrl?: string
): Promise<SentinelCheckResult> {
  logger.info(`[SentinelAgent] Starting check for user ${userId}`);

  // ── Step 1: Seed algorithm updates ─────────────────────────────────────
  await seedAlgorithmUpdates();

  // ── Step 2: Resolve site URL ────────────────────────────────────────────
  // A caller that already knows the exact site to monitor (e.g. an org target
  // resolved to org.website) passes it explicitly so resolveSiteUrl's
  // user.website→org.website preference can't substitute a member's personal
  // site for the org site we intended to check.
  const siteUrl = knownSiteUrl ?? (await resolveSiteUrl(userId, orgId));

  if (!siteUrl) {
    logger.info(`[SentinelAgent] No site URL for user ${userId} — skipping`);
    return {
      userId,
      orgId,
      siteUrl: null,
      healthScore: null,
      alertsCreated: 0,
      skipped: true,
      reason:
        'No site URL configured. Add your website URL in profile settings.',
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
  const alerts = await runAlertEngine(
    currentSnapshot,
    previousSnapshot,
    recentUpdates
  );

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
  // resolveSiteUrl resolves a site from user.website → organization.website.
  // Two membership realities must both be enumerated or sentinel produces
  // nothing: a few users carry a personal website, but org sites (incl. every
  // portfolio business) link their members through team_members — NOT the
  // users FK, which is empty for them. Pull both.
  const [personalSiteUsers, websiteOrgs] = await Promise.all([
    prisma.user.findMany({
      where: { website: { not: null } },
      select: { id: true, organizationId: true, website: true },
      orderBy: { id: 'asc' },
      take: 200,
    }),
    prisma.organization.findMany({
      where: { website: { not: null } },
      select: {
        id: true,
        website: true,
        teamMembers: {
          where: { acceptedAt: { not: null } },
          select: { userId: true, role: true },
          orderBy: { role: 'asc' },
          take: 10,
        },
      },
      orderBy: { id: 'asc' },
      take: 200,
    }),
  ]);

  // Build (userId, orgId) targets, deduped by resolved site so each distinct
  // website is checked once (no duplicate external calls or alerts). For an org
  // site the userId is an accepted member (owner → admin → any) so
  // resolveSiteUrl falls through to org.website for it.
  const seenSites = new Set<string>();
  const users: Array<{
    id: string;
    organizationId: string | null;
    siteUrl: string;
  }> = [];
  for (const u of personalSiteUsers) {
    if (!u.website || seenSites.has(u.website)) continue;
    seenSites.add(u.website);
    users.push({
      id: u.id,
      organizationId: u.organizationId,
      siteUrl: u.website,
    });
  }
  for (const o of websiteOrgs) {
    if (!o.website || seenSites.has(o.website)) continue;
    const member =
      o.teamMembers.find(m => m.role === 'owner') ??
      o.teamMembers.find(m => m.role === 'admin') ??
      o.teamMembers[0];
    if (!member) continue; // no member to attribute the check to
    seenSites.add(o.website);
    // Carry o.website explicitly: the attributed member may have a personal
    // website, which resolveSiteUrl would otherwise check instead of the org
    // site we deduped on here.
    users.push({ id: member.userId, organizationId: o.id, siteUrl: o.website });
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let totalAlerts = 0;

  for (const user of users) {
    try {
      const result = await runSentinelCheck(
        user.id,
        user.organizationId ?? '',
        user.siteUrl
      );
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
