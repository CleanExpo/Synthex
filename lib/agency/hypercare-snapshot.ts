/**
 * Hyper-Care daily AEO gate snapshot (AT-006).
 *
 * Same portfolio-level AeoGateRun trail as Tier-2, but for the trailing 24h
 * Launch Watch / Hyper-Care window so breaches surface same day.
 */

export const HYPERCARE_REPORT_TYPE = 'agency_hypercare_daily';

export interface HyperCareGateRun {
  pass: boolean;
  reasons: string[];
}

export interface HyperCareSnapshot {
  templateVersion: string;
  dayEnding: string;
  generatedAt: string;
  windowHours: number;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  /** True when any gate run failed in the window — same-day incident signal. */
  breachSurfaced: boolean;
  failureReasons: Array<{ reason: string; count: number }>;
}

export function buildHyperCareSnapshot(
  runs: HyperCareGateRun[],
  generatedAt = new Date()
): HyperCareSnapshot {
  const failedRuns = runs.filter(run => !run.pass);
  const reasonCounts = new Map<string, number>();

  for (const run of failedRuns) {
    for (const reason of run.reasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }

  return {
    templateVersion: 'HC-2026.08',
    dayEnding: generatedAt.toISOString().split('T')[0],
    generatedAt: generatedAt.toISOString(),
    windowHours: 24,
    totalRuns: runs.length,
    passedRuns: runs.length - failedRuns.length,
    failedRuns: failedRuns.length,
    breachSurfaced: failedRuns.length > 0,
    failureReasons: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
  };
}

export function isHyperCareSnapshot(
  value: unknown
): value is HyperCareSnapshot {
  if (!value || typeof value !== 'object') return false;

  const snapshot = value as Partial<HyperCareSnapshot>;
  return (
    typeof snapshot.dayEnding === 'string' &&
    typeof snapshot.generatedAt === 'string' &&
    typeof snapshot.windowHours === 'number' &&
    typeof snapshot.totalRuns === 'number' &&
    typeof snapshot.passedRuns === 'number' &&
    typeof snapshot.failedRuns === 'number' &&
    typeof snapshot.breachSurfaced === 'boolean' &&
    Array.isArray(snapshot.failureReasons)
  );
}
