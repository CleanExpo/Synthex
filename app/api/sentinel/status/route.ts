/**
 * Sentinel Status API
 *
 * GET /api/sentinel/status
 * Returns the current health status and unacknowledged alert summary for the
 * authenticated user's site.
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { getLatestSnapshot, getSnapshotHistory } from '@/lib/sentinel/health-checker';
import { getActiveRollouts } from '@/lib/sentinel/algorithm-feed';
import { logger } from '@/lib/logger';
import type { CoreWebVitals } from '@/lib/sentinel/types';

function computeHealthScore(
  avgPosition: number,
  totalClicks: number,
  coverageErrors: number,
  cwv: CoreWebVitals
): number {
  const positionScore = avgPosition <= 0 ? 15 : Math.max(0, 30 - (avgPosition - 1) * 0.6);
  const clickScore = Math.min(20, Math.round((totalClicks / 1000) * 20));
  const errorScore = Math.max(0, 20 - Math.round((coverageErrors / 50) * 20));
  let cwvScore = 0;
  if (cwv.lcp !== null) cwvScore += cwv.lcp <= 2.5 ? 10 : cwv.lcp <= 4.0 ? 5 : 0;
  if (cwv.inp !== null) cwvScore += cwv.inp <= 200 ? 10 : cwv.inp <= 500 ? 5 : 0;
  if (cwv.cls !== null) cwvScore += cwv.cls <= 0.1 ? 10 : cwv.cls <= 0.25 ? 5 : 0;
  return Math.round(positionScore + clickScore + errorScore + cwvScore);
}

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  const userId = security.context.userId!;

  try {
    // Get user's site URL
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { website: true, organizationId: true },
    });

    const siteUrl = user?.website ?? null;

    if (!siteUrl) {
      return APISecurityChecker.createSecureResponse({
        siteUrl: null,
        healthScore: null,
        lastChecked: null,
        unacknowledgedAlerts: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
        activeAlgorithmUpdates: 0,
        snapshot: null,
        history: [],
      });
    }

    // Latest snapshot
    const snapshot = await getLatestSnapshot(userId, siteUrl);

    // Alert counts
    const alertCounts = await prisma.sentinelAlert.groupBy({
      by: ['severity'],
      where: { userId, acknowledged: false },
      _count: true,
    });

    const unacknowledgedAlerts = alertCounts.reduce((sum, g) => sum + g._count, 0);
    const criticalAlerts = alertCounts.find((g) => g.severity === 'critical')?._count ?? 0;
    const warningAlerts = alertCounts.find((g) => g.severity === 'warning')?._count ?? 0;

    // Active rollouts
    const activeRollouts = await getActiveRollouts();

    // Snapshot history for charts (last 14 days)
    const history = await getSnapshotHistory(userId, siteUrl, 14);

    // Health score
    let healthScore = null;
    if (snapshot) {
      healthScore = computeHealthScore(
        snapshot.avgPosition,
        snapshot.totalClicks,
        snapshot.coverageErrors,
        snapshot.coreWebVitals as unknown as CoreWebVitals
      );
    }

    return APISecurityChecker.createSecureResponse({
      siteUrl,
      healthScore,
      lastChecked: snapshot?.snapshotDate ?? null,
      unacknowledgedAlerts,
      criticalAlerts,
      warningAlerts,
      activeAlgorithmUpdates: activeRollouts.length,
      snapshot: snapshot
        ? {
            avgPosition: snapshot.avgPosition,
            totalClicks: snapshot.totalClicks,
            totalImpressions: snapshot.totalImpressions,
            coverageErrors: snapshot.coverageErrors,
            coverageWarnings: snapshot.coverageWarnings,
            coreWebVitals: snapshot.coreWebVitals,
            snapshotDate: snapshot.snapshotDate,
          }
        : null,
      history,
    });
  } catch (error) {
    logger.error('[Sentinel Status] Error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch sentinel status' },
      500
    );
  }
}
