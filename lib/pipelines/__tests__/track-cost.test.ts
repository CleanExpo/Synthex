import {
  calculatePipelineCost,
  trackPipelineCost,
  TrackCostParams,
} from '../track-cost';

const mockCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    pipelineCostLedger: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
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

  it('prices a non-Anthropic registry model at its own rate', () => {
    // gpt-4-o-mini: $0.15 in / $0.60 out per 1M => 0.75
    expect(
      calculatePipelineCost('gpt-4-o-mini', 1_000_000, 1_000_000)
    ).toBeCloseTo(0.75, 4);
  });

  it('records an unknown model at 0 USD and warns naming the model', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(calculatePipelineCost('gpt-4o', 1_000_000, 1_000_000)).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('gpt-4o'));
    warnSpy.mockRestore();
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
    mockCreate.mockResolvedValue({ id: 'ledger-1' });
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

  it('creates the ledger row via Prisma with the mapped payload', async () => {
    await trackPipelineCost(baseParams);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        pipelineName: 'brand-intelligence',
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        runId: 'run-001',
        model: 'claude-haiku-4-5',
        inputTokens: 500,
        outputTokens: 1000,
        costUsd: 0.000625,
      },
    });
  });

  it('accepts null client_id for board-level pipelines', async () => {
    await trackPipelineCost({ ...baseParams, client_id: null });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientId: null }),
    });
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

  it('does not throw when the ledger write rejects', async () => {
    mockCreate.mockRejectedValue(new Error('DB down'));
    await expect(trackPipelineCost(baseParams)).resolves.toBeUndefined();
  });

  it('logs error event on write failure', async () => {
    mockCreate.mockRejectedValue(new Error('DB down'));
    await trackPipelineCost(baseParams);
    const errorLog = JSON.parse((console.error as jest.Mock).mock.calls[0][0]);
    expect(errorLog.event).toBe('pipeline_cost_ledger_write_failed');
    expect(errorLog.error).toBe('DB down');
  });

  it('still writes info log even when DB fails', async () => {
    mockCreate.mockRejectedValue(new Error('fail'));
    await trackPipelineCost(baseParams);
    expect(console.info).toHaveBeenCalledTimes(1);
  });
});
