/**
 * Algorithm Sentinel — Alert Engine
 *
 * Compares current and previous site health snapshots to detect regressions.
 * Generates SentinelAlert records for significant changes.
 *
 * Alert types:
 * - ranking-drop: average position worsened significantly
 * - traffic-drop: total clicks dropped significantly
 * - crawl-error-spike: coverage errors increased sharply
 * - cwv-regression: Core Web Vitals crossed failure thresholds
 * - algorithm-update: traffic drop correlated with active algorithm update
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { SiteHealthSnapshot, AlgorithmUpdate } from '@prisma/client';
import type { CoreWebVitals, AlertThresholds } from './types';
import { DEFAULT_THRESHOLDS } from './types';

// ============================================================================
// CHANGE CALCULATION HELPERS
// ============================================================================

function percentChange(previous: number, current: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function cwvFromJson(raw: unknown): CoreWebVitals {
  if (!raw || typeof raw !== 'object') return { lcp: null, inp: null, cls: null, fid: null };
  const obj = raw as Record<string, unknown>;
  return {
    lcp: typeof obj.lcp === 'number' ? obj.lcp : null,
    inp: typeof obj.inp === 'number' ? obj.inp : null,
    cls: typeof obj.cls === 'number' ? obj.cls : null,
    fid: typeof obj.fid === 'number' ? obj.fid : null,
  };
}

// ============================================================================
// ALERT BUILDERS
// ============================================================================

interface AlertInput {
  userId: string;
  orgId: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  metric?: string;
  previousValue?: number;
  currentValue?: number;
  changePercent?: number;
  relatedUpdateId?: string;
}

// ============================================================================
// MAIN ALERT ENGINE
// ============================================================================

/**
 * Compare current vs previous snapshot and emit alerts for regressions.
 * Persists new alerts to DB and returns them.
 */
export async function runAlertEngine(
  currentSnapshot: SiteHealthSnapshot,
  previousSnapshot: SiteHealthSnapshot | null,
  recentUpdates: AlgorithmUpdate[],
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): Promise<AlertInput[]> {
  const alerts: AlertInput[] = [];
  const { userId, orgId } = currentSnapshot;

  if (!previousSnapshot) {
    // No baseline to compare — emit info alert on first check
    alerts.push({
      userId,
      orgId,
      alertType: 'algorithm-update',
      severity: 'info',
      title: 'Sentinel baseline established',
      description: `First health snapshot recorded for ${currentSnapshot.siteUrl}. Future checks will detect regressions against this baseline.`,
    });
  } else {
    // ── Ranking drop detection ────────────────────────────────────────────
    const posChange = percentChange(previousSnapshot.avgPosition, currentSnapshot.avgPosition);
    // Position: higher number = worse ranking
    if (
      previousSnapshot.avgPosition > 0 &&
      currentSnapshot.avgPosition > previousSnapshot.avgPosition
    ) {
      if (posChange >= thresholds.rankingDropCritical) {
        alerts.push({
          userId,
          orgId,
          alertType: 'ranking-drop',
          severity: 'critical',
          title: 'Critical ranking drop detected',
          description: `Average position has dropped from ${previousSnapshot.avgPosition.toFixed(1)} to ${currentSnapshot.avgPosition.toFixed(1)} — a ${posChange.toFixed(0)}% regression. Immediate investigation recommended.`,
          metric: 'avgPosition',
          previousValue: previousSnapshot.avgPosition,
          currentValue: currentSnapshot.avgPosition,
          changePercent: posChange,
        });
      } else if (posChange >= thresholds.rankingDropWarning) {
        alerts.push({
          userId,
          orgId,
          alertType: 'ranking-drop',
          severity: 'warning',
          title: 'Ranking position declining',
          description: `Average position has dropped from ${previousSnapshot.avgPosition.toFixed(1)} to ${currentSnapshot.avgPosition.toFixed(1)} (${posChange.toFixed(0)}% worse). Monitor closely for continued decline.`,
          metric: 'avgPosition',
          previousValue: previousSnapshot.avgPosition,
          currentValue: currentSnapshot.avgPosition,
          changePercent: posChange,
        });
      }
    }

    // ── Traffic drop detection ────────────────────────────────────────────
    const clickChange = percentChange(previousSnapshot.totalClicks, currentSnapshot.totalClicks);
    if (previousSnapshot.totalClicks > 0 && currentSnapshot.totalClicks < previousSnapshot.totalClicks) {
      const dropPercent = Math.abs(clickChange);
      if (dropPercent >= thresholds.trafficDropCritical) {
        alerts.push({
          userId,
          orgId,
          alertType: 'traffic-drop',
          severity: 'critical',
          title: 'Critical traffic drop detected',
          description: `Total clicks have fallen from ${previousSnapshot.totalClicks.toLocaleString()} to ${currentSnapshot.totalClicks.toLocaleString()} — a ${dropPercent.toFixed(0)}% decrease. This may indicate a Google algorithm penalty or technical issue.`,
          metric: 'totalClicks',
          previousValue: previousSnapshot.totalClicks,
          currentValue: currentSnapshot.totalClicks,
          changePercent: clickChange,
        });
      } else if (dropPercent >= thresholds.trafficDropWarning) {
        alerts.push({
          userId,
          orgId,
          alertType: 'traffic-drop',
          severity: 'warning',
          title: 'Traffic volume declining',
          description: `Total clicks dropped from ${previousSnapshot.totalClicks.toLocaleString()} to ${currentSnapshot.totalClicks.toLocaleString()} (${dropPercent.toFixed(0)}% decrease). Check Search Console for page-level changes.`,
          metric: 'totalClicks',
          previousValue: previousSnapshot.totalClicks,
          currentValue: currentSnapshot.totalClicks,
          changePercent: clickChange,
        });
      }
    }

    // ── Crawl error spike detection ───────────────────────────────────────
    if (previousSnapshot.coverageErrors > 0 && currentSnapshot.coverageErrors > previousSnapshot.coverageErrors) {
      const errorChange = percentChange(previousSnapshot.coverageErrors, currentSnapshot.coverageErrors);
      if (errorChange >= thresholds.crawlErrorSpikeWarning) {
        alerts.push({
          userId,
          orgId,
          alertType: 'crawl-error-spike',
          severity: 'warning',
          title: 'Crawl error spike detected',
          description: `Coverage errors increased from ${previousSnapshot.coverageErrors} to ${currentSnapshot.coverageErrors} (${errorChange.toFixed(0)}% increase). Check Google Search Console Coverage report for affected URLs.`,
          metric: 'coverageErrors',
          previousValue: previousSnapshot.coverageErrors,
          currentValue: currentSnapshot.coverageErrors,
          changePercent: errorChange,
        });
      }
    } else if (previousSnapshot.coverageErrors === 0 && currentSnapshot.coverageErrors > 10) {
      alerts.push({
        userId,
        orgId,
        alertType: 'crawl-error-spike',
        severity: 'warning',
        title: 'New crawl errors detected',
        description: `${currentSnapshot.coverageErrors} new coverage errors detected. Check Google Search Console Coverage report for affected URLs.`,
        metric: 'coverageErrors',
        previousValue: 0,
        currentValue: currentSnapshot.coverageErrors,
        changePercent: 100,
      });
    }

    // ── CWV regression detection ──────────────────────────────────────────
    const prevCwv = cwvFromJson(previousSnapshot.coreWebVitals);
    const currCwv = cwvFromJson(currentSnapshot.coreWebVitals);

    if (
      currCwv.lcp !== null &&
      currCwv.lcp > thresholds.lcpThresholdSeconds &&
      (prevCwv.lcp === null || prevCwv.lcp <= thresholds.lcpThresholdSeconds)
    ) {
      alerts.push({
        userId,
        orgId,
        alertType: 'cwv-regression',
        severity: 'warning',
        title: 'LCP performance regression',
        description: `Largest Contentful Paint has crossed the fail threshold: ${currCwv.lcp.toFixed(1)}s (threshold: ${thresholds.lcpThresholdSeconds}s). Page load experience is degraded. Review image sizes, server response times, and render-blocking resources.`,
        metric: 'lcp',
        previousValue: prevCwv.lcp ?? undefined,
        currentValue: currCwv.lcp,
      });
    }

    if (
      currCwv.inp !== null &&
      currCwv.inp > thresholds.inpThresholdMs &&
      (prevCwv.inp === null || prevCwv.inp <= thresholds.inpThresholdMs)
    ) {
      alerts.push({
        userId,
        orgId,
        alertType: 'cwv-regression',
        severity: 'warning',
        title: 'INP performance regression',
        description: `Interaction to Next Paint has crossed the fail threshold: ${currCwv.inp}ms (threshold: ${thresholds.inpThresholdMs}ms). User interaction responsiveness is degraded. Review JavaScript execution and main thread blocking.`,
        metric: 'inp',
        previousValue: prevCwv.inp ?? undefined,
        currentValue: currCwv.inp,
      });
    }

    // ── Algorithm update correlation ──────────────────────────────────────
    const activeHighImpact = recentUpdates.filter(
      (u) => u.impactLevel === 'high' && (u.rolloutEnd === null || u.rolloutEnd > new Date())
    );

    if (
      activeHighImpact.length > 0 &&
      previousSnapshot.totalClicks > 0 &&
      Math.abs(clickChange) >= thresholds.trafficDropWarning
    ) {
      const update = activeHighImpact[0];
      alerts.push({
        userId,
        orgId,
        alertType: 'algorithm-update',
        severity: 'critical',
        title: `Traffic drop correlates with ${update.name}`,
        description: `Your site has lost ${Math.abs(clickChange).toFixed(0)}% of clicks during the ${update.name} rollout. This pattern suggests your site may be affected by the algorithm change. Review content quality, E-E-A-T signals, and Google's update guidance.`,
        metric: 'totalClicks',
        previousValue: previousSnapshot.totalClicks,
        currentValue: currentSnapshot.totalClicks,
        changePercent: clickChange,
        relatedUpdateId: update.id,
      });
    }
  }

  // ── Persist alerts to DB ──────────────────────────────────────────────────
  if (alerts.length > 0) {
    try {
      await prisma.sentinelAlert.createMany({
        data: alerts.map((a) => ({
          userId: a.userId,
          orgId: a.orgId,
          alertType: a.alertType,
          severity: a.severity,
          title: a.title,
          description: a.description,
          metric: a.metric ?? null,
          previousValue: a.previousValue ?? null,
          currentValue: a.currentValue ?? null,
          changePercent: a.changePercent ?? null,
          relatedUpdateId: a.relatedUpdateId ?? null,
        })),
      });

      // Update alertsTriggered count on the current snapshot
      await prisma.siteHealthSnapshot.updateMany({
        where: {
          userId: currentSnapshot.userId,
          siteUrl: currentSnapshot.siteUrl,
          snapshotDate: currentSnapshot.snapshotDate,
        },
        data: { alertsTriggered: alerts.length },
      });

      logger.info(`[AlertEngine] Created ${alerts.length} alerts for user ${userId}`);
    } catch (err) {
      logger.error('[AlertEngine] Failed to persist alerts:', err);
    }
  }

  return alerts;
}
