/**
 * Tier-2 monthly AEO gate snapshot (AT-007).
 *
 * AeoGateRun is a portfolio-level audit trail, so report ownership is scoped
 * to the organisation while its metrics cover the configured portfolio.
 */

export const TIER2_REPORT_TYPE = 'agency_tier2';

export interface Tier2GateRun {
  pass: boolean;
  reasons: string[];
}

export interface Tier2Snapshot {
  templateVersion: string;
  monthEnding: string;
  generatedAt: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  failureReasons: Array<{ reason: string; count: number }>;
}

export function buildTier2Snapshot(
  runs: Tier2GateRun[],
  generatedAt = new Date()
): Tier2Snapshot {
  const failedRuns = runs.filter(run => !run.pass);
  const reasonCounts = new Map<string, number>();

  for (const run of failedRuns) {
    for (const reason of run.reasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }

  return {
    templateVersion: 'T2-2026.08',
    monthEnding: generatedAt.toISOString().split('T')[0],
    generatedAt: generatedAt.toISOString(),
    totalRuns: runs.length,
    passedRuns: runs.length - failedRuns.length,
    failedRuns: failedRuns.length,
    failureReasons: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
  };
}

export function isTier2Snapshot(value: unknown): value is Tier2Snapshot {
  if (!value || typeof value !== 'object') return false;

  const snapshot = value as Partial<Tier2Snapshot>;
  return (
    typeof snapshot.monthEnding === 'string' &&
    typeof snapshot.generatedAt === 'string' &&
    typeof snapshot.totalRuns === 'number' &&
    typeof snapshot.passedRuns === 'number' &&
    typeof snapshot.failedRuns === 'number' &&
    Array.isArray(snapshot.failureReasons)
  );
}
