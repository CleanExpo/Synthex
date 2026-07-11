/**
 * Unit tests for the pure feedback verdict validator + insights aggregator
 * (Task 6 of the image-batch-feedback plan).
 *
 * `image-feedback-core.ts` is a pure module (no DB, no Date, no random) so
 * every case here is expressed as plain in-memory fixtures.
 */

import {
  validateVerdicts,
  aggregateInsights,
  MIN_SAMPLE_FOR_RATES,
  type Verdict,
  type BatchRowLite,
  type FeedbackRowLite,
} from '@/lib/services/ai/image-feedback-core';

describe('validateVerdicts', () => {
  const batchRows: BatchRowLite[] = [
    { id: 'gen-1', status: 'completed' },
    { id: 'gen-2', status: 'completed' },
    { id: 'gen-3', status: 'completed' },
    { id: 'gen-4', status: 'failed' },
  ];

  it('rejects a rank set on a verdict whose kept is not true', () => {
    const verdicts: Verdict[] = [
      { generationId: 'gen-1', kept: false, rank: 1 },
    ];
    const result = validateVerdicts(verdicts, batchRows);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('rank'),
    });
  });

  it('rejects duplicate generationIds within the payload', () => {
    const verdicts: Verdict[] = [
      { generationId: 'gen-1', kept: true, rank: 1 },
      { generationId: 'gen-1', kept: false },
    ];
    const result = validateVerdicts(verdicts, batchRows);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('duplicate'),
    });
  });

  it('rejects duplicate ranks', () => {
    const verdicts: Verdict[] = [
      { generationId: 'gen-1', kept: true, rank: 1 },
      { generationId: 'gen-2', kept: true, rank: 1 },
    ];
    const result = validateVerdicts(verdicts, batchRows);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('rank'),
    });
  });

  it('rejects a non-contiguous rank set like {2,3}', () => {
    const verdicts: Verdict[] = [
      { generationId: 'gen-1', kept: true, rank: 2 },
      { generationId: 'gen-2', kept: true, rank: 3 },
    ];
    const result = validateVerdicts(verdicts, batchRows);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('contiguous'),
    });
  });

  it('accepts a single rank {1} as a valid subset save', () => {
    const verdicts: Verdict[] = [
      { generationId: 'gen-1', kept: true, rank: 1 },
    ];
    const result = validateVerdicts(verdicts, batchRows);
    expect(result).toEqual({ ok: true });
  });

  it('accepts ranks {1,2} as a valid subset save', () => {
    const verdicts: Verdict[] = [
      { generationId: 'gen-1', kept: true, rank: 1 },
      { generationId: 'gen-2', kept: true, rank: 2 },
    ];
    const result = validateVerdicts(verdicts, batchRows);
    expect(result).toEqual({ ok: true });
  });

  it('rejects a verdict referencing a generationId not present in batchRows', () => {
    const verdicts: Verdict[] = [
      { generationId: 'gen-does-not-exist', kept: true, rank: 1 },
    ];
    const result = validateVerdicts(verdicts, batchRows);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('gen-does-not-exist'),
    });
  });

  it('rejects a verdict referencing a batch row whose status is not completed', () => {
    const verdicts: Verdict[] = [
      { generationId: 'gen-4', kept: true, rank: 1 },
    ];
    const result = validateVerdicts(verdicts, batchRows);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('gen-4'),
    });
  });

  it('rejects an empty verdicts array', () => {
    const result = validateVerdicts([], batchRows);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, error: expect.any(String) });
  });

  it('accepts a verdict-only payload (kept:false, no rank) that covers a subset of the batch', () => {
    const verdicts: Verdict[] = [{ generationId: 'gen-2', kept: false }];
    const result = validateVerdicts(verdicts, batchRows);
    expect(result).toEqual({ ok: true });
  });
});

describe('aggregateInsights', () => {
  function row(overrides: Partial<FeedbackRowLite>): FeedbackRowLite {
    return {
      batchGroupId: 'batch-1',
      status: 'completed',
      kept: null,
      rank: null,
      grounded: false,
      style: null,
      referenceSet: null,
      provider: 'flux',
      ...overrides,
    };
  }

  it('returns all zeros and null rates for an empty rows array', () => {
    const result = aggregateInsights([]);
    expect(result).toEqual({
      totalBatchesRanked: 0,
      totalKept: 0,
      totalRejected: 0,
      sampleSize: 0,
      groundedWinRate: null,
      groundedShare: null,
      styleWinRates: [],
      topReferenceSets: [],
      providerAvgRank: [],
    });
  });

  it('excludes failed rows from every number, defensively', () => {
    const rows: FeedbackRowLite[] = [
      row({
        batchGroupId: 'batch-1',
        status: 'failed',
        kept: true,
        rank: 1,
        grounded: true,
        style: 'clean',
        referenceSet: 'ref-a',
        provider: 'flux',
      }),
      row({
        batchGroupId: 'batch-2',
        status: 'completed',
        kept: true,
        rank: 1,
        grounded: true,
        style: 'clean',
        referenceSet: 'ref-a',
        provider: 'flux',
      }),
    ];
    const result = aggregateInsights(rows);
    // Only the completed batch-2 row should be counted anywhere.
    expect(result.totalBatchesRanked).toBe(1);
    expect(result.totalKept).toBe(1);
    expect(result.totalRejected).toBe(0);
    expect(result.sampleSize).toBe(1);
    // groundedShare's window is completed rows only — the failed grounded
    // row must not inflate it; 1 of 1 completed rows is grounded.
    expect(result.groundedShare).toBe(1);
    expect(result.styleWinRates).toEqual([{ style: 'clean', rank1Count: 1 }]);
    expect(result.topReferenceSets).toEqual([
      { referenceSet: 'ref-a', keptCount: 1 },
    ]);
    expect(result.providerAvgRank).toEqual([
      { provider: 'flux', avgRank: 1, n: 1 },
    ]);
  });

  it('with 2 ranked batches (sampleSize < 5): counts are present but groundedWinRate is null', () => {
    const rows: FeedbackRowLite[] = [
      row({ batchGroupId: 'batch-1', kept: true, rank: 1, grounded: true }),
      row({ batchGroupId: 'batch-1', kept: false, rank: 2, grounded: false }),
      row({ batchGroupId: 'batch-2', kept: true, rank: 1, grounded: true }),
      row({ batchGroupId: 'batch-2', kept: false, rank: 2, grounded: false }),
    ];
    const result = aggregateInsights(rows);
    expect(result.sampleSize).toBe(2);
    expect(result.totalBatchesRanked).toBe(2);
    expect(result.totalKept).toBe(2);
    expect(result.totalRejected).toBe(2);
    expect(result.groundedWinRate).toBeNull();
  });

  it('with >=5 ranked batches and grounded rank-1s, computes the correct win rate (3 of 5 = 0.6)', () => {
    const rows: FeedbackRowLite[] = [
      row({ batchGroupId: 'batch-1', kept: true, rank: 1, grounded: true }),
      row({ batchGroupId: 'batch-2', kept: true, rank: 1, grounded: true }),
      row({ batchGroupId: 'batch-3', kept: true, rank: 1, grounded: true }),
      row({ batchGroupId: 'batch-4', kept: true, rank: 1, grounded: false }),
      row({ batchGroupId: 'batch-5', kept: true, rank: 1, grounded: false }),
    ];
    const result = aggregateInsights(rows);
    expect(result.sampleSize).toBe(5);
    expect(result.totalBatchesRanked).toBe(5);
    expect(result.groundedWinRate).toBe(0.6);
  });

  it('counts an all-rejected batch in totalRejected and totalBatchesRanked', () => {
    const rows: FeedbackRowLite[] = [
      row({
        batchGroupId: 'batch-1',
        kept: false,
        rank: null,
        grounded: false,
      }),
      row({
        batchGroupId: 'batch-1',
        kept: false,
        rank: null,
        grounded: false,
      }),
    ];
    const result = aggregateInsights(rows);
    expect(result.totalBatchesRanked).toBe(1);
    expect(result.totalRejected).toBe(2);
    expect(result.totalKept).toBe(0);
  });

  it('providerAvgRank averages only ranked rows per provider and carries n', () => {
    const rows: FeedbackRowLite[] = [
      row({ batchGroupId: 'batch-1', kept: true, rank: 1, provider: 'flux' }),
      row({ batchGroupId: 'batch-1', kept: false, rank: 2, provider: 'flux' }),
      row({
        batchGroupId: 'batch-1',
        kept: false,
        rank: null,
        provider: 'flux',
      }), // unranked, excluded from avg
      row({ batchGroupId: 'batch-2', kept: true, rank: 3, provider: 'gemini' }),
    ];
    const result = aggregateInsights(rows);
    expect(result.providerAvgRank).toEqual([
      { provider: 'flux', avgRank: 1.5, n: 2 },
      { provider: 'gemini', avgRank: 3, n: 1 },
    ]);
  });

  it('styleWinRates skips null style keys and sorts desc by rank1Count', () => {
    const rows: FeedbackRowLite[] = [
      row({ batchGroupId: 'batch-1', kept: true, rank: 1, style: 'moody' }),
      row({ batchGroupId: 'batch-2', kept: true, rank: 1, style: 'moody' }),
      row({ batchGroupId: 'batch-3', kept: true, rank: 1, style: 'bright' }),
      row({ batchGroupId: 'batch-4', kept: true, rank: 1, style: null }),
    ];
    const result = aggregateInsights(rows);
    expect(result.styleWinRates).toEqual([
      { style: 'moody', rank1Count: 2 },
      { style: 'bright', rank1Count: 1 },
    ]);
  });

  it('topReferenceSets skips null referenceSet keys and sorts desc by keptCount', () => {
    const rows: FeedbackRowLite[] = [
      row({
        batchGroupId: 'batch-1',
        kept: true,
        rank: 1,
        referenceSet: 'ref-a',
      }),
      row({
        batchGroupId: 'batch-2',
        kept: true,
        rank: 1,
        referenceSet: 'ref-a',
      }),
      row({
        batchGroupId: 'batch-3',
        kept: true,
        rank: 1,
        referenceSet: 'ref-b',
      }),
      row({ batchGroupId: 'batch-4', kept: true, rank: 1, referenceSet: null }),
      row({
        batchGroupId: 'batch-5',
        kept: false,
        rank: 2,
        referenceSet: 'ref-c',
      }), // not kept, excluded
    ];
    const result = aggregateInsights(rows);
    expect(result.topReferenceSets).toEqual([
      { referenceSet: 'ref-a', keptCount: 2 },
      { referenceSet: 'ref-b', keptCount: 1 },
    ]);
  });

  it('exposes MIN_SAMPLE_FOR_RATES as 5', () => {
    expect(MIN_SAMPLE_FOR_RATES).toBe(5);
  });

  it('computes groundedShare as grounded ÷ completed rows, with no MIN_SAMPLE_FOR_RATES gate', () => {
    const rows: FeedbackRowLite[] = [
      row({ batchGroupId: 'batch-1', grounded: true }),
      row({ batchGroupId: 'batch-2', grounded: true }),
      row({ batchGroupId: 'batch-3', grounded: false }),
    ];
    const result = aggregateInsights(rows);
    // 2 of 3 completed rows grounded — no 5-sample threshold applies here,
    // unlike groundedWinRate.
    expect(result.groundedShare).toBeCloseTo(2 / 3);
  });

  it('excludes non-completed rows from the groundedShare window', () => {
    const rows: FeedbackRowLite[] = [
      row({ batchGroupId: 'batch-1', status: 'failed', grounded: true }),
    ];
    const result = aggregateInsights(rows);
    expect(result.groundedShare).toBeNull();
  });

  it('returns groundedShare null when there are no rows at all', () => {
    const result = aggregateInsights([]);
    expect(result.groundedShare).toBeNull();
  });
});
