/**
 * Unit tests for lib/pipelines/track-cost.ts — SYN-518, updated SYN-1115.
 *
 * Covers:
 *   - calculatePipelineCost: known models, unknown model fallback
 *   - trackPipelineCost: successful Prisma write path
 *   - trackPipelineCost: DB failure → falls back to log-only (does not throw)
 *   - trackPipelineCost: null client_id for board-level pipelines
 */

import {
  calculatePipelineCost,
  trackPipelineCost,
} from '@/lib/pipelines/track-cost';

// ─── Prisma mock ───────────────────────────────────────────────────────────
//
// SYN-1115: the ledger write moved from a separately-constructed supabase-js
// client to Prisma. The supabase-js path needed NEXT_PUBLIC_SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY on top of DATABASE_URL and wrote NOTHING when they
// were absent — a real generation could produce a correct log line and no
// ledger row. The "skips DB write when env vars are absent" case below is
// therefore GONE on purpose: that behaviour was the defect.

const mockCreate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    pipelineCostLedger: { create: (...a: unknown[]) => mockCreate(...a) },
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const baseParams = {
  pipeline_name: 'brand-intelligence',
  client_id: 'cli_test_001',
  run_id: 'run_20260330_0400',
  model: 'claude-sonnet-4-6',
  input_tokens: 10_000,
  output_tokens: 2_000,
  cost_usd: 0.06,
};

// ─── calculatePipelineCost ──────────────────────────────────────────────────

describe('calculatePipelineCost', () => {
  it('calculates correctly for claude-sonnet-4-6', () => {
    // 10k input × $3/1M + 2k output × $15/1M = 0.030 + 0.030 = 0.060
    expect(
      calculatePipelineCost('claude-sonnet-4-6', 10_000, 2_000)
    ).toBeCloseTo(0.06, 4);
  });

  it('calculates correctly for claude-opus-4-6', () => {
    // 10k × $5/1M + 2k × $25/1M = 0.050 + 0.050 = 0.100
    expect(calculatePipelineCost('claude-opus-4-6', 10_000, 2_000)).toBeCloseTo(
      0.1,
      4
    );
  });

  it('calculates correctly for claude-haiku-4-5', () => {
    // 10k × $1/1M + 2k × $5/1M = 0.010 + 0.010 = 0.020
    expect(
      calculatePipelineCost('claude-haiku-4-5', 10_000, 2_000)
    ).toBeCloseTo(0.02, 4);
  });

  it('falls back to Sonnet pricing for unknown model and logs a warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const cost = calculatePipelineCost('claude-unknown-99', 10_000, 2_000);
    expect(cost).toBeCloseTo(0.06, 4); // Sonnet fallback
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('pipeline_cost_unknown_model')
    );
    warnSpy.mockRestore();
  });

  it('returns 0 for zero tokens', () => {
    expect(calculatePipelineCost('claude-sonnet-4-6', 0, 0)).toBe(0);
  });
});

// ─── trackPipelineCost ──────────────────────────────────────────────────────

describe('trackPipelineCost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'ledger-row-1' });
  });

  it('logs structured JSON and writes to pipeline_cost_ledger on success', async () => {
    const logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    await trackPipelineCost(baseParams);

    // Belt — the structured log fires first and is unchanged.
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"pipeline_cost"')
    );

    // Suspenders — one Prisma create, camelCase fields per the model.
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        pipelineName: 'brand-intelligence',
        clientId: 'cli_test_001',
        runId: 'run_20260330_0400',
        model: 'claude-sonnet-4-6',
        inputTokens: 10_000,
        outputTokens: 2_000,
        costUsd: 0.06,
      },
    });

    logSpy.mockRestore();
  });

  it('needs no Supabase env vars — DATABASE_URL alone is enough', async () => {
    // The exact condition that silently skipped the write before SYN-1115.
    const original = process.env;
    process.env = { ...original };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await trackPipelineCost(baseParams);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('pipeline_cost_ledger_skipped')
    );

    warnSpy.mockRestore();
    process.env = original;
  });

  it('logs a warning but does not throw when the DB write fails', async () => {
    const logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockCreate.mockRejectedValueOnce(new Error('connection refused'));

    await expect(trackPipelineCost(baseParams)).resolves.toBeUndefined();

    // The record still survives on the log line.
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"pipeline_cost"')
    );
    // Event name preserved from the supabase-js implementation so existing
    // log-based observability keeps matching.
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('pipeline_cost_ledger_write_failed')
    );

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('accepts null client_id for board-level pipelines', async () => {
    const logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    await trackPipelineCost({ ...baseParams, client_id: null });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientId: null }),
    });

    logSpy.mockRestore();
  });
});
