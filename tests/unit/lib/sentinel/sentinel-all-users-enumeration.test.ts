/**
 * runSentinelCheckForAllUsers — enumeration + dedup (silent-no-op fix).
 *
 * Sentinel resolves a site from user.website → organization.website, but the
 * all-users enumeration used to filter on user.website ALONE. With no user
 * carrying a personal website (but orgs that do), the set was always empty and
 * sentinel produced nothing — 0 site_health_snapshots ever, despite 7 orgs with
 * websites.
 *
 * These tests lock the fix: org-website users are enumerated, and the run is
 * deduped by resolved site so each distinct website is checked exactly once.
 */

const mockPrisma = {
  user: { findMany: jest.fn(), findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/sentinel/algorithm-feed', () => ({
  seedAlgorithmUpdates: jest.fn().mockResolvedValue(undefined),
  getRecentUpdates: jest.fn().mockResolvedValue([]),
}));

const mockCheckSiteHealth = jest.fn();
jest.mock('@/lib/sentinel/health-checker', () => ({
  checkSiteHealth: (...a: unknown[]) => mockCheckSiteHealth(...a),
  getLatestSnapshot: jest
    .fn()
    .mockResolvedValue({ id: 'snap', healthScore: 90 }),
}));

jest.mock('@/lib/sentinel/alert-engine', () => ({
  runAlertEngine: jest.fn().mockResolvedValue([]),
}));

import { runSentinelCheckForAllUsers } from '@/lib/sentinel/sentinel-agent';

beforeEach(() => {
  jest.clearAllMocks();
  // resolveSiteUrl: no user has a personal website...
  mockPrisma.user.findUnique.mockResolvedValue({ website: null });
  // ...but their org does (keyed by org id).
  mockPrisma.organization.findUnique.mockImplementation(({ where }) => ({
    website:
      where.id === 'o1' ? 'https://site1.example' : 'https://site2.example',
  }));
  mockCheckSiteHealth.mockResolvedValue({ healthScore: 88 });
});

describe('runSentinelCheckForAllUsers', () => {
  it('enumerates users whose ORG has a website (not just user.website)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    await runSentinelCheckForAllUsers();

    const where = mockPrisma.user.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { website: { not: null } },
        { organization: { is: { website: { not: null } } } },
      ])
    );
  });

  it('dedups by resolved site so each distinct website is checked once', async () => {
    // Two users share org o1 (same site) + one user on o2.
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'uA',
        organizationId: 'o1',
        website: null,
        organization: { website: 'https://site1.example' },
      },
      {
        id: 'uB',
        organizationId: 'o1',
        website: null,
        organization: { website: 'https://site1.example' },
      },
      {
        id: 'uC',
        organizationId: 'o2',
        website: null,
        organization: { website: 'https://site2.example' },
      },
    ]);

    const result = await runSentinelCheckForAllUsers();

    // site1 (once, not twice) + site2 = 2 distinct sites checked.
    expect(mockCheckSiteHealth).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(2);
  });
});
