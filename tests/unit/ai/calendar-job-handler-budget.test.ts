/**
 * BUDGET-ENFORCER — calendar worker wiring (lib/ai/calendar-job-handler.ts).
 *
 * The worker is the most expensive AI path (days × platforms × postsPerDay
 * provider calls) and previously had ZERO budget code. Pins:
 *   - enforcing policy + over ceiling → the job handler rejects with
 *     OrgBudgetExceededError BEFORE generateContentCalendar is called
 *     (typed queue failure, lands on job.error)
 *   - no policy → run proceeds unchanged
 *   - successful run commits the reservation (in-flight back to 0)
 *   - failed run releases the reservation
 *
 * Queue and generator are mocked; the REAL budget-enforcer runs (Redis on
 * its in-memory fallback).
 */

const mockRegisterHandler = jest.fn();
const mockGenerateCalendar = jest.fn();
const mockUsageTrack = jest.fn();
const mockPolicyFindUnique = jest.fn();
const mockLedgerAggregate = jest.fn();

jest.mock('@/lib/queue', () => ({
  enqueue: jest.fn(),
  registerHandler: (...a: unknown[]) => mockRegisterHandler(...a),
  JobTypes: { CALENDAR_GENERATION: 'calendar:generation' },
}));

jest.mock('@/lib/ai/content-generator', () => ({
  aiContentGenerator: {
    generateContentCalendar: (...a: unknown[]) => mockGenerateCalendar(...a),
  },
}));

jest.mock('@/lib/middleware/rate-limiter', () => ({
  UsageTracker: { track: (...a: unknown[]) => mockUsageTrack(...a) },
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    orgBudgetPolicy: {
      findUnique: (...a: unknown[]) => mockPolicyFindUnique(...a),
    },
    pipelineCostLedger: {
      aggregate: (...a: unknown[]) => mockLedgerAggregate(...a),
    },
  },
  default: {
    orgBudgetPolicy: {
      findUnique: (...a: unknown[]) => mockPolicyFindUnique(...a),
    },
    pipelineCostLedger: {
      aggregate: (...a: unknown[]) => mockLedgerAggregate(...a),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { registerCalendarGenerationHandler } from '@/lib/ai/calendar-job-handler';
import {
  getOrgSpendSnapshot,
  OrgBudgetExceededError,
} from '@/lib/ai/budget-enforcer';
import { resetRedisClient } from '@/lib/redis-client';

const ORG = 'org-cal-1';

type Handler = (job: {
  id: string;
  data: Record<string, unknown>;
}) => Promise<unknown>;

function getRegisteredHandler(): Handler {
  // registerCalendarGenerationHandler guards on a module-level flag, so it
  // registers exactly once per module registry — grab the captured handler.
  registerCalendarGenerationHandler();
  expect(mockRegisterHandler).toHaveBeenCalledWith(
    'calendar:generation',
    expect.any(Function)
  );
  return mockRegisterHandler.mock.calls[0][1] as Handler;
}

function makeJob(organizationId: string | undefined) {
  return {
    id: `job-${Date.now()}`,
    data: {
      userId: 'worker-user',
      organizationId,
      days: 2,
      platforms: ['twitter', 'linkedin'],
      postsPerDay: 2,
    },
  };
}

describe('calendar-job-handler — BUDGET-ENFORCER worker enforcement', () => {
  let handler: Handler;

  beforeAll(() => {
    // Capture before resetMocks wipes call history: re-register inside the
    // first test run instead. (registerCalendarGenerationHandler is
    // idempotent per module load, so capture once here.)
    handler = getRegisteredHandler();
  });

  beforeEach(async () => {
    await resetRedisClient();
    delete process.env.SYNTHEX_DEFAULT_DAILY_COST_CEILING_USD;
    delete process.env.SYNTHEX_DEFAULT_MONTHLY_COST_CEILING_USD;
    mockPolicyFindUnique.mockResolvedValue(null);
    mockLedgerAggregate.mockResolvedValue({ _sum: { costUsd: 0 } });
    mockUsageTrack.mockResolvedValue(undefined);
    mockGenerateCalendar.mockResolvedValue(
      new Map([['2026-07-10', [{ id: 'post-1' }, { id: 'post-2' }]]])
    );
  });

  it('rejects the run with OrgBudgetExceededError BEFORE any generation when the enforcing ceiling is breached', async () => {
    mockPolicyFindUnique.mockResolvedValue({
      organizationId: ORG,
      dailyCeilingUsd: 0.01, // far below the 2×2×2-post estimate
      monthlyCeilingUsd: null,
      enforcementMode: 'enforce',
    });

    await expect(handler(makeJob(ORG))).rejects.toThrow(OrgBudgetExceededError);
    expect(mockGenerateCalendar).not.toHaveBeenCalled();
    expect(mockUsageTrack).not.toHaveBeenCalled();

    // Nothing left in flight after the rejection.
    const snapshot = await getOrgSpendSnapshot(ORG);
    expect(snapshot.inFlightReservedUsd.daily).toBe(0);
  });

  it('proceeds unchanged when no policy exists (deploy-safe)', async () => {
    const result = (await handler(makeJob(ORG))) as { totalPosts: number };
    expect(result.totalPosts).toBe(2);
    expect(mockGenerateCalendar).toHaveBeenCalledTimes(1);
  });

  it('commits the reservation on success (in-flight back to 0)', async () => {
    mockPolicyFindUnique.mockResolvedValue({
      organizationId: ORG,
      dailyCeilingUsd: 100,
      monthlyCeilingUsd: null,
      enforcementMode: 'enforce',
    });

    await handler(makeJob(ORG));
    const snapshot = await getOrgSpendSnapshot(ORG);
    expect(snapshot.inFlightReservedUsd.daily).toBe(0);
  });

  it('releases the reservation when the run fails', async () => {
    mockPolicyFindUnique.mockResolvedValue({
      organizationId: ORG,
      dailyCeilingUsd: 100,
      monthlyCeilingUsd: null,
      enforcementMode: 'enforce',
    });
    mockGenerateCalendar.mockRejectedValue(new Error('provider down'));

    await expect(handler(makeJob(ORG))).rejects.toThrow('provider down');
    const snapshot = await getOrgSpendSnapshot(ORG);
    expect(snapshot.inFlightReservedUsd.daily).toBe(0);
  });

  it('skips enforcement entirely for jobs without an organisation (system sentinel)', async () => {
    mockPolicyFindUnique.mockResolvedValue({
      organizationId: ORG,
      dailyCeilingUsd: 0.01,
      enforcementMode: 'enforce',
    });

    const result = (await handler(makeJob(undefined))) as {
      totalPosts: number;
    };
    expect(result.totalPosts).toBe(2);
    // Policy is never even read for the system org.
    expect(mockPolicyFindUnique).not.toHaveBeenCalled();
  });
});
