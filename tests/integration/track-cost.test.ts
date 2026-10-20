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

  it('records an unknown model at 0 USD and logs a warning naming it', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const cost = calculatePipelineCost('claude-unknown-99', 10_000, 2_000);
    expect(cost).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('claude-unknown-99')
    );
    warnSpy.mockRestore();
  });

  it('returns 0 for zero tokens', () => {
    expect(calculatePipelineCost('claude-sonnet-4-6', 0, 0)).toBe(0);
  });
});

// ─── calculatePipelineCost: dated-alias fallback ────────────────────────────
//
// The fallback exists for date-stamped ids only. A bare prefix match let an
// unregistered id borrow a DIFFERENT model's rate: 'claude-3-5' priced as
// 'claude-3-5-sonnet', 'gpt-4' as whichever of 'gpt-4-turbo' / 'gpt-4-o' /
// 'gpt-4-o-mini' came first. An unknown model must record 0 and warn.

describe('calculatePipelineCost — dated-alias fallback', () => {
  // gpt-4-o: $5 in / $15 out per 1M; gpt-4-o-mini: $0.15 / $0.60.
  const GPT_4O = 5 + 15;
  const GPT_4O_MINI = 0.15 + 0.6;

  it('positive control: an exact registered id prices at its own rate', () => {
    expect(calculatePipelineCost('gpt-4-o', 1_000_000, 1_000_000)).toBeCloseTo(
      GPT_4O,
      4
    );
    expect(
      calculatePipelineCost('gpt-4-o-mini', 1_000_000, 1_000_000)
    ).toBeCloseTo(GPT_4O_MINI, 4);
  });

  it('an unregistered prefix of ONE registered id records 0, not that model’s rate', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(calculatePipelineCost('claude-3-5', 1_000_000, 1_000_000)).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('claude-3-5'));
    warnSpy.mockRestore();
  });

  it('an unregistered prefix of SEVERAL registered ids records 0', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(calculatePipelineCost('gpt-4', 1_000_000, 1_000_000)).toBe(0);
    warnSpy.mockRestore();
  });

  it('an undated alias still resolves to its dated registry id', () => {
    // claude-haiku-4-5 -> claude-haiku-4-5-20251001 ($1 / $5 per 1M).
    expect(
      calculatePipelineCost('claude-haiku-4-5', 1_000_000, 1_000_000)
    ).toBeCloseTo(6, 4);
  });

  it('a dated variant of a registered id resolves to that id (YYYY-MM-DD)', () => {
    expect(
      calculatePipelineCost('gpt-4-o-2024-08-06', 1_000_000, 1_000_000)
    ).toBeCloseTo(GPT_4O, 4);
    expect(
      calculatePipelineCost('gpt-4-o-mini-2024-07-18', 1_000_000, 1_000_000)
    ).toBeCloseTo(GPT_4O_MINI, 4);
  });

  it('a dated variant of a registered id resolves to that id (YYYYMMDD)', () => {
    // claude-sonnet-4-6: $3 / $15 per 1M.
    expect(
      calculatePipelineCost('claude-sonnet-4-6-20260115', 1_000_000, 1_000_000)
    ).toBeCloseTo(18, 4);
  });

  it('an undated alias matching TWO dated registry ids is ambiguous and records 0', () => {
    jest.isolateModules(() => {
      jest.doMock('@/lib/ai/model-registry', () => {
        const model = (id: string, input: number) => ({
          id,
          provider: 'anthropic',
          costPer1kTokens: { input, output: input },
        });
        const models = [
          model('claude-x-1-20250101', 0.001),
          model('claude-x-1-20260101', 0.002),
        ];
        return {
          getModel: (_p: string, id: string) =>
            models.find(m => m.id === id) ?? null,
          getModels: (p: string) => (p === 'anthropic' ? models : []),
        };
      });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const isolated =
        require('@/lib/pipelines/track-cost') as typeof import('@/lib/pipelines/track-cost');
      expect(
        isolated.calculatePipelineCost('claude-x-1', 1_000_000, 1_000_000)
      ).toBe(0);
      // Control: each dated id still prices exactly.
      expect(
        isolated.calculatePipelineCost(
          'claude-x-1-20260101',
          1_000_000,
          1_000_000
        )
      ).toBeCloseTo(4, 4);
      warnSpy.mockRestore();
    });
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
