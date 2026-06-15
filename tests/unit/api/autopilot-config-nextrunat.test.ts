/**
 * Behavioural coverage for the autopilot dead-toggle fix.
 *
 * BUG: PATCH /api/autopilot/config persisted `enabled: true` but never seeded
 * `nextRunAt`. The daily cron selects orgs via
 *   `where: { enabled: true, nextRunAt: { lte: now } }`
 * and `null <= now` is false in Postgres, so any org that enabled autopilot
 * from its own settings page (AutopilotPageClient → PATCH /api/autopilot/config)
 * was permanently skipped by the cron — autopilot silently never ran. The
 * sibling toggle (POST /api/command-centre/autopilot) already seeded nextRunAt;
 * this route did not.
 *
 * FIX: when the `enabled` toggle is part of the PATCH, the route now drives the
 * run-state fields the cron depends on — seed nextRunAt to +24h + status 'idle'
 * on enable, clear nextRunAt + status 'paused' on disable — while leaving
 * nextRunAt untouched for settings-only edits that don't include `enabled`.
 *
 * These tests drive the REAL PATCH handler and assert the exact data the route
 * hands to prisma.autopilotConfig.upsert.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const ORG_ID = 'org-1';
const USER_ID = 'u1';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockUpsert = jest.fn();
const mockPrisma = {
  autopilotConfig: {
    upsert: (...args: unknown[]) => mockUpsert(...args),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

// ── Auth mock (security checker) ───────────────────────────────────────────────
const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: { check: (...args: unknown[]) => mockCheck(...args) },
  DEFAULT_POLICIES: { AUTHENTICATED_READ: {}, AUTHENTICATED_WRITE: {} },
}));

// ── Effective-org mock (the active brand) ──────────────────────────────────────
const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { PATCH } from '@/app/api/autopilot/config/route';

function req(body: object) {
  return createMockNextRequest({
    url: 'http://localhost/api/autopilot/config',
    method: 'PATCH',
    body,
  }) as never;
}

/** Pull the `update` payload the route handed to prisma.upsert. */
function updatePayload(): Record<string, unknown> {
  expect(mockUpsert).toHaveBeenCalledTimes(1);
  const arg = mockUpsert.mock.calls[0]![0] as {
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  };
  return arg.update;
}

/** Pull the `create` payload the route handed to prisma.upsert. */
function createPayload(): Record<string, unknown> {
  expect(mockUpsert).toHaveBeenCalledTimes(1);
  const arg = mockUpsert.mock.calls[0]![0] as {
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  };
  return arg.create;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({
    allowed: true,
    context: { userId: USER_ID },
  });
  mockGetEffectiveOrganizationId.mockResolvedValue(ORG_ID);
  mockUpsert.mockImplementation((args: { create: object }) =>
    Promise.resolve({ organizationId: ORG_ID, ...args.create })
  );
});

describe('PATCH /api/autopilot/config — nextRunAt run-state (dead-toggle fix)', () => {
  it('401 when unauthenticated', async () => {
    mockCheck.mockResolvedValueOnce({ allowed: false, error: 'unauth' });
    const res = await PATCH(req({ enabled: true }));
    expect(res.status).toBe(401);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('400 when the user has no effective organisation', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValueOnce(null);
    const res = await PATCH(req({ enabled: true }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('enabling seeds nextRunAt (+~24h) so the daily cron will pick the org up', async () => {
    const before = Date.now();
    await PATCH(req({ enabled: true }));
    const after = Date.now();

    const update = updatePayload();
    expect(update.enabled).toBe(true);
    expect(update.status).toBe('idle');
    expect(update.lastErrorMessage).toBeNull();

    // The exact dead-toggle assertion: nextRunAt is a real future Date, not null.
    expect(update.nextRunAt).toBeInstanceOf(Date);
    const next = (update.nextRunAt as Date).getTime();
    const DAY = 24 * 60 * 60 * 1000;
    expect(next).toBeGreaterThanOrEqual(before + DAY - 1000);
    expect(next).toBeLessThanOrEqual(after + DAY + 1000);

    // create branch (first-time upsert) must seed it too.
    const create = createPayload();
    expect(create.nextRunAt).toBeInstanceOf(Date);
    expect(create.status).toBe('idle');
  });

  it('disabling clears nextRunAt and pauses so the cron skips the org', async () => {
    await PATCH(req({ enabled: false }));
    const update = updatePayload();
    expect(update.enabled).toBe(false);
    expect(update.status).toBe('paused');
    expect(update.nextRunAt).toBeNull();
  });

  it('settings-only edit (no enabled key) does NOT touch nextRunAt or status', async () => {
    await PATCH(req({ postsPerDayPerPlatform: 3, enabledPlatforms: ['linkedin'] }));
    const update = updatePayload();
    expect(update.postsPerDayPerPlatform).toBe(3);
    expect(update.enabledPlatforms).toEqual(['linkedin']);
    // Must NOT reset an already-scheduled run.
    expect('nextRunAt' in update).toBe(false);
    expect('status' in update).toBe(false);
  });
});
