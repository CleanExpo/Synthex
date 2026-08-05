/**
 * /api/cron/autopilot — a regeneration attempt must earn its place in the budget.
 *
 * MEASURED CAUSE (production)
 * The attempt loop breaks only on `gate.decision === 'schedule'`. Disaster
 * Recovery — the only organisation autopilot actually runs — has
 * auto_approve_threshold = 100, against an observed score range of 73-85 across
 * the 14 posts of the one run that ever completed. `schedule` therefore never
 * occurs, the break never fires, and EVERY slot spends both attempts.
 *
 * Confirmed two ways, independently:
 *   model_metrics vs posts created, week 2026-08-03:  75 calls / 37 posts = 2.03
 *                                    week 2026-07-27: 166 calls / 81 posts = 2.05
 *   and the terminal-status test, which recorded 28 generateContent calls for
 *   14 planned slots.
 *
 * That is the timeout: 14 slots x 2 calls x ~10 s = ~280 s against a 300 s
 * ceiling, which is why the job missed by seconds rather than minutes and why
 * exactly one night in twenty happened to fit.
 *
 * THE FIX IS NOT TO DELETE THE RETRY. Best-of-two is a real quality mechanism:
 * the loop keeps the higher-scoring draw. It is simply not affordable for every
 * slot. So a retry now runs only while the run can still finish every REMAINING
 * slot without it — quality when there is room, throughput guaranteed when there
 * is not. A rejected draw always retries, because escaping `reject` is the
 * loop's actual purpose.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  autopilotConfig: { findMany: jest.fn(), update: jest.fn() },
  autopilotRun: { create: jest.fn(), update: jest.fn() },
  campaign: { findFirst: jest.fn(), create: jest.fn() },
  post: { create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockPlanDailyContent = jest.fn();
jest.mock('@/lib/autopilot/daily-planner', () => ({
  planDailyContent: (...a: unknown[]) => mockPlanDailyContent(...a),
}));

const mockGenerateContent = jest.fn();
jest.mock('@/lib/ai/content-generator', () => ({
  AIContentGenerator: class {
    generateContent = (...a: unknown[]) => mockGenerateContent(...a);
  },
}));

const mockEvaluateContent = jest.fn();
jest.mock('@/lib/autopilot/quality-gate', () => ({
  evaluateContent: (...a: unknown[]) => mockEvaluateContent(...a),
  scoreDimensions: () => ({ engagement: 70 }),
}));
jest.mock('@/lib/ml/posting-time-predictor', () => ({
  postingTimePredictor: {
    getOptimalTimes: jest.fn().mockResolvedValue({ topSlot: { hour: 9 } }),
  },
}));
jest.mock('@/lib/autopilot/grounded-post-image', () => ({
  attachGroundedImage: jest
    .fn()
    .mockResolvedValue({ status: 'draft', images: [], meta: {} }),
}));

import { GET } from '@/app/api/cron/autopilot/route';

const req = () =>
  createMockNextRequest({ url: 'http://localhost/api/cron/autopilot' });

/**
 * A clock that advances only when WORK happens, not on every read.
 *
 * The per-read clock used in the terminal-status test is fine for proving the
 * guard fires, but it charges time for merely looking — so adding a budget
 * calculation would itself cost simulated seconds and the arithmetic here would
 * measure the harness. Charging per LLM call instead mirrors production, where
 * the generateContent round trip is the cost and reading Date.now is free.
 */
function installCallClock(msPerCall: number) {
  let now = 1_760_000_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockGenerateContent.mockImplementation(async () => {
    now += msPerCall;
    return { content: 'Generated copy.' };
  });
}

function drConfig(autoApproveThreshold = 100) {
  return {
    id: 'cfg-dr',
    organizationId: 'org-dr',
    enabled: true,
    enabledPlatforms: ['linkedin', 'reddit'],
    planningHorizonDays: 7,
    postsPerDayPerPlatform: 1,
    contentMix: {},
    autoApproveThreshold,
    minScoreThreshold: 65,
    organization: {
      id: 'org-dr',
      name: 'Disaster Recovery',
      industry: 'restoration',
      brandDna: null,
      users: [{ id: 'user-1' }],
      teamMembers: [{ userId: 'user-1', role: 'owner' }],
    },
  };
}

const slots = (n: number) => ({
  slots: Array.from({ length: n }, (_, i) => ({
    platform: i % 2 === 0 ? 'linkedin' : 'reddit',
    date: new Date('2026-08-06T00:00:00Z'),
    theme: 'educational',
  })),
});

const terminalRunUpdate = () => {
  const calls = mockPrisma.autopilotRun.update.mock.calls;
  return calls[calls.length - 1]?.[0];
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true });
  mockPrisma.autopilotConfig.findMany.mockResolvedValue([drConfig()]);
  mockPrisma.autopilotConfig.update.mockResolvedValue({});
  mockPrisma.autopilotRun.create.mockResolvedValue({ id: 'run-1' });
  mockPrisma.autopilotRun.update.mockResolvedValue({});
  mockPrisma.campaign.findFirst.mockResolvedValue({ id: 'camp-1' });
  mockPrisma.post.create.mockImplementation(() =>
    Promise.resolve({ id: `post-${Math.random()}` })
  );
  mockPlanDailyContent.mockResolvedValue(slots(14));
  mockEvaluateContent.mockReturnValue({ decision: 'draft', score: 78 });
});

afterEach(() => jest.restoreAllMocks());

describe("Disaster Recovery's real nightly workload", () => {
  it('completes all 14 slots inside the ceiling', async () => {
    installCallClock(10_000); // measured gpt-4o-mini latency, 7.3-15.7 s

    const res = await GET(req());
    expect(res.status).toBe(200);

    const update = terminalRunUpdate();

    // THE OUTCOME THAT MATTERS. Before this fix, 14 slots x 2 calls x 10 s
    // needed ~280 s of LLM time alone and the run was truncated every night.
    expect(update.data.status).toBe('completed');
    expect(update.data.postsGenerated).toBe(14);

    // And it got there by not spending two calls on every slot.
    expect(mockGenerateContent.mock.calls.length).toBeLessThan(28);
  });

  it('never lets the run exceed the ceiling', async () => {
    installCallClock(10_000);
    await GET(req());
    expect(terminalRunUpdate().data.durationMs).toBeLessThan(300_000);
  });
});

describe('the retry is preserved where it pays', () => {
  it('always retries a REJECTED draw — escaping reject is its purpose', async () => {
    installCallClock(10_000);
    mockPlanDailyContent.mockResolvedValue(slots(1));
    mockEvaluateContent.mockReturnValue({ decision: 'reject', score: 40 });

    await GET(req());

    // One slot, rejected: both attempts must be spent regardless of budget
    // arithmetic, or genuinely poor content gets one roll of the dice.
    expect(mockGenerateContent.mock.calls.length).toBe(2);
  });

  it('keeps best-of-two when the budget comfortably allows it', async () => {
    installCallClock(10_000);
    mockPlanDailyContent.mockResolvedValue(slots(2)); // 2 slots, 300 s budget

    await GET(req());

    // Ample headroom, so the quality mechanism survives: 2 slots x 2 calls.
    // Without this assertion the "fix" could be a blanket deletion of the
    // retry, which would pass every other test in this file.
    expect(mockGenerateContent.mock.calls.length).toBe(4);
    expect(terminalRunUpdate().data.postsGenerated).toBe(2);
  });

  it('still breaks immediately when a draw is auto-approved', async () => {
    installCallClock(10_000);
    mockPlanDailyContent.mockResolvedValue(slots(2));
    mockEvaluateContent.mockReturnValue({ decision: 'schedule', score: 92 });

    await GET(req());

    // A scheduled draw is optimal; there is nothing to improve on.
    expect(mockGenerateContent.mock.calls.length).toBe(2);
  });
});
