import {
  calculatePipelineCost,
  trackPipelineCost,
  TrackCostParams,
} from '../track-cost';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

const mockInsert = jest.fn();
const mockFrom = jest.fn(() => ({ insert: mockInsert }));
const mockClient = { from: mockFrom };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (createClient as jest.Mock).mockReturnValue(mockClient);
  mockFrom.mockReturnValue({ insert: mockInsert });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

// ──────────────────────────────────────────────────────────────
// calculatePipelineCost
// ──────────────────────────────────────────────────────────────
describe('calculatePipelineCost', () => {
  it('claude-opus-4-6: $5 input + $25 output per 1M tokens', () => {
    expect(
      calculatePipelineCost('claude-opus-4-6', 1_000_000, 1_000_000)
    ).toBeCloseTo(30, 4);
  });

  it('claude-sonnet-4-6: $3 input + $15 output per 1M tokens', () => {
    expect(
      calculatePipelineCost('claude-sonnet-4-6', 1_000_000, 1_000_000)
    ).toBeCloseTo(18, 4);
  });

  it('claude-haiku-4-5: $1 input + $5 output per 1M tokens', () => {
    expect(
      calculatePipelineCost('claude-haiku-4-5', 1_000_000, 1_000_000)
    ).toBeCloseTo(6, 4);
  });

  it('falls back to sonnet pricing for unknown model', () => {
    expect(calculatePipelineCost('gpt-4o', 1_000_000, 1_000_000)).toBeCloseTo(
      18,
      4
    );
  });

  it('returns 0 for zero tokens', () => {
    expect(calculatePipelineCost('claude-opus-4-6', 0, 0)).toBe(0);
  });

  it('handles small token counts with 6-decimal precision', () => {
    const expected = parseFloat(
      ((1000 / 1_000_000) * 1.0 + (2000 / 1_000_000) * 5.0).toFixed(6)
    );
    expect(calculatePipelineCost('claude-haiku-4-5', 1000, 2000)).toBeCloseTo(
      expected,
      6
    );
  });
});

// ──────────────────────────────────────────────────────────────
// trackPipelineCost — successful write path
// ──────────────────────────────────────────────────────────────
describe('trackPipelineCost — success', () => {
  beforeEach(() => {
    mockInsert.mockResolvedValue({ data: null, error: null });
  });

  const baseParams: TrackCostParams = {
    pipeline_name: 'brand-intelligence',
    client_id: '123e4567-e89b-12d3-a456-426614174000',
    run_id: 'run-001',
    model: 'claude-haiku-4-5',
    input_tokens: 500,
    output_tokens: 1000,
    cost_usd: 0.000625,
  };

  it('writes structured JSON log on success', async () => {
    await trackPipelineCost(baseParams);
    expect(console.info).toHaveBeenCalledTimes(1);
    const log = JSON.parse((console.info as jest.Mock).mock.calls[0][0]);
    expect(log.event).toBe('pipeline_cost');
    expect(log.pipeline_name).toBe('brand-intelligence');
    expect(typeof log.timestamp).toBe('string');
    expect(typeof log.cost_usd).toBe('number');
  });

  it('inserts correct payload into Supabase', async () => {
    await trackPipelineCost(baseParams);
    expect(mockFrom).toHaveBeenCalledWith('pipeline_cost_ledger');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline_name: 'brand-intelligence',
        client_id: '123e4567-e89b-12d3-a456-426614174000',
        run_id: 'run-001',
        model: 'claude-haiku-4-5',
        input_tokens: 500,
        output_tokens: 1000,
      })
    );
  });

  it('accepts null client_id for board-level pipelines', async () => {
    await trackPipelineCost({ ...baseParams, client_id: null });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: null })
    );
  });
});

// ──────────────────────────────────────────────────────────────
// trackPipelineCost — DB failure fallback
// ──────────────────────────────────────────────────────────────
describe('trackPipelineCost — DB failure', () => {
  const baseParams: TrackCostParams = {
    pipeline_name: 'weekly-digest',
    client_id: null,
    run_id: 'run-002',
    model: 'claude-opus-4-6',
    input_tokens: 10_000,
    output_tokens: 5_000,
    cost_usd: 0.000175,
  };

  it('does not throw on Supabase insert error', async () => {
    mockInsert.mockResolvedValue({
      data: null,
      error: { code: 'PGRST001', message: 'DB down' },
    });
    await expect(trackPipelineCost(baseParams)).resolves.toBeUndefined();
  });

  it('logs error event on insert failure', async () => {
    mockInsert.mockResolvedValue({
      data: null,
      error: { code: 'PGRST001', message: 'DB down' },
    });
    await trackPipelineCost(baseParams);
    const errorLog = JSON.parse((console.error as jest.Mock).mock.calls[0][0]);
    expect(errorLog.event).toBe('pipeline_cost_ledger_write_failed');
  });

  it('does not throw when createClient throws', async () => {
    (createClient as jest.Mock).mockImplementation(() => {
      throw new Error('Network timeout');
    });
    await expect(trackPipelineCost(baseParams)).resolves.toBeUndefined();
    const errorLog = JSON.parse((console.error as jest.Mock).mock.calls[0][0]);
    expect(errorLog.event).toBe('pipeline_cost_ledger_exception');
  });

  it('still writes info log even when DB fails', async () => {
    mockInsert.mockResolvedValue({
      data: null,
      error: { code: 'X', message: 'fail' },
    });
    await trackPipelineCost(baseParams);
    expect(console.info).toHaveBeenCalledTimes(1);
  });

  it('skips DB write when env vars missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await trackPipelineCost(baseParams);
    expect(mockInsert).not.toHaveBeenCalled();
    const warnLog = JSON.parse((console.warn as jest.Mock).mock.calls[0][0]);
    expect(warnLog.event).toBe('pipeline_cost_ledger_skipped');
  });
});
