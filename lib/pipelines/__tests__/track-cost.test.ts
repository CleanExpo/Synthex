import { calculateCostUsd, trackPipelineCost, TrackCostParams } from '../track-cost';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

const mockInsert = jest.fn();
const mockFrom = jest.fn(() => ({ insert: mockInsert }));
const mockClient = { from: mockFrom };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (createClient as jest.Mock).mockReturnValue(mockClient);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

// ──────────────────────────────────────────────────────────────
// calculateCostUsd
// ──────────────────────────────────────────────────────────────
describe('calculateCostUsd', () => {
  it('claude-opus-4-6: $15 input + $75 output per 1M tokens', () => {
    expect(calculateCostUsd('claude-opus-4-6', 1_000_000, 1_000_000)).toBeCloseTo(90, 4);
  });

  it('claude-sonnet-4-6: $3 input + $15 output per 1M tokens', () => {
    expect(calculateCostUsd('claude-sonnet-4-6', 1_000_000, 1_000_000)).toBeCloseTo(18, 4);
  });

  it('claude-haiku-4-5: $0.25 input + $1.25 output per 1M tokens', () => {
    expect(calculateCostUsd('claude-haiku-4-5', 1_000_000, 1_000_000)).toBeCloseTo(1.5, 4);
  });

  it('returns 0 for unknown model', () => {
    expect(calculateCostUsd('gpt-4o', 1_000_000, 1_000_000)).toBe(0);
  });

  it('returns 0 for zero tokens', () => {
    expect(calculateCostUsd('claude-opus-4-6', 0, 0)).toBe(0);
  });

  it('handles small token counts with 6-decimal precision', () => {
    const expected = (0.25 * 1000 + 1.25 * 2000) / 1_000_000;
    expect(calculateCostUsd('claude-haiku-4-5', 1000, 2000)).toBeCloseTo(expected, 6);
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
    pipelineName: 'brand-intelligence',
    clientId: '123e4567-e89b-12d3-a456-426614174000',
    runId: 'run-001',
    model: 'claude-haiku-4-5',
    inputTokens: 500,
    outputTokens: 1000,
  };

  it('writes structured JSON log on success', async () => {
    await trackPipelineCost(baseParams);
    expect(console.log).toHaveBeenCalledTimes(1);
    const log = JSON.parse((console.log as jest.Mock).mock.calls[0][0]);
    expect(log.event).toBe('pipeline_cost');
    expect(log.pipeline_name).toBe('brand-intelligence');
    expect(typeof log.timestamp).toBe('string');
    expect(typeof log.cost_usd).toBe('number');
  });

  it('inserts correct payload into Supabase', async () => {
    await trackPipelineCost(baseParams);
    expect(mockFrom).toHaveBeenCalledWith('pipeline_cost_ledger');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      pipeline_name: 'brand-intelligence',
      client_id: '123e4567-e89b-12d3-a456-426614174000',
      run_id: 'run-001',
      model: 'claude-haiku-4-5',
      input_tokens: 500,
      output_tokens: 1000,
    }));
  });

  it('accepts null clientId for board-level pipelines', async () => {
    await trackPipelineCost({ ...baseParams, clientId: null });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ client_id: null }));
  });
});

// ──────────────────────────────────────────────────────────────
// trackPipelineCost — DB failure fallback
// ──────────────────────────────────────────────────────────────
describe('trackPipelineCost — DB failure', () => {
  const baseParams: TrackCostParams = {
    pipelineName: 'weekly-digest',
    clientId: null,
    runId: 'run-002',
    model: 'claude-opus-4-6',
    inputTokens: 10_000,
    outputTokens: 5_000,
  };

  it('does not throw on Supabase insert error', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { code: 'PGRST001', message: 'DB down' } });
    await expect(trackPipelineCost(baseParams)).resolves.toBeUndefined();
  });

  it('logs error event on insert failure', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { code: 'PGRST001', message: 'DB down' } });
    await trackPipelineCost(baseParams);
    const errorLog = JSON.parse((console.error as jest.Mock).mock.calls[0][0]);
    expect(errorLog.event).toBe('pipeline_cost_write_failed');
    expect(errorLog.error.code).toBe('PGRST001');
  });

  it('does not throw when createClient throws', async () => {
    (createClient as jest.Mock).mockImplementation(() => { throw new Error('Network timeout'); });
    await expect(trackPipelineCost(baseParams)).resolves.toBeUndefined();
    const errorLog = JSON.parse((console.error as jest.Mock).mock.calls[0][0]);
    expect(errorLog.event).toBe('pipeline_cost_exception');
    expect(errorLog.error.message).toBe('Network timeout');
  });

  it('still writes log even when DB fails', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { code: 'X', message: 'fail' } });
    await trackPipelineCost(baseParams);
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it('skips DB write when env vars missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await trackPipelineCost(baseParams);
    expect(mockInsert).not.toHaveBeenCalled();
    const errorLog = JSON.parse((console.error as jest.Mock).mock.calls[0][0]);
    expect(errorLog.event).toBe('pipeline_cost_skipped');
  });
});
