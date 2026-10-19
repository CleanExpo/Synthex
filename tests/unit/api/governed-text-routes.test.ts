/**
 * @jest-environment node
 *
 * P5 / M10 — the paid text call in each route goes through the Governor.
 *
 * SEAM: each route's exported POST handler, called with a request. Catches a
 * route that reaches its provider without the Governor, a route that writes a
 * second ledger row for the same call, a receipt priced on the wrong usage, and
 * a changed HTTP response in shadow mode. Misses: real provider/network
 * behaviour (the provider SDKs are the faked boundary) and enforcing-mode
 * refusals (see governed-text-routes-enforcing.test.ts).
 *
 * Faked boundaries only: Prisma, logger, key decryption, auth wrappers, the
 * provider SDKs and the edge-function runner's log sink. The Governor, its
 * receipt writer and the route helpers run for real. Every test installs its
 * mocks in beforeEach (jest.worktree.cjs sets resetMocks: true).
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  hermesConfig: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn(), findMany: jest.fn() },
  gBPReview: { findMany: jest.fn(), update: jest.fn() },
  recommendedAction: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  runnerFlag: { findMany: jest.fn() },
  aPICredential: { findMany: jest.fn() },
  orgBudgetPolicy: { findUnique: jest.fn() },
  pipelineCostLedger: { groupBy: jest.fn(), create: jest.fn() },
};
// Models the routes read only for context fall back to empty results; the
// models above are the ones the assertions depend on.
const emptyModel = {
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  count: async () => 0,
  groupBy: async () => [],
  aggregate: async () => ({ _avg: {}, _sum: {}, _count: 0 }),
};
const prismaWithDefaults = new Proxy(mockPrisma as Record<string, unknown>, {
  get: (target, name: string) => target[name] ?? emptyModel,
});
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: prismaWithDefaults,
  prisma: prismaWithDefaults,
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/lib/encryption/api-key-encryption', () => ({
  decryptApiKey: jest.fn(),
}));

const mockTrackCost = jest.fn();
jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: (...a: unknown[]) => mockTrackCost(...a),
}));

jest.mock('@/lib/auth/with-auth', () => ({
  withAuth:
    (handler: (req: unknown, auth: unknown) => unknown) => (req: unknown) =>
      handler(req, { userId: 'user-1', clientId: 'org-A', role: 'owner' }),
}));
jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: () => ({ ok: true }),
}));
jest.mock('@/lib/pipelines/runner', () => ({
  createEdgeFunctionRunner: (
    _name: string,
    fn: (input: unknown, clientId: string) => Promise<unknown>
  ) => ({
    run: async (inputs: Array<{ clientId: string; input: unknown }>) => ({
      runId: 'run-1',
      status: 'completed',
      clientsProcessed: inputs.length,
      clientsFailed: 0,
      durationMs: 1,
      outputs: await Promise.all(
        inputs.map(async i => ({
          clientId: i.clientId,
          output: await fn(i.input, i.clientId),
        }))
      ),
    }),
  }),
}));
jest.mock('@/lib/algorithm/algorithm-context', () => ({
  getAlgorithmContextBlock: async () => '',
}));
jest.mock('@/lib/knowledge-query', () => ({
  queryKnowledge: async () => [],
  formatKnowledgeContext: () => '',
}));
jest.mock('@/lib/intelligence/accuracy-ledger', () => ({
  recordScoreIssued: async () => ({ recorded: true }),
}));

// Provider boundaries. Usage numbers are literals the receipt must echo.
const mockComplete = jest.fn();
jest.mock('@/lib/ai/providers/anthropic-provider', () => ({
  AnthropicProvider: class {
    complete(...a: unknown[]) {
      return mockComplete(...a);
    }
  },
}));
const mockMessagesCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class {
    messages = { create: (...a: unknown[]) => mockMessagesCreate(...a) };
  },
}));

import { POST as nextStepsPOST } from '@/app/api/brand-iq/next-steps/route';
import { POST as freshnessPOST } from '@/app/api/internal/algorithm-freshness-monitor/route';
import { POST as advisorPOST } from '@/app/api/internal/generate-advisor-brief/route';
import { POST as reviewPOST } from '@/app/api/internal/generate-review-responses/route';
import { POST as askPOST } from '@/app/api/ask-synthex/route';
import { decryptApiKey } from '@/lib/encryption/api-key-encryption';

const USAGE_IN = 1234;
const USAGE_OUT = 567;

function completion(content: string, model: string) {
  return {
    id: 'msg_1',
    model,
    choices: [
      { message: { role: 'assistant', content }, finish_reason: 'stop' },
    ],
    usage: {
      prompt_tokens: USAGE_IN,
      completion_tokens: USAGE_OUT,
      total_tokens: USAGE_IN + USAGE_OUT,
    },
  };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockPrisma.hermesConfig.findUnique.mockResolvedValue({ brandSlug: 'ra' });
  mockPrisma.organization.findUnique.mockResolvedValue({
    slug: 'org-a-slug',
    name: 'Org A',
    industry: 'plumbing',
    timezone: 'Australia/Brisbane',
  });
  mockPrisma.organization.findMany.mockResolvedValue([
    { id: 'org-A', name: 'Org A' },
  ]);
  mockPrisma.gBPReview.findMany.mockResolvedValue([
    { id: 'rev-1', reviewerName: 'Sam', rating: 5, comment: 'Great job' },
  ]);
  mockPrisma.gBPReview.update.mockResolvedValue({});
  mockPrisma.recommendedAction.findUnique.mockResolvedValue(null);
  mockPrisma.recommendedAction.findMany.mockResolvedValue([]);
  mockPrisma.recommendedAction.create.mockResolvedValue({});
  // Shadow mode: no flag / key / budget rows, so every gate "would refuse" and
  // the call must still run, with exactly one receipt.
  mockPrisma.runnerFlag.findMany.mockResolvedValue([]);
  mockPrisma.aPICredential.findMany.mockResolvedValue([]);
  mockPrisma.orgBudgetPolicy.findUnique.mockResolvedValue(null);
  mockPrisma.pipelineCostLedger.groupBy.mockResolvedValue([]);
  mockPrisma.pipelineCostLedger.create.mockResolvedValue({ id: 'ledger_1' });
  (decryptApiKey as jest.Mock).mockReturnValue('BRAND-OWN-KEY-PLACEHOLDER');
  mockTrackCost.mockResolvedValue(undefined);
  process.env.OPENROUTER_API_KEY = 'PLACEHOLDER-NOT-A-KEY';
  process.env.ANTHROPIC_API_KEY = 'PLACEHOLDER-NOT-A-KEY';
  process.env.FIRECRAWL_API_KEY = 'PLACEHOLDER-NOT-A-KEY';
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

/** The one ledger row written for the call, asserting there is exactly one. */
function onlyReceipt(): Record<string, unknown> {
  const rows = mockPrisma.pipelineCostLedger.create.mock.calls;
  expect(rows).toHaveLength(1);
  return rows[0][0].data as Record<string, unknown>;
}

function expectReceipt(
  row: Record<string, unknown>,
  expected: {
    runner: string;
    model: string;
    clientId: string;
    brandSlug: string;
  }
) {
  expect(row).toMatchObject({
    clientId: expected.clientId,
    pipelineName: expected.runner,
    runner: expected.runner,
    brandSlug: expected.brandSlug,
    provider: expect.any(String),
    model: expected.model,
    inputTokens: USAGE_IN,
    outputTokens: USAGE_OUT,
    outcome: 'completed',
  });
  expect(mockTrackCost).not.toHaveBeenCalled();
}

describe('paid text calls go through the Governor (shadow mode)', () => {
  it('brand-iq/next-steps: one receipt, same response, provider usage priced', async () => {
    mockComplete.mockResolvedValue(
      completion('["a.","b.","c."]', 'claude-haiku-4-5-20251001')
    );
    const res = await nextStepsPOST(
      createMockNextRequest({
        method: 'POST',
        body: {
          voiceScore: 80,
          resonanceScore: 70,
          topAttributes: ['x'],
          bestWindow: 'Tue 9am',
          userId: 'attacker-supplied',
          organizationId: 'org-attacker',
        },
      }) as never
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nextSteps: ['a.', 'b.', 'c.'] });
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expectReceipt(onlyReceipt(), {
      runner: 'brand-iq-next-steps',
      model: 'claude-haiku-4-5-20251001',
      clientId: 'org-A',
      brandSlug: 'ra',
    });
  });

  it('brand-iq/next-steps: provider failure keeps the route 500 and still leaves one receipt', async () => {
    mockComplete.mockRejectedValue(new Error('upstream 529'));
    const res = await nextStepsPOST(
      createMockNextRequest({
        method: 'POST',
        body: { voiceScore: 1 },
      }) as never
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'Failed to generate next steps',
    });
    expect(onlyReceipt()).toMatchObject({ outcome: 'failed_provider_error' });
  });

  it('internal/algorithm-freshness-monitor: one receipt per provider call', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            title: 'Core update ranking algorithm change',
            description: 'ranking algorithm core update signal',
            url: 'https://example.invalid/a',
          },
        ],
      }),
    } as Response);
    mockComplete.mockResolvedValue(
      completion('{"detected":false}', 'claude-haiku-4-5-20251001')
    );
    const res = await freshnessPOST(
      createMockNextRequest({
        method: 'POST',
        body: { platform: 'google_search' },
      }) as never
    );
    expect(res.status).toBe(200);
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expectReceipt(onlyReceipt(), {
      runner: 'internal-algorithm-freshness-monitor',
      model: 'claude-haiku-4-5-20251001',
      clientId: 'system',
      brandSlug: 'synthex',
    });
  });

  it('internal/generate-advisor-brief: one receipt for the org', async () => {
    const actions = [1, 2, 3].map(n => ({
      title: `Action ${n}`,
      rationale: `Posts fell ${n}0% last week`,
      effort: 'low',
      expectedImpact: '2 more enquiries',
    }));
    mockComplete.mockResolvedValue(
      completion(JSON.stringify(actions), 'claude-sonnet-4-6')
    );
    const res = await advisorPOST(
      createMockNextRequest({
        method: 'POST',
        body: { organizationId: 'org-A' },
      }) as never
    );
    expect(res.status).toBe(200);
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expectReceipt(onlyReceipt(), {
      runner: 'internal-generate-advisor-brief',
      model: 'claude-sonnet-4-6',
      clientId: 'org-A',
      brandSlug: 'ra',
    });
  });

  it('internal/generate-review-responses: one receipt per review drafted', async () => {
    mockComplete.mockResolvedValue(
      completion(
        '{"suggestion":"Thanks Sam!","confidence":0.9}',
        'claude-haiku-4-5-20251001'
      )
    );
    const res = await reviewPOST(
      createMockNextRequest({ method: 'POST', body: {} }) as never
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, responses_drafted: 1 });
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expectReceipt(onlyReceipt(), {
      runner: 'internal-generate-review-responses',
      model: 'claude-haiku-4-5-20251001',
      clientId: 'org-A',
      brandSlug: 'ra',
    });
  });

  it('ask-synthex: one receipt, and the router no longer writes a second row', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Post on Tuesdays.' }],
      usage: { input_tokens: USAGE_IN, output_tokens: USAGE_OUT },
    });
    const prevFlag = process.env.ENABLE_ASK_SYNTHEX_CLIENT_ROLLOUT;
    process.env.ENABLE_ASK_SYNTHEX_CLIENT_ROLLOUT = 'true';
    const res = await askPOST(
      createMockNextRequest({
        method: 'POST',
        body: { question: 'When should I post?' },
      }) as never
    );
    process.env.ENABLE_ASK_SYNTHEX_CLIENT_ROLLOUT = prevFlag;
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      answer: 'Post on Tuesdays.',
      answered: true,
    });
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    expectReceipt(onlyReceipt(), {
      runner: 'ask-synthex',
      model: expect.stringMatching(/^anthropic\//) as unknown as string,
      clientId: 'org-A',
      brandSlug: 'ra',
    });
  });

  it('control: planted second ledger write is caught by the one-row check', async () => {
    mockComplete.mockResolvedValue(
      completion('["a.","b.","c."]', 'claude-haiku-4-5-20251001')
    );
    await nextStepsPOST(
      createMockNextRequest({
        method: 'POST',
        body: { voiceScore: 1 },
      }) as never
    );
    // The defect an old route had: the Governor receipt plus its own row.
    mockPrisma.pipelineCostLedger.create.mockClear();
    mockPrisma.pipelineCostLedger.create({ data: { planted: true } });
    mockPrisma.pipelineCostLedger.create({ data: { planted: true } });
    expect(() => onlyReceipt()).toThrow();
  });
});
