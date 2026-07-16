/**
 * Unit tests — RA-3028 Brand IQ next-steps provider-layer edges
 *
 * Pins the behaviour deltas introduced by routing this route through
 * AnthropicProvider instead of a direct @anthropic-ai/sdk client:
 *  - multi-text-block responses are joined ('' separator) before JSON.parse
 *  - a missing usage block skips the cost-ledger write entirely (fail closed —
 *    no zero-cost rows)
 *  - a missing API key rejects before any SDK call or ledger write
 */

// ── next/server mock ──────────────────────────────────────────────────────────

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    private _body: string;

    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
    }

    json() {
      return Promise.resolve(JSON.parse(this._body));
    }

    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: class extends Request {},
  };
});

// ── Auth + rate-limit mocks ───────────────────────────────────────────────────

jest.mock('@/lib/auth/with-auth', () => ({
  withAuth: (handler: (req: unknown, auth: { userId: string }) => unknown) => {
    return async (req: unknown) => handler(req, { userId: 'user-42' });
  },
}));

jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));

// ── Cost-ledger mock ──────────────────────────────────────────────────────────

const mockTrackPipelineCost = jest.fn();

jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: (...args: unknown[]) => mockTrackPipelineCost(...args),
}));

// ── Anthropic SDK mock (class-shaped, mutable apiKey) ─────────────────────────

const mockAnthropicCreate = jest.fn();
let mockApiKey = 'test-key';

jest.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    apiKey = mockApiKey;
    messages = { create: mockAnthropicCreate };
    static APIError = class MockAPIError extends Error {};
  }
  return { __esModule: true, default: MockAnthropic };
});

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { createMockNextRequest } from '../../helpers/mock-request';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest() {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/brand-iq/next-steps',
    body: {
      voiceScore: 80,
      resonanceScore: 65,
      topAttributes: ['friendly', 'local'],
      bestWindow: 'Tue 6-8pm',
    },
  });
}

function sdkMessage(
  content: Array<{ type: string; text?: string }>,
  usage?: { input_tokens: number; output_tokens: number }
) {
  return {
    id: 'msg_test',
    model: 'claude-haiku-4-5-20251001',
    stop_reason: 'end_turn',
    content,
    ...(usage ? { usage } : {}),
  };
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockApiKey = 'test-key';
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.warn as jest.Mock).mockRestore();
  (console.error as jest.Mock).mockRestore();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/brand-iq/next-steps — provider-layer edges (RA-3028)', () => {
  it('joins multiple text blocks before parsing (provider delta vs old content[0])', async () => {
    mockAnthropicCreate.mockResolvedValue(
      sdkMessage(
        [
          { type: 'text', text: '["Post during Tue 6-8pm.",' },
          { type: 'text', text: '"Lean on friendly captions.",' },
          { type: 'text', text: '"Replicate last top post."]' },
        ],
        { input_tokens: 100, output_tokens: 40 }
      )
    );

    const { POST } = await import('@/app/api/brand-iq/next-steps/route');
    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.nextSteps).toEqual([
      'Post during Tue 6-8pm.',
      'Lean on friendly captions.',
      'Replicate last top post.',
    ]);
    expect(mockTrackPipelineCost).toHaveBeenCalledTimes(1);
    expect(mockTrackPipelineCost.mock.calls[0][0]).toMatchObject({
      pipeline_name: 'brand-iq-next-steps',
      input_tokens: 100,
      output_tokens: 40,
    });
  });

  it('skips the cost-ledger write when the provider returns no usage (fail closed)', async () => {
    mockAnthropicCreate.mockResolvedValue(
      sdkMessage([{ type: 'text', text: '["A.","B.","C."]' }])
    );

    const { POST } = await import('@/app/api/brand-iq/next-steps/route');
    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.nextSteps).toEqual(['A.', 'B.', 'C.']);
    expect(mockTrackPipelineCost).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('skipping cost-ledger write'),
      expect.objectContaining({ runId: expect.any(String) })
    );
  });

  it('returns 500 and writes no ledger row when the API key is missing', async () => {
    mockApiKey = '';

    const { POST } = await import('@/app/api/brand-iq/next-steps/route');
    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to generate next steps');
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
    expect(mockTrackPipelineCost).not.toHaveBeenCalled();
  });
});
