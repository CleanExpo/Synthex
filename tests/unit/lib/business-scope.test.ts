/**
 * Unit Tests for business-scope org-access helpers (SYN-847)
 *
 * Covers the unified hasOrganizationAccess() RBAC paths and the
 * resolveCampaignOrganizationId() wiring used by Campaign Studio to create
 * against the active child-brand org.
 *
 * Prisma is mocked at the unit boundary (matches the repo's existing
 * tests/unit/api convention); the access logic itself is exercised directly.
 */

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  businessOwnership: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn(), findFirst: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import {
  hasOrganizationAccess,
  hasDirectOrganizationAccess,
  resolveCampaignOrganizationId,
  getEffectiveOrganizationId,
  OrgAccessError,
} from '@/lib/multi-business/business-scope';
import { setActiveOrganization } from '@/lib/multi-business/owner-utils';

describe('business-scope — org access (SYN-847)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Sensible defaults — individual tests override as needed.
    mockPrisma.businessOwnership.findUnique.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    mockPrisma.organization.findFirst.mockResolvedValue(null);
  });

  describe('hasOrganizationAccess', () => {
    it('denies when the user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      expect(await hasOrganizationAccess('ghost', 'org-1')).toBe(false);
    });

    it('grants direct membership (user.organizationId matches target)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: false,
        organizationId: 'org-1',
      });
      expect(await hasOrganizationAccess('u', 'org-1')).toBe(true);
    });

    it('grants a multi-business owner with active BusinessOwnership', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: true,
        organizationId: null,
      });
      mockPrisma.businessOwnership.findUnique.mockResolvedValue({
        isActive: true,
      });
      expect(await hasOrganizationAccess('owner', 'brand-org')).toBe(true);
    });

    it('grants a master admin acting on a CHILD org of their parent workspace', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: false,
        organizationId: 'parent-org',
      });
      // Target is a child org the user is NOT a direct member of...
      mockPrisma.organization.findUnique.mockResolvedValue({
        parentOrgId: 'parent-org',
        users: [],
      });
      // ...but the user IS a member of the parent workspace.
      mockPrisma.organization.findFirst.mockResolvedValue({ id: 'parent-org' });

      expect(await hasOrganizationAccess('admin', 'child-org')).toBe(true);
      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'parent-org', users: { some: { id: 'admin' } } },
        })
      );
    });

    it('grants a direct member of the child/brand org', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: false,
        organizationId: 'some-other-org',
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        parentOrgId: 'parent-org',
        users: [{ id: 'member' }],
      });
      expect(await hasOrganizationAccess('member', 'child-org')).toBe(true);
    });

    it('denies a non-member who is neither owner, member, nor master admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: false,
        organizationId: 'unrelated-org',
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        parentOrgId: 'parent-org',
        users: [],
      });
      mockPrisma.organization.findFirst.mockResolvedValue(null); // not a parent member
      expect(await hasOrganizationAccess('outsider', 'child-org')).toBe(false);
    });

    it('denies when the target org does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: false,
        organizationId: 'unrelated-org',
      });
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      expect(await hasOrganizationAccess('u', 'missing-org')).toBe(false);
    });
  });

  describe('hasDirectOrganizationAccess — acting on the organisation itself', () => {
    it('refuses a member of the parent workspace who holds nothing in the child', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: false,
        organizationId: 'parent-org',
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        parentOrgId: 'parent-org',
        users: [],
      });
      mockPrisma.organization.findFirst.mockResolvedValue({ id: 'parent-org' });

      // The wide check grants; the direct check refuses and never consults
      // the parent workspace at all.
      expect(await hasOrganizationAccess('admin', 'child-org')).toBe(true);
      mockPrisma.organization.findFirst.mockClear();
      expect(await hasDirectOrganizationAccess('admin', 'child-org')).toBe(
        false
      );
      expect(mockPrisma.organization.findFirst).not.toHaveBeenCalled();
    });

    it('still grants a direct member, an active owner, and a user of the child org', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: false,
        organizationId: 'child-org',
      });
      expect(await hasDirectOrganizationAccess('member', 'child-org')).toBe(
        true
      );

      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: true,
        organizationId: null,
      });
      mockPrisma.businessOwnership.findUnique.mockResolvedValue({
        isActive: true,
      });
      expect(await hasDirectOrganizationAccess('owner', 'child-org')).toBe(
        true
      );

      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: false,
        organizationId: 'other-org',
      });
      mockPrisma.businessOwnership.findUnique.mockResolvedValue(null);
      mockPrisma.organization.findUnique.mockResolvedValue({
        parentOrgId: 'parent-org',
        users: [{ id: 'user-of-child' }],
      });
      expect(
        await hasDirectOrganizationAccess('user-of-child', 'child-org')
      ).toBe(true);
    });
  });

  describe('resolveCampaignOrganizationId', () => {
    it('returns the requested child org when the user is authorised', async () => {
      // Authorised via direct membership match.
      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: false,
        organizationId: 'child-org',
      });
      const resolved = await resolveCampaignOrganizationId('u', 'child-org');
      expect(resolved).toBe('child-org');
    });

    it('throws OrgAccessError when the user cannot access the requested org', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: false,
        organizationId: 'unrelated-org',
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        parentOrgId: null,
        users: [],
      });
      await expect(
        resolveCampaignOrganizationId('outsider', 'child-org')
      ).rejects.toBeInstanceOf(OrgAccessError);
    });

    it('falls back to the effective default org when no org is requested', async () => {
      // getEffectiveOrganizationId path: regular user with an organizationId.
      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: false,
        activeOrganizationId: null,
        organizationId: 'default-org',
      });
      const resolved = await resolveCampaignOrganizationId('u');
      expect(resolved).toBe('default-org');
    });

    it('falls back to the active org for a multi-business owner when none requested', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        isMultiBusinessOwner: true,
        activeOrganizationId: 'active-brand',
        organizationId: 'default-org',
      });
      // SYN-1104: the override active-org is now re-verified — the owner must
      // hold an active BusinessOwnership row for it to be honoured.
      mockPrisma.businessOwnership.findUnique.mockResolvedValue({
        isActive: true,
      });
      const resolved = await resolveCampaignOrganizationId('owner', null);
      expect(resolved).toBe('active-brand');
    });
  });
});

// -- Track B S6'(f) -- suspended-org refusal inside the ~144-route resolver --
// (criteria 5 & 16: the resolver refuses suspended orgs but NEVER selects a
// provisioning parent -- callers already handle null as "No organisation found")

describe('getEffectiveOrganizationId — suspended-org refusal (Track B)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null for a regular user whose org is suspended', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: false,
      activeOrganizationId: null,
      organizationId: 'org-child-1',
    });
    mockPrisma.organization.findUnique.mockResolvedValue({
      status: 'suspended',
    });

    expect(await getEffectiveOrganizationId('user-1')).toBeNull();
  });

  it('returns null for a multi-business owner whose ACTIVE org is suspended', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: true,
      activeOrganizationId: 'org-child-1',
      organizationId: 'org-brand-1',
    });
    mockPrisma.organization.findUnique.mockResolvedValue({
      status: 'suspended',
    });

    expect(await getEffectiveOrganizationId('owner-1')).toBeNull();
  });

  it('returns null when the org is deleted', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: false,
      activeOrganizationId: null,
      organizationId: 'org-child-1',
    });
    mockPrisma.organization.findUnique.mockResolvedValue({
      status: 'deleted',
    });

    expect(await getEffectiveOrganizationId('user-1')).toBeNull();
  });

  it('returns the org id when the org is active', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: false,
      activeOrganizationId: null,
      organizationId: 'org-child-1',
    });
    mockPrisma.organization.findUnique.mockResolvedValue({ status: 'active' });

    expect(await getEffectiveOrganizationId('user-1')).toBe('org-child-1');
  });

  it('still resolves (fail-open) when the org row is missing — data integrity, not suspension', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: false,
      activeOrganizationId: null,
      organizationId: 'org-child-1',
    });
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    expect(await getEffectiveOrganizationId('user-1')).toBe('org-child-1');
  });
});

// -- SYN-1104 -- getEffectiveOrganizationId re-verifies OVERRIDE membership ----
// A multi-business owner's stored activeOrganizationId is honoured only after
// re-verifying active ownership. The common home-org case stays query-free.
describe('getEffectiveOrganizationId — override membership re-verification (SYN-1104)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Orgs are active unless a test says otherwise (isolate the membership axis).
    mockPrisma.organization.findUnique.mockResolvedValue({ status: 'active' });
  });

  it('(a) home org: active == home → returned WITHOUT a membership query', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: true,
      activeOrganizationId: 'home-org',
      organizationId: 'home-org',
    });

    expect(await getEffectiveOrganizationId('owner-1')).toBe('home-org');
    // The whole point of the hot-path optimisation: no ownership lookup fired.
    expect(mockPrisma.businessOwnership.findUnique).not.toHaveBeenCalled();
  });

  it('(b) valid override: owner IS an active member → override returned', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: true,
      activeOrganizationId: 'override-org',
      organizationId: 'home-org',
    });
    mockPrisma.businessOwnership.findUnique.mockResolvedValue({
      isActive: true,
    });

    expect(await getEffectiveOrganizationId('owner-1')).toBe('override-org');
    expect(mockPrisma.businessOwnership.findUnique).toHaveBeenCalledTimes(1);
  });

  it('(c) stale override: no ownership row → falls back to home org', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: true,
      activeOrganizationId: 'override-org',
      organizationId: 'home-org',
    });
    mockPrisma.businessOwnership.findUnique.mockResolvedValue(null);

    expect(await getEffectiveOrganizationId('owner-1')).toBe('home-org');
  });

  it('(c2) revoked override: ownership row is INACTIVE → falls back to home org', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: true,
      activeOrganizationId: 'override-org',
      organizationId: 'home-org',
    });
    mockPrisma.businessOwnership.findUnique.mockResolvedValue({
      isActive: false,
    });

    expect(await getEffectiveOrganizationId('owner-1')).toBe('home-org');
  });

  it('(c3) fail-safe: a membership check error falls back to home, never the override', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: true,
      activeOrganizationId: 'override-org',
      organizationId: 'home-org',
    });
    mockPrisma.businessOwnership.findUnique.mockRejectedValue(
      new Error('db down')
    );

    expect(await getEffectiveOrganizationId('owner-1')).toBe('home-org');
  });
});

// -- SYN-1104 -- SET path: setActiveOrganization rejects a non-member target ---
describe('setActiveOrganization — rejects a non-member target (SYN-1104)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws and never persists when the user owns no active row for the target', async () => {
    mockPrisma.businessOwnership.findUnique.mockResolvedValue(null);

    await expect(
      setActiveOrganization('outsider', 'not-my-org')
    ).rejects.toThrow(/does not own/i);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('throws when the ownership row is inactive, without persisting', async () => {
    mockPrisma.businessOwnership.findUnique.mockResolvedValue({
      isActive: false,
    });

    await expect(
      setActiveOrganization('owner', 'suspended-membership-org')
    ).rejects.toThrow(/inactive/i);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
