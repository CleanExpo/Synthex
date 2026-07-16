/**
 * /api/cron/autopilot — no-user recovery (silent-stuck-org fix).
 *
 * The per-org loop sets status='generating' up front. When the org had no user
 * to attribute content to, the old code did a bare `continue` — never resetting
 * status or advancing lastRunAt/nextRunAt. The config stayed pinned at
 * 'generating', perpetually "due", and every daily run re-entered and re-skipped
 * it (observed in production: one org stuck 26 days with last_run_at null).
 *
 * These tests lock the fix: a no-user org is moved to a visible 'error' state
 * with an actionable message and its nextRunAt advanced, and the planner is
 * never invoked for it.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  autopilotConfig: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  autopilotRun: { create: jest.fn(), update: jest.fn() },
  campaign: { findFirst: jest.fn(), create: jest.fn() },
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

// Heavy deps imported at module top but never reached on the no-user path.
const mockPlanDailyContent = jest.fn();
jest.mock('@/lib/autopilot/daily-planner', () => ({
  planDailyContent: (...a: unknown[]) => mockPlanDailyContent(...a),
}));
jest.mock('@/lib/ai/content-generator', () => ({
  AIContentGenerator: class {},
}));
jest.mock('@/lib/autopilot/quality-gate', () => ({
  evaluateContent: jest.fn(),
  scoreDimensions: jest.fn(),
}));

import { GET } from '@/app/api/cron/autopilot/route';

function req() {
  return createMockNextRequest({ url: 'http://localhost/api/cron/autopilot' });
}

function noUserConfig() {
  return {
    id: 'cfg-2',
    organizationId: 'org-2',
    enabled: true,
    enabledPlatforms: ['instagram'],
    planningHorizonDays: 7,
    postsPerDayPerPlatform: 1,
    contentMix: {},
    autoApproveThreshold: 80,
    minScoreThreshold: 60,
    organization: {
      id: 'org-2',
      name: 'Org Two',
      industry: 'restoration',
      brandDna: null,
      users: [], // <-- the trigger: no user to attribute content to
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockPrisma.autopilotConfig.update.mockResolvedValue({});
});

describe('GET /api/cron/autopilot — no-user org recovery', () => {
  it('moves a no-user org to error state, advances nextRunAt, and never plans', async () => {
    mockPrisma.autopilotConfig.findMany.mockResolvedValue([noUserConfig()]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.orgsProcessed).toBe(0);

    // status:'generating' set first, THEN the recovery update to 'error'.
    const errorUpdate = mockPrisma.autopilotConfig.update.mock.calls.find(
      ([arg]) => arg?.data?.status === 'error'
    );
    expect(errorUpdate).toBeDefined();
    expect(errorUpdate![0].where).toEqual({ id: 'cfg-2' });
    expect(errorUpdate![0].data.lastErrorMessage).toMatch(/no user/i);
    expect(errorUpdate![0].data.nextRunAt).toBeInstanceOf(Date);
    // Future — the org is no longer perpetually "due".
    expect(errorUpdate![0].data.nextRunAt.getTime()).toBeGreaterThan(
      Date.now()
    );

    // The heavy planner is never invoked for a no-user org.
    expect(mockPlanDailyContent).not.toHaveBeenCalled();
    // The org must NOT be left pinned at 'generating'.
    const lastStatus = mockPrisma.autopilotConfig.update.mock.calls
      .map(([arg]) => arg?.data?.status)
      .filter(Boolean)
      .pop();
    expect(lastStatus).toBe('error');
  });
});
