/**
 * connection-warnings tests (SYN-SCHED-CONNECTION-WARN)
 *
 * Proves the non-blocking "no connected account" warning the scheduler attaches
 * at schedule time:
 *   (a) no active connection  → a structured warning is produced;
 *   (b) active connection      → no warning;
 *   (c) the active-connection lookup uses the SAME query shape as the
 *       publish-time gate (org-scoped, isActive:true, deletedAt:null, with the
 *       userId+organizationId:null fallback for the no-org/legacy case) so the
 *       warning agrees with what the cron will actually find;
 *   (d) a lookup failure NEVER turns a valid schedule into an error (returns no
 *       warnings instead of throwing).
 *
 * @module tests/unit/lib/social/connection-warnings.test
 */

const mockFindFirst = jest.fn();
const mockPrisma = {
  platformConnection: { findFirst: mockFindFirst },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

import {
  NO_ACTIVE_CONNECTION,
  buildNoConnectionWarning,
  hasActiveConnection,
  getScheduleConnectionWarnings,
} from '@/lib/social/connection-warnings';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buildNoConnectionWarning — structured warning contract', () => {
  it('produces the { code, platform, message } shape the UI consumes', () => {
    const warning = buildNoConnectionWarning('linkedin');
    expect(warning.code).toBe(NO_ACTIVE_CONNECTION);
    expect(warning.code).toBe('no_active_connection');
    expect(warning.platform).toBe('linkedin');
    expect(warning.message).toContain('linkedin');
    // The message must communicate that the post WAS scheduled (not rejected).
    expect(warning.message.toLowerCase()).toContain('scheduled');
  });
});

describe('hasActiveConnection — mirrors the publish-time query shape', () => {
  it('org context: scopes by organizationId + platform + isActive + deletedAt:null', async () => {
    mockFindFirst.mockResolvedValue({ id: 'conn-1' });

    const result = await hasActiveConnection('user-1', 'org-1', 'twitter');

    expect(result).toBe(true);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        platform: 'twitter',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    // Must NOT leak across orgs by querying userId in the org case.
    const callArg = mockFindFirst.mock.calls[0][0];
    expect(callArg.where).not.toHaveProperty('userId');
  });

  it('no-org/legacy: falls back to userId + organizationId:null (never another user)', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await hasActiveConnection('user-1', null, 'instagram');

    expect(result).toBe(false);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        organizationId: null,
        platform: 'instagram',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
  });
});

describe('getScheduleConnectionWarnings — (a) no connection, (b) connection present', () => {
  it('(a) NO active connection → a single no_active_connection warning', async () => {
    mockFindFirst.mockResolvedValue(null);

    const warnings = await getScheduleConnectionWarnings(
      'user-1',
      'org-1',
      'tiktok'
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toEqual({
      code: 'no_active_connection',
      platform: 'tiktok',
      message: expect.stringContaining('tiktok'),
    });
  });

  it('(b) active connection present → NO warnings (happy path unchanged)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'conn-1' });

    const warnings = await getScheduleConnectionWarnings(
      'user-1',
      'org-1',
      'twitter'
    );

    expect(warnings).toEqual([]);
  });

  it('(d) a lookup failure never throws — returns no warnings so scheduling still succeeds', async () => {
    mockFindFirst.mockRejectedValue(new Error('db down'));

    await expect(
      getScheduleConnectionWarnings('user-1', 'org-1', 'twitter')
    ).resolves.toEqual([]);
  });
});
