/**
 * Pure core for the image-batch feedback feature: verdict validation and
 * insights aggregation. No DB access, no Date, no random — every input is
 * passed in and every output is deterministic, so this module is unit
 * tested with plain in-memory fixtures (see
 * tests/unit/ai/image-feedback-core.test.ts).
 *
 * Callers are responsible for loading batchRows / feedback rows from the
 * database and persisting the results; this module only decides whether a
 * verdict payload is valid and how completed feedback rows roll up into
 * insights.
 */

export interface Verdict {
  generationId: string;
  kept: boolean;
  rank?: number;
}

export interface BatchRowLite {
  id: string;
  status: string;
}

/**
 * Validates a batch of feedback verdicts against the rows they claim to
 * describe. Verdicts may cover a subset of the batch. Rules enforced:
 *
 *  - the payload must not be empty
 *  - generationIds must be unique within the payload
 *  - every generationId must exist in batchRows
 *  - a verdict referencing a batchRow whose status !== 'completed' is
 *    invalid (a technical failure is never a preference signal)
 *  - a rank may only be present when that verdict's kept is true
 *  - ranks must be unique
 *  - when any ranks are present, they must form exactly the contiguous set
 *    {1..k} for some k >= 1 (e.g. {1} and {1,2} are valid; {2,3} is not)
 */
export function validateVerdicts(
  verdicts: Verdict[],
  batchRows: BatchRowLite[]
): { ok: true } | { ok: false; error: string } {
  if (verdicts.length === 0) {
    return { ok: false, error: 'verdicts array must not be empty' };
  }

  const batchRowsById = new Map(batchRows.map(row => [row.id, row]));

  const seenIds = new Set<string>();
  for (const verdict of verdicts) {
    if (seenIds.has(verdict.generationId)) {
      return {
        ok: false,
        error: `duplicate generationId in verdicts payload: ${verdict.generationId}`,
      };
    }
    seenIds.add(verdict.generationId);
  }

  for (const verdict of verdicts) {
    const row = batchRowsById.get(verdict.generationId);
    if (!row) {
      return {
        ok: false,
        error: `verdict references unknown generationId: ${verdict.generationId}`,
      };
    }
    if (row.status !== 'completed') {
      return {
        ok: false,
        error: `verdict references a non-completed batch row (status "${row.status}"): ${verdict.generationId}`,
      };
    }
  }

  const ranks: number[] = [];
  for (const verdict of verdicts) {
    if (verdict.rank === undefined) continue;
    if (!verdict.kept) {
      return {
        ok: false,
        error: `verdict for ${verdict.generationId} has a rank but kept is not true`,
      };
    }
    ranks.push(verdict.rank);
  }

  if (ranks.length > 0) {
    const rankSet = new Set(ranks);
    if (rankSet.size !== ranks.length) {
      return { ok: false, error: 'duplicate rank values in verdicts payload' };
    }

    const sorted = [...rankSet].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1) {
        return {
          ok: false,
          error: `ranks must form a contiguous set starting at 1 (got {${sorted.join(', ')}})`,
        };
      }
    }
  }

  return { ok: true };
}

export interface FeedbackRowLite {
  batchGroupId: string;
  status: string;
  kept: boolean | null;
  rank: number | null;
  grounded: boolean;
  style: string | null;
  referenceSet: string | null;
  provider: string;
}

export const MIN_SAMPLE_FOR_RATES = 5;

/**
 * Rolls up completed feedback rows into aggregate insights. Rows are
 * expected to already be filtered to status 'completed' + feedback present,
 * but non-completed rows are defensively skipped anyway (a technical
 * failure is never a preference signal).
 */
export function aggregateInsights(rows: FeedbackRowLite[]): {
  totalBatchesRanked: number;
  totalKept: number;
  totalRejected: number;
  sampleSize: number;
  groundedWinRate: number | null;
  styleWinRates: Array<{ style: string; rank1Count: number }>;
  topReferenceSets: Array<{ referenceSet: string; keptCount: number }>;
  providerAvgRank: Array<{ provider: string; avgRank: number; n: number }>;
} {
  const completedRows = rows.filter(row => row.status === 'completed');

  const rankedBatchIds = new Set<string>();
  let totalKept = 0;
  let totalRejected = 0;
  let rank1Count = 0;
  let rank1GroundedCount = 0;

  const styleWinCounts = new Map<string, number>();
  const referenceSetKeptCounts = new Map<string, number>();
  const providerRankTotals = new Map<string, { sum: number; n: number }>();

  for (const row of completedRows) {
    if (row.kept !== null) {
      rankedBatchIds.add(row.batchGroupId);
      if (row.kept === true) totalKept++;
      if (row.kept === false) totalRejected++;
    }

    if (row.rank === 1) {
      rank1Count++;
      if (row.grounded) rank1GroundedCount++;
      if (row.style !== null) {
        styleWinCounts.set(row.style, (styleWinCounts.get(row.style) ?? 0) + 1);
      }
    }

    if (row.kept === true && row.referenceSet !== null) {
      referenceSetKeptCounts.set(
        row.referenceSet,
        (referenceSetKeptCounts.get(row.referenceSet) ?? 0) + 1
      );
    }

    if (row.rank !== null) {
      const totals = providerRankTotals.get(row.provider) ?? { sum: 0, n: 0 };
      totals.sum += row.rank;
      totals.n += 1;
      providerRankTotals.set(row.provider, totals);
    }
  }

  const sampleSize = rankedBatchIds.size;
  const groundedWinRate =
    sampleSize < MIN_SAMPLE_FOR_RATES || rank1Count === 0
      ? null
      : rank1GroundedCount / rank1Count;

  const styleWinRates = [...styleWinCounts.entries()]
    .map(([style, count]) => ({ style, rank1Count: count }))
    .sort((a, b) => b.rank1Count - a.rank1Count);

  const topReferenceSets = [...referenceSetKeptCounts.entries()]
    .map(([referenceSet, count]) => ({ referenceSet, keptCount: count }))
    .sort((a, b) => b.keptCount - a.keptCount);

  const providerAvgRank = [...providerRankTotals.entries()]
    .map(([provider, { sum, n }]) => ({ provider, avgRank: sum / n, n }))
    .sort((a, b) => a.avgRank - b.avgRank);

  return {
    totalBatchesRanked: rankedBatchIds.size,
    totalKept,
    totalRejected,
    sampleSize,
    groundedWinRate,
    styleWinRates,
    topReferenceSets,
    providerAvgRank,
  };
}
