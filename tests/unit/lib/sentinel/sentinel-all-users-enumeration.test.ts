/**
 * runSentinelCheckForAllUsers — two-source enumeration (silent-no-op fix).
 *
 * Sentinel resolves a site from user.website → organization.website. The old
 * enumeration filtered on user.website alone → 0 targets. A first fix added
 * users whose org has a website, but org membership actually lives in
 * team_members (the users FK is empty for every portfolio org), so that still
 * missed the real business sites.
 *
 * These tests pin the complete fix: personal-website users AND website-orgs
 * (via an accepted team member) are both enumerated, deduped by resolved site,
 * and an org with no member is skipped.
 */

const mockPrisma = {
  user: { findMany: jest.fn(), findUnique: jest.fn() },
  organization: { findMany: jest.fn(), findUnique: jest.fn() },
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
  mockPrisma.user.findMany.mockResolvedValue([]);
  mockPrisma.organization.findMany.mockResolvedValue([]);
  // resolveSiteUrl: members carry no personal website; the org does (by id).
  mockPrisma.user.findUnique.mockResolvedValue({ website: null });
  mockPrisma.organization.findUnique.mockImplementation(({ where }) => ({
    website:
      where.id === 'o1' ? 'https://site1.example' : 'https://site2.example',
  }));
  mockCheckSiteHealth.mockResolvedValue({ healthScore: 88 });
});

describe('runSentinelCheckForAllUsers', () => {
  it('checks an org site via an accepted team member (users FK empty)', async () => {
    mockPrisma.organization.findMany.mockResolvedValue([
      {
        id: 'o1',
        website: 'https://site1.example',
        teamMembers: [
          { userId: 'admin-9', role: 'admin' },
          { userId: 'owner-7', role: 'owner' },
        ],
      },
    ]);

    const result = await runSentinelCheckForAllUsers();

    // The owner is attributed, and the org site (not a member profile) is
    // checked once — passed explicitly so resolveSiteUrl can't substitute.
    expect(mockCheckSiteHealth).toHaveBeenCalledTimes(1);
    expect(mockCheckSiteHealth).toHaveBeenCalledWith(
      'https://site1.example',
      'owner-7',
      'o1'
    );
    expect(result.processed).toBe(1);
  });

  it('checks the ORG site even when the attributed member has a personal website', async () => {
    // Regression (CodeRabbit #789): resolveSiteUrl prefers user.website over
    // organization.website. If the owner has a personal site, the org site must
    // still be the one checked — the enumeration carries o.website explicitly.
    mockPrisma.user.findUnique.mockResolvedValue({
      website: 'https://owner-personal.example',
    });
    mockPrisma.organization.findMany.mockResolvedValue([
      {
        id: 'o1',
        website: 'https://org-site.example',
        teamMembers: [{ userId: 'owner-7', role: 'owner' }],
      },
    ]);

    const result = await runSentinelCheckForAllUsers();

    expect(mockCheckSiteHealth).toHaveBeenCalledTimes(1);
    expect(mockCheckSiteHealth).toHaveBeenCalledWith(
      'https://org-site.example',
      'owner-7',
      'o1'
    );
    // The member's personal site was NOT checked.
    expect(mockCheckSiteHealth).not.toHaveBeenCalledWith(
      'https://owner-personal.example',
      expect.anything(),
      expect.anything()
    );
    expect(result.processed).toBe(1);
  });

  it('dedups a personal-website user against the same org site', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', organizationId: 'o1', website: 'https://site1.example' },
    ]);
    mockPrisma.organization.findMany.mockResolvedValue([
      {
        id: 'o1',
        website: 'https://site1.example', // same site as u1 → deduped
        teamMembers: [{ userId: 'owner-7', role: 'owner' }],
      },
      {
        id: 'o2',
        website: 'https://site2.example',
        teamMembers: [{ userId: 'owner-8', role: 'owner' }],
      },
    ]);

    const result = await runSentinelCheckForAllUsers();

    // site1 (once, via the personal user) + site2 = 2 distinct sites.
    expect(mockCheckSiteHealth).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(2);
  });

  it('skips a website-org that has no accepted member to attribute', async () => {
    mockPrisma.organization.findMany.mockResolvedValue([
      { id: 'o1', website: 'https://site1.example', teamMembers: [] },
    ]);

    const result = await runSentinelCheckForAllUsers();

    expect(mockCheckSiteHealth).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
  });
});
