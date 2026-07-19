/**
 * Unit tests for getEffectiveQueryFilter — the org-scoped WHERE-clause builder
 * that isolates every query's data to the caller's tenant (SYN-963 #5).
 *
 * business-scope.test.ts covers the access GUARDS (hasOrganizationAccess /
 * resolveCampaignOrganizationId) but not the query FILTER that actually scopes
 * reads. This pins each branch, including the security-relevant fallbacks.
 *
 * Prisma mocked at the unit boundary (matches business-scope.test.ts).
 */
const mockPrisma = {
  user: { findUnique: jest.fn() },
  businessOwnership: { findUnique: jest.fn() },
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

import { getEffectiveQueryFilter } from '@/lib/multi-business/business-scope';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getEffectiveQueryFilter', () => {
  it('scopes a regular user to their own rows (userId filter)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: false,
      activeOrganizationId: null,
      organizationId: 'org-self',
    });
    await expect(getEffectiveQueryFilter('user-1')).resolves.toEqual({
      userId: 'user-1',
    });
    // A regular user never needs an ownership lookup.
    expect(mockPrisma.businessOwnership.findUnique).not.toHaveBeenCalled();
  });

  it('scopes a multi-business owner to their active org when ownership is valid', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: true,
      activeOrganizationId: 'org-brand-b',
      organizationId: 'org-parent',
    });
    mockPrisma.businessOwnership.findUnique.mockResolvedValue({
      isActive: true,
    });

    await expect(getEffectiveQueryFilter('owner-1')).resolves.toEqual({
      organizationId: 'org-brand-b',
    });
  });

  it('does NOT scope to a claimed active org the owner does not actually own', async () => {
    // Cross-tenant guard (SYN-1112 F3): a stale/forged activeOrganizationId must
    // not read another tenant's data AND must not widen to ALL tenants (an empty
    // {} filter = no WHERE scope). It fails CLOSED to the owner's home org.
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: true,
      activeOrganizationId: 'org-not-mine',
      organizationId: 'org-parent',
    });
    mockPrisma.businessOwnership.findUnique.mockResolvedValue(null);

    const filter = await getEffectiveQueryFilter('owner-1');
    expect(filter).not.toHaveProperty('organizationId', 'org-not-mine');
    // Fail-closed: scoped to the home org, never unscoped {}.
    expect(filter).toEqual({ organizationId: 'org-parent' });
  });

  it('fails closed to the home org when the ownership row is inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: true,
      activeOrganizationId: 'org-brand-b',
      organizationId: 'org-parent',
    });
    mockPrisma.businessOwnership.findUnique.mockResolvedValue({
      isActive: false,
    });

    await expect(getEffectiveQueryFilter('owner-1')).resolves.toEqual({
      organizationId: 'org-parent',
    });
  });

  it('fails closed to own rows when a revoked owner has no home org', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isMultiBusinessOwner: true,
      activeOrganizationId: 'org-not-mine',
      organizationId: null,
    });
    mockPrisma.businessOwnership.findUnique.mockResolvedValue(null);

    // No home org → own rows, still never unscoped {}.
    await expect(getEffectiveQueryFilter('owner-1')).resolves.toEqual({
      userId: 'owner-1',
    });
  });

  it('returns no filter when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(getEffectiveQueryFilter('ghost')).resolves.toEqual({});
  });

  it('throws when the database lookup fails', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('db down'));
    await expect(getEffectiveQueryFilter('user-1')).rejects.toThrow(
      /Failed to determine query filter/
    );
  });
});
