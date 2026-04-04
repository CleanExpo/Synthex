/**
 * Algorithm Sentinel — Health Checker
 *
 * Pulls site health data from Google Search Console (GSC) and
 * PageSpeed Insights (PSI) to build a SiteHealthSnapshot.
 *
 * Reuses existing integrations:
 * - lib/google/search-console.ts → getSearchAnalytics
 * - lib/seo/pagespeed-service.ts → runPageSpeedAnalysis
 *
 * ENVIRONMENT VARIABLES:
 * - GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: GSC service account (OPTIONAL — demo data fallback)
 * - GOOGLE_PAGESPEED_API_KEY: PSI API key (OPTIONAL — public endpoint fallback)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSearchAnalytics } from '@/lib/google/search-console';
import { runPageSpeedAnalysis } from '@/lib/seo/pagespeed-service';
import type { SiteHealthReport, CoreWebVitals } from './types';

// ============================================================================
// HEALTH SCORE COMPUTATION
// ============================================================================

/**
 * Compute a 0–100 health score from site metrics.
 *
 * Weights:
 * - Average position (lower is better): 30 points
 * - Click volume (higher is better): 20 points
 * - Crawl error count (lower is better): 20 points
 * - CWV pass rate: 30 points
 */
function computeHealthScore(
  avgPosition: number,
  totalClicks: number,
  coverageErrors: number,
  cwv: CoreWebVitals
): number {
  // Position score: position 1 = 30, position 10 = 18, position 50+ = 0
  const positionScore = avgPosition <= 0 ? 15 : Math.max(0, 30 - (avgPosition - 1) * 0.6);

  // Click score: 1000+ clicks = 20 points, scales down
  const clickScore = Math.min(20, Math.round((totalClicks / 1000) * 20));

  // Error score: 0 errors = 20, 50+ errors = 0
  const errorScore = Math.max(0, 20 - Math.round((coverageErrors / 50) * 20));

  // CWV score: each metric pass/fail
  let cwvScore = 0;
  if (cwv.lcp !== null) cwvScore += cwv.lcp <= 2.5 ? 10 : cwv.lcp <= 4.0 ? 5 : 0;
  if (cwv.inp !== null) cwvScore += cwv.inp <= 200 ? 10 : cwv.inp <= 500 ? 5 : 0;
  if (cwv.cls !== null) cwvScore += cwv.cls <= 0.1 ? 10 : cwv.cls <= 0.25 ? 5 : 0;

  return Math.round(positionScore + clickScore + errorScore + cwvScore);
}

// ============================================================================
// MAIN HEALTH CHECK
// ============================================================================

export async function checkSiteHealth(
  siteUrl: string,
  userId: string,
  orgId: string
): Promise<SiteHealthReport> {
  logger.info(`[HealthChecker] Checking site health for ${siteUrl}`);

  // ── GSC: Search Analytics (28 days) ──────────────────────────────────────
  let avgPosition = 0;
  let totalClicks = 0;
  let totalImpressions = 0;
  const coverageErrors = 0;
  const coverageWarnings = 0;

  try {
    const analytics = await getSearchAnalytics(siteUrl, {
      dimensions: ['query'],
      rowLimit: 1000,
    });
    avgPosition = analytics.totals.position;
    totalClicks = analytics.totals.clicks;
    totalImpressions = analytics.totals.impressions;
  } catch (err) {
    logger.warn('[HealthChecker] GSC analytics failed, using defaults');
  }

  // ── PSI: Core Web Vitals ─────────────────────────────────────────────────
  let coreWebVitals: CoreWebVitals = { lcp: null, inp: null, cls: null, fid: null };

  try {
    const psi = await runPageSpeedAnalysis(siteUrl, 'mobile');
    if (psi.fieldMetrics) {
      coreWebVitals = {
        lcp: psi.fieldMetrics.lcp,
        inp: psi.fieldMetrics.inp,
        cls: psi.fieldMetrics.cls,
        fid: psi.fieldMetrics.fid ?? null,
      };
    } else if (psi.labMetrics) {
      // Fall back to lab data if field data unavailable
      coreWebVitals = {
        lcp: psi.labMetrics.lcp,
        inp: null,
        cls: psi.labMetrics.cls,
        fid: null,
      };
    }
  } catch (err) {
    logger.warn('[HealthChecker] PSI fetch failed, CWV will be null');
  }

  const healthScore = computeHealthScore(avgPosition, totalClicks, coverageErrors, coreWebVitals);

  const report: SiteHealthReport = {
    siteUrl,
    userId,
    orgId,
    avgPosition,
    totalClicks,
    totalImpressions,
    coverageErrors,
    coverageWarnings,
    coreWebVitals,
    healthScore,
    snapshotDate: new Date(),
  };

  // ── Persist snapshot ──────────────────────────────────────────────────────
  try {
    await prisma.siteHealthSnapshot.create({
      data: {
        userId,
        orgId,
        siteUrl,
        avgPosition,
        totalClicks,
        totalImpressions,
        coverageErrors,
        coverageWarnings,
        coreWebVitals: coreWebVitals as object,
      },
    });
    logger.info(`[HealthChecker] Snapshot saved for ${siteUrl}`);
  } catch (err) {
    logger.error('[HealthChecker] Failed to persist snapshot:', err);
  }

  return report;
}

// ============================================================================
// SNAPSHOT HISTORY QUERY
// ============================================================================

export interface SnapshotPoint {
  date: string; // ISO
  avgPosition: number;
  totalClicks: number;
  totalImpressions: number;
  healthScore: number;
}

/**
 * Get last N snapshots for a user's site, ordered oldest → newest.
 */
export async function getSnapshotHistory(
  userId: string,
  siteUrl: string,
  days: number = 28
): Promise<SnapshotPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await prisma.siteHealthSnapshot.findMany({
    where: { userId, siteUrl, snapshotDate: { gte: since } },
    orderBy: { snapshotDate: 'asc' },
    take: 30,
  });

  return rows.map((r) => ({
    date: r.snapshotDate.toISOString(),
    avgPosition: r.avgPosition,
    totalClicks: r.totalClicks,
    totalImpressions: r.totalImpressions,
    healthScore: computeHealthScore(
      r.avgPosition,
      r.totalClicks,
      r.coverageErrors,
      r.coreWebVitals as unknown as CoreWebVitals
    ),
  }));
}

/**
 * Get the most recent snapshot for a user+site.
 */
export async function getLatestSnapshot(userId: string, siteUrl: string) {
  return prisma.siteHealthSnapshot.findFirst({
    where: { userId, siteUrl },
    orderBy: { snapshotDate: 'desc' },
  });
}
