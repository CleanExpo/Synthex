/**
 * Unit tests for lib/pipelines/track-cost.ts — SYN-518
 *
 * Covers:
 *   - calculatePipelineCost: known models, unknown model fallback
 *   - trackPipelineCost: successful DB write path
 *   - trackPipelineCost: DB failure → falls back to log-only (does not throw)
 *   - trackPipelineCost: missing env vars → skips DB write, logs warning
 */

import {
  calculatePipelineCost,
  trackPipelineCost,
} from '@/lib/pipelines/track-cost';

// ─── Supabase mock ─────────────────────────────────────────────────────────

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
const mockCreateClient = createClient as jest.MockedFunction<
  typeof createClient
>;

// Typed helpers — assigned in beforeEach
let mockInsert: jest.Mock;
let mockFrom: jest.Mock;

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
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Fresh mock chain for each test — avoids cross-test contamination
    mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });
    mockCreateClient.mockReturnValue({ from: mockFrom } as ReturnType<
      typeof createClient
    >);
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('logs structured JSON and inserts into pipeline_cost_ledger on success', async () => {
    const logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    mockInsert.mockResolvedValueOnce({ error: null });

    await trackPipelineCost(baseParams);

    // Structured log must fire
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"pipeline_cost"')
    );

    // DB insert must be called with correct table + fields
    expect(mockFrom).toHaveBeenCalledWith('pipeline_cost_ledger');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline_name: 'brand-intelligence',
        client_id: 'cli_test_001',
        run_id: 'run_20260330_0400',
        model: 'claude-sonnet-4-6',
        input_tokens: 10_000,
        output_tokens: 2_000,
        cost_usd: 0.06,
      })
    );

    logSpy.mockRestore();
  });

  it('logs a warning but does not throw when DB write fails', async () => {
    const logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockInsert.mockResolvedValueOnce({
      error: { message: 'connection refused' },
    });

    await expect(trackPipelineCost(baseParams)).resolves.toBeUndefined();

    // Structured log still fires
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"pipeline_cost"')
    );
    // Error is logged
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('pipeline_cost_ledger_write_failed')
    );

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('logs a warning but does not throw when Supabase client throws', async () => {
    const logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockInsert.mockRejectedValueOnce(new Error('network timeout'));

    await expect(trackPipelineCost(baseParams)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('pipeline_cost_ledger_exception')
    );

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('skips DB write and logs a warning when env vars are absent', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await trackPipelineCost(baseParams);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"pipeline_cost"')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('pipeline_cost_ledger_skipped')
    );
    expect(mockInsert).not.toHaveBeenCalled();

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('accepts null client_id for board-level pipelines', async () => {
    const logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    mockInsert.mockResolvedValueOnce({ error: null });

    await trackPipelineCost({ ...baseParams, client_id: null });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: null })
    );

    logSpy.mockRestore();
  });
});
