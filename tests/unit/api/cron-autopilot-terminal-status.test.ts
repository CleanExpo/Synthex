/**
 * /api/cron/autopilot — a run must ALWAYS reach a terminal status.
 *
 * MEASURED CAUSE (production, 2026-07-17 → 2026-08-05)
 * Nineteen consecutive nightly runs died at exactly 300,000 ms — the Vercel
 * function ceiling. `autopilotRun.update({ status: 'completed' | 'failed' })`
 * sits AFTER the slot loop, so a run killed inside that loop never reaches it
 * and is left at status='running' forever. Only ops.watchdog()'s reaper ever
 * marked them failed, an hour later, from outside the application.
 *
 * Worse, and invisible until measured: those "failed" runs had really generated
 * 10-13 posts each. The counters live in local variables written to the run row
 * only at the end, so the work existed in `posts` while the run reported
 * posts_generated = 0. Twelve nights of orphaned drafts with no run to attribute
 * them to.
 *
 * The fix is a time budget: stop starting slots once the remaining budget
 * cannot fit another, then finalise. These tests lock the three terminal paths
 * required by Task 3.3 — success, thrown error, and exhausted budget — each of
 * which must leave a terminal row carrying the work actually done.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  autopilotConfig: { findMany: jest.fn(), update: jest.fn() },
  autopilotRun: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
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

// Dynamic imports inside generateSlotContent. Both are wrapped in try/catch
// there, but mocking them keeps the test measuring the loop rather than the ML.
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

/** Disaster Recovery's real production shape: 2 platforms x 1/day x 7 days. */
function drConfig() {
  return {
    id: 'cfg-dr',
    organizationId: 'org-dr',
    enabled: true,
    enabledPlatforms: ['linkedin', 'reddit'],
    planningHorizonDays: 7,
    postsPerDayPerPlatform: 1,
    contentMix: {},
    autoApproveThreshold: 100, // production value — unreachable on purpose
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

function slots(n: number) {
  return {
    slots: Array.from({ length: n }, (_, i) => ({
      platform: i % 2 === 0 ? 'linkedin' : 'reddit',
      date: new Date('2026-08-06T00:00:00Z'),
      theme: 'educational',
    })),
  };
}

/**
 * Advance a fake clock by `stepMs` on every read after the first.
 * Production measured 19.5-25.9 s per slot; 25 s is the observed p95.
 */
function installClock(stepMs: number) {
  let now = 1_760_000_000_000;
  const spy = jest.spyOn(Date, 'now').mockImplementation(() => {
    const v = now;
    now += stepMs;
    return v;
  });
  return spy;
}

/** The single terminal update on the run row (status + counters). */
function terminalRunUpdate() {
  const calls = mockPrisma.autopilotRun.update.mock.calls;
  return calls.length ? calls[calls.length - 1][0] : undefined;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true });
  mockPrisma.autopilotConfig.findMany.mockResolvedValue([drConfig()]);
  mockPrisma.autopilotConfig.update.mockResolvedValue({});
  mockPrisma.autopilotRun.create.mockResolvedValue({ id: 'run-1' });
  mockPrisma.autopilotRun.update.mockResolvedValue({});
  mockPrisma.autopilotRun.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.campaign.findFirst.mockResolvedValue({ id: 'camp-1' });
  mockPrisma.post.create.mockImplementation(() =>
    Promise.resolve({ id: `post-${Math.random()}` })
  );
  mockPlanDailyContent.mockResolvedValue(slots(14));
  mockGenerateContent.mockResolvedValue({ content: 'Generated copy.' });
  mockEvaluateContent.mockReturnValue({ decision: 'draft', score: 78 });
});

afterEach(() => jest.restoreAllMocks());

describe('terminal status — success', () => {
  it('finalises the run with a terminal status and the real counters', async () => {
    installClock(1_000); // fast: whole run well inside budget

    const res = await GET(req());
    expect(res.status).toBe(200);

    const update = terminalRunUpdate();
    expect(update).toBeDefined();
    expect(['completed', 'partial', 'failed']).toContain(update.data.status);
    expect(update.data.status).toBe('completed');
    expect(update.data.completedAt).toBeInstanceOf(Date);

    // All 14 slots ran, and the counters reflect that rather than staying 0 —
    // the production failure had real posts and posts_generated = 0.
    expect(update.data.postsGenerated).toBe(14);
    expect(update.data.postIds).toHaveLength(14);
  });
});

describe('terminal status — thrown error', () => {
  it('still finalises the run when every slot throws', async () => {
    installClock(1_000);
    mockGenerateContent.mockRejectedValue(new Error('provider 503'));

    const res = await GET(req());
    expect(res.status).toBe(200);

    const update = terminalRunUpdate();
    expect(update).toBeDefined();
    expect(update.data.status).toBe('failed');
    expect(update.data.completedAt).toBeInstanceOf(Date);
    // A run that produced nothing must say so, not be left at 'running'.
    expect(update.data.postsGenerated).toBe(0);
  });

  it('finalises the run when the planner itself throws', async () => {
    installClock(1_000);
    mockPlanDailyContent.mockRejectedValue(new Error('planner exploded'));

    const res = await GET(req());
    expect(res.status).toBe(200);

    // No run row is created on this path, so the CONFIG must carry the terminal
    // state instead — otherwise the org is pinned at 'generating' forever, the
    // exact bug the no-user recovery fix addressed on its own path.
    const cfgUpdates = mockPrisma.autopilotConfig.update.mock.calls.map(
      c => c[0].data.status
    );
    expect(cfgUpdates[cfgUpdates.length - 1]).toBe('error');
  });
});

describe('terminal status — exception after the run row exists', () => {
  it('finalises the run, with its real counters, when the finalising write fails', async () => {
    // THE GAP THE OTHER TWO THROW TESTS DO NOT COVER.
    //
    // "the planner throws" happens BEFORE autopilotRun.create(), so there is no
    // row to strand and the test passes whether or not recovery exists.
    // "every slot throws" is swallowed by generateSlotContent's own catch, so
    // the loop completes normally and the finalising write still runs. Neither
    // exercises an exception raised after the row exists — which is the only
    // way a run is left at status='running', and precisely how nineteen
    // production runs were stranded.
    //
    // A transient failure on the finalising write itself is the honest case:
    // the org catch is then the last code that can record what happened.
    installClock(1_000);
    mockPlanDailyContent.mockResolvedValue(slots(3));
    mockPrisma.autopilotRun.update
      .mockRejectedValueOnce(new Error('connection reset by peer'))
      .mockResolvedValue({});

    const res = await GET(req());
    expect(res.status).toBe(200);

    // One failed update, then one recovery via updateMany.
    expect(mockPrisma.autopilotRun.update.mock.calls.length).toBe(1);
    expect(mockPrisma.autopilotRun.updateMany.mock.calls.length).toBe(1);

    const recovery = mockPrisma.autopilotRun.updateMany.mock.calls[0][0];

    // Terminal, not 'running'. The reaper is a backstop, not the mechanism.
    expect(recovery.where.id).toBe('run-1');

    // GUARDED on status='running', which is what makes the recovery idempotent.
    // `runFinalised` is a local belief about a remote write; if the finalising
    // update COMMITS but its response is lost — a connection reset after commit
    // is the ordinary way a database call fails — the flag stays false and an
    // unguarded recovery would rewrite a finished run, turning 'completed' into
    // 'partial'. The row is the only honest arbiter of whether the row was
    // written, so the guard belongs in the WHERE clause and not in a variable.
    expect(recovery.where.status).toBe('running');

    expect(['partial', 'failed']).toContain(recovery.data.status);

    // AND it carries what the run actually produced. This is the assertion
    // that matters commercially: the stranded runs recorded posts_generated=0
    // while 10-13 real posts sat in the posts table, so a recovery that wrote
    // a terminal status but still reported zero would reproduce the defect
    // under a different name.
    expect(recovery.data.status).toBe('partial');
    expect(recovery.data.postsGenerated).toBe(3);
    expect(recovery.data.postIds).toHaveLength(3);
    expect(recovery.data.completedAt).toBeInstanceOf(Date);
    expect(recovery.data.errorMessage).toContain('connection reset by peer');
  });

  it('does not attempt a recovery write when the run finalised cleanly', async () => {
    // Guards the inverse: a recovery that fires on the happy path would double
    // write every run and make the counters unreadable.
    installClock(1_000);
    mockPlanDailyContent.mockResolvedValue(slots(2));

    await GET(req());

    expect(mockPrisma.autopilotRun.update.mock.calls.length).toBe(1);
    expect(mockPrisma.autopilotRun.updateMany.mock.calls.length).toBe(0);
    expect(terminalRunUpdate().data.status).toBe('completed');
  });
});

describe('terminal status — exhausted time budget', () => {
  it('stops before the ceiling and records a terminal partial run', async () => {
    // 25 s per clock read reproduces the measured production slot cost. Fourteen
    // slots at that rate need ~350 s against a 300 s ceiling.
    installClock(25_000);

    const res = await GET(req());
    expect(res.status).toBe(200);

    const update = terminalRunUpdate();
    expect(update).toBeDefined();

    // THE ASSERTION THAT MATTERS: the run is terminal, not left 'running' for
    // the watchdog reaper to clean up an hour later.
    expect(update.data.status).not.toBe('running');
    expect(['completed', 'partial', 'failed']).toContain(update.data.status);
    expect(update.data.completedAt).toBeInstanceOf(Date);

    // It stopped early rather than driving all 14 slots into the ceiling.
    // Counted in SLOTS (one post.create each), not LLM calls: the call count is
    // inflated by a separate defect — the regeneration loop spends two calls per
    // slot — and asserting on it here would conflate the two.
    expect(mockPrisma.post.create.mock.calls.length).toBeLessThan(14);

    // It kept — and reported — the work it actually did. Reporting a partial run
    // as zero-work is how twelve nights of drafts went unattributed.
    expect(update.data.status).toBe('partial');
    expect(update.data.postsGenerated).toBeGreaterThan(0);
    expect(update.data.postIds.length).toBe(update.data.postsGenerated);
  });

  it('stops starting slots with a full slot of margin left', async () => {
    // Per-CALL clock, not per-read.
    //
    // This assertion previously used installClock(25_000), which advances on
    // every Date.now() READ. That was tenable while the loop read the clock
    // once per slot, but a genuine wall-clock bound must read it inside the
    // attempt loop — which the original code never did — so every added read
    // charged 25 simulated seconds and moved the measured elapsed. With a 25 s
    // step, `> 255_000 && < 300_000` admits exactly ONE value, 275_000, so the
    // assertion was pinning the number of clock reads rather than the guard's
    // behaviour: any bound, however correct, broke it.
    //
    // Charging time to WORK instead mirrors production, where a generateContent
    // round trip costs seconds and reading a clock costs nothing. Same
    // reasoning the retry-budget suite gives for its own clock. Both assertions
    // below are unchanged — this makes them measure the guard rather than the
    // harness.
    let now = 1_760_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockGenerateContent.mockImplementation(async () => {
      now += 25_000; // measured p95 slot cost
      return { content: 'Generated copy.' };
    });

    await GET(req());

    // Asserted on the point the guard FIRED, not on the recorded duration.
    // Date.now is mocked to advance 25 s on every read, including the handful
    // during finalisation, so durationMs is inflated by the harness in a way
    // production is not — a threshold tuned to it would be measuring the mock.
    // The guard's firing elapsed is the actual design guarantee.
    const { logger } = jest.requireMock('@/lib/logger') as {
      logger: { warn: jest.Mock };
    };
    const budgetWarn = logger.warn.mock.calls.find(
      c => c[0] === 'cron:autopilot:budget-exhausted'
    );
    expect(budgetWarn).toBeDefined();

    // maxDuration 300 s, SLOT_RESERVE_MS 45 s. No slot may START after 255 s,
    // so even a slot running to the measured p95 of 26 s lands at ~281 s and
    // the finalising write still fits. Under-reserving here reintroduces the
    // exact production failure, so this is the assertion that guards it.
    expect(budgetWarn![1].elapsedMs).toBeGreaterThan(255_000);
    expect(budgetWarn![1].elapsedMs).toBeLessThan(300_000);

    // It reported which slots it did not get to, rather than silently dropping
    // them — a truncated pass that looks complete is how the gap stays hidden.
    expect(budgetWarn![1].slotsCompleted).toBeLessThan(
      budgetWarn![1].slotsPlanned
    );
  });
});
