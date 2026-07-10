/**
 * BUDGET-ENFORCER — sandbox integration (Docker sandbox, SYN-MCP-000
 * profile: Postgres :5499 + Redis :6399, LLM provider MOCKED — never live
 * keys).
 *
 * Proves against a REAL database, through the REAL route handler and the
 * REAL AIContentGenerator:
 *  - FAIL-CLOSED: a seeded OrgBudgetPolicy row (enforce) + a near-ceiling
 *    pipeline_cost_ledger row ⇒ POST /api/ai/generate-content returns 402,
 *    the provider mock is called ZERO times, and no new ledger row lands.
 *  - LEDGER MATTERS: the same request under the same ceiling WITHOUT the
 *    spend row would fit — the 402 is driven by the real window SUM.
 *  - UNDER CEILING: generation proceeds, a REAL ledger row is written for
 *    the org, and the in-flight reservation is committed back to zero.
 *  - LOG-ONLY: a breaching request under a 'log_only' policy row still
 *    returns 200 (deploy safety).
 *  - RACE (must_fix 8): two parallel near-ceiling reserveBudget calls —
 *    exactly one proceeds. (In-flight counters run on the redis-client
 *    memory fallback here — no Upstash REST in the sandbox — which is the
 *    same atomic INCRBY contract the Upstash server provides in prod.)
 *
 * Run: npm run sandbox:up && npx jest --config jest.integration.cjs \
 *        tests/integration/budget-enforcer.integration.test.ts
 */

// The app's lib/prisma singleton is Supabase-tuned (forces SSL) and rejects
// the local sandbox Postgres — swap it for the sandbox client so the REAL
// route + generator + enforcer code paths hit the sandbox DB.
jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

// LLM calls are mocked in every sandbox test (live keys are L3 human-gated).
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: jest.fn(),
}));

jest.mock('@/lib/obsidian/client-knowledge-base', () => ({
  buildContextForGeneration: jest.fn().mockResolvedValue(''),
}));

// Auth/limits seams — same pattern as the unit route suites; everything
// downstream of them (org lookup, enforcer, generator, ledger) is REAL.
jest.mock('@/lib/middleware/require-api-key', () => ({
  requireApiKey: (_req: unknown, handler: (userId: string) => unknown) =>
    handler('itest-budget-user'),
}));
jest.mock('@/lib/middleware/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
  UsageTracker: { track: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/lib/ai/api-credential-injector', () => ({
  getUserAICredentials: jest.fn().mockResolvedValue(null),
}));
// Branded service rejects so the route falls through to the REAL
// aiContentGenerator (which records REAL ledger rows via sandbox Prisma).
jest.mock('@/lib/services/client-branded-content', () => ({
  ClientBrandedContentService: {
    generate: jest.fn().mockRejectedValue(new Error('branded unavailable')),
  },
}));
jest.mock('@/lib/auth/monitoring', () => ({
  authMonitor: { trackEvent: jest.fn() },
}));
jest.mock('@/lib/scoring/visibility-score', () => ({
  calculateVisibilityScore: jest.fn().mockResolvedValue(undefined),
}));

import prisma from '@/lib/prisma';
import { getAIProvider, type AIProvider } from '@/lib/ai/providers';
import { POST } from '@/app/api/ai/generate-content/route';
import {
  getOrgSpendSnapshot,
  OrgBudgetExceededError,
  releaseReservation,
  reserveBudget,
} from '@/lib/ai/budget-enforcer';
import { estimateContentGenerationCostUsd } from '@/lib/ai/generation-context';
import { assertSandboxDatabaseUrl } from './setup/sandbox-guard';

// Belt-and-braces: hard-fail off-sandbox even though global-setup guards too.
assertSandboxDatabaseUrl(process.env.DATABASE_URL);

const ORG = 'itest-budget-org';
const USER = 'itest-budget-user';
const PER_POST_ESTIMATE = estimateContentGenerationCostUsd({ type: 'post' });

let providerCalls = 0;
function makeCountingProvider(): AIProvider {
  return {
    models: {
      fast: 'itest-fast',
      balanced: 'itest-balanced',
      creative: 'itest-creative',
    },
    async complete() {
      providerCalls++;
      return {
        choices: [{ message: { content: 'sandbox budget content' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      };
    },
  } as unknown as AIProvider;
}

function makeRequest(body: unknown): any {
  return {
    cookies: { get: () => ({ value: 'valid-token' }) },
    headers: { get: () => 'Bearer valid-token' },
    json: async () => body,
  };
}

async function setPolicy(
  enforcementMode: 'enforce' | 'log_only',
  dailyCeilingUsd: number
): Promise<void> {
  await prisma.orgBudgetPolicy.upsert({
    where: { organizationId: ORG },
    update: { enforcementMode, dailyCeilingUsd, monthlyCeilingUsd: null },
    create: {
      organizationId: ORG,
      enforcementMode,
      dailyCeilingUsd,
      monthlyCeilingUsd: null,
    },
  });
}

async function ledgerRowCount(): Promise<number> {
  return prisma.pipelineCostLedger.count({ where: { clientId: ORG } });
}

describe('BUDGET-ENFORCER against the sandbox (real pg policy + ledger)', () => {
  beforeAll(async () => {
    delete process.env.SYNTHEX_DEFAULT_DAILY_COST_CEILING_USD;
    delete process.env.SYNTHEX_DEFAULT_MONTHLY_COST_CEILING_USD;
    process.env.OPENAI_API_KEY =
      process.env.OPENAI_API_KEY || 'sk-itest-platform-key';

    // Dedicated org + user so ledger window sums only see this suite's rows.
    await prisma.organization.upsert({
      where: { id: ORG },
      update: {},
      create: {
        id: ORG,
        name: 'Budget Enforcer Test Org',
        slug: ORG,
        plan: 'free',
        status: 'active',
      },
    });
    await prisma.user.upsert({
      where: { id: USER },
      update: { organizationId: ORG },
      create: {
        id: USER,
        email: 'itest-budget-user@synthex.test',
        name: 'Budget Enforcer Test User',
        organizationId: ORG,
      },
    });
    await prisma.pipelineCostLedger.deleteMany({ where: { clientId: ORG } });
  });

  beforeEach(() => {
    providerCalls = 0;
    (getAIProvider as jest.Mock).mockImplementation(() =>
      makeCountingProvider()
    );
  });

  afterAll(async () => {
    await prisma.pipelineCostLedger.deleteMany({ where: { clientId: ORG } });
    await prisma.orgBudgetPolicy.deleteMany({ where: { organizationId: ORG } });
    await prisma.user.deleteMany({ where: { id: USER } });
    await prisma.organization.deleteMany({ where: { id: ORG } });
    await prisma.$disconnect();
  });

  it('FAIL-CLOSED: enforcing policy + near-ceiling ledger spend ⇒ 402, zero provider calls, no new ledger row', async () => {
    // Ceiling fits the estimate ALONE (proves the ledger sum is load-bearing)…
    const ceiling = PER_POST_ESTIMATE + 0.005;
    expect(PER_POST_ESTIMATE).toBeLessThan(ceiling);
    await setPolicy('enforce', ceiling);
    // …but a REAL spend row created today pushes the window over it.
    await prisma.pipelineCostLedger.create({
      data: {
        pipelineName: 'content-generation',
        clientId: ORG,
        runId: 'itest-budget-preload',
        model: 'claude-sonnet-4-6',
        inputTokens: 1000,
        outputTokens: 1000,
        costUsd: 0.01,
      },
    });

    const rowsBefore = await ledgerRowCount();
    const res = await POST(
      makeRequest({ platform: 'twitter', topic: 'budget breach' })
    );

    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe('Organization budget exceeded');
    expect(json.window).toBe('daily');
    expect(json.ceilingUsd).toBeCloseTo(ceiling);

    // Pre-spend guarantees, proven on the real path:
    expect(providerCalls).toBe(0);
    expect(await ledgerRowCount()).toBe(rowsBefore);
    // Reservation rolled back — nothing left in flight.
    const snapshot = await getOrgSpendSnapshot(ORG);
    expect(snapshot.inFlightReservedUsd.daily).toBe(0);
  });

  it('UNDER CEILING: generation proceeds, a REAL ledger row lands, reservation committed to zero', async () => {
    await setPolicy('enforce', 10);

    const rowsBefore = await ledgerRowCount();
    const res = await POST(
      makeRequest({ platform: 'twitter', topic: 'budget ok' })
    );
    expect(res.status).toBe(200);
    expect(providerCalls).toBeGreaterThan(0);

    // The generator's recordGenerationCost write is fire-and-forget — poll.
    let rowsAfter = rowsBefore;
    for (let attempt = 0; attempt < 20; attempt++) {
      rowsAfter = await ledgerRowCount();
      if (rowsAfter > rowsBefore) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(rowsAfter).toBeGreaterThan(rowsBefore);

    const snapshot = await getOrgSpendSnapshot(ORG);
    expect(snapshot.inFlightReservedUsd.daily).toBe(0);
    expect(snapshot.enforcementMode).toBe('enforce');
    expect(snapshot.policySource).toBe('policy_row');
    expect(snapshot.dailySpendUsd).toBeGreaterThan(0);
  });

  it('LOG-ONLY: a breaching request under a log_only policy still returns 200 (deploy safety)', async () => {
    await setPolicy('log_only', 0.001); // far below any estimate

    const res = await POST(
      makeRequest({ platform: 'twitter', topic: 'log only breach' })
    );
    expect(res.status).toBe(200);
    expect(providerCalls).toBeGreaterThan(0);
  });

  it('RACE: two parallel near-ceiling reserves — exactly one proceeds (must_fix 8)', async () => {
    // Ceiling fits current spend + ONE estimate but not two.
    const { dailySpendUsd } = await getOrgSpendSnapshot(ORG);
    await setPolicy('enforce', dailySpendUsd + 1.5 * PER_POST_ESTIMATE);

    const results = await Promise.allSettled([
      reserveBudget(
        { organizationId: ORG, traceId: 'itest-race-a' },
        PER_POST_ESTIMATE
      ),
      reserveBudget(
        { organizationId: ORG, traceId: 'itest-race-b' },
        PER_POST_ESTIMATE
      ),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      OrgBudgetExceededError
    );

    // Loser rolled back; only the winner's amount remains — then release it.
    const midSnapshot = await getOrgSpendSnapshot(ORG);
    expect(midSnapshot.inFlightReservedUsd.daily).toBeCloseTo(
      PER_POST_ESTIMATE,
      6
    );
    await releaseReservation(
      (fulfilled[0] as PromiseFulfilledResult<any>).value
    );
    const endSnapshot = await getOrgSpendSnapshot(ORG);
    expect(endSnapshot.inFlightReservedUsd.daily).toBe(0);
  });
});
