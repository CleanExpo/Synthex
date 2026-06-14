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
  user: { findUnique: jest.fn() },
  businessOwnership: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn(), findFirst: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), debug: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import {
  hasOrganizationAccess,
  resolveCampaignOrganizationId,
  OrgAccessError,
} from '@/lib/multi-business/business-scope';

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
      const resolved = await resolveCampaignOrganizationId('owner', null);
      expect(resolved).toBe('active-brand');
    });
  });
});
