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
import { checkOrganizationAccess } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';
import {
  createPrismaRowStore,
  type RowStoreMethod,
  type RowStoreModel,
  type RowStoreTarget,
} from '@/tests/helpers/prisma-row-store';

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

// -- SYN-1412 -- the access rule with read errors preserved -------------------
// checkOrganizationAccess is the rule; hasOrganizationAccess is the same rule
// with a failed read logged and answered as "no access". These cases run both
// over stored rows (tests/helpers/prisma-row-store.ts), reached through the
// same mocked client as the cases above: each read applies its own `where` to
// the rows, decoys included, and a failed read rejects with the planted error.
describe('organisation access with read errors preserved (SYN-1412)', () => {
  const accessRows = createPrismaRowStore();

  type Read = (args: unknown) => Promise<unknown>;
  const rowRead =
    (model: RowStoreModel, method: RowStoreMethod): Read =>
    args =>
      (accessRows.client[model] as Record<RowStoreMethod, Read>)[method](args);

  const USER_ID = 'user-1';
  const TARGET_ID = 'org-child';
  const PARENT_ID = 'org-parent';

  interface Caller {
    /** The organisation user-1 belongs to. */
    home: string;
    isMultiBusinessOwner: boolean;
    /** user-1's ownership of the target organisation, if a row exists. */
    ownership: 'active' | 'inactive' | 'none';
  }

  // The five fixtures of the truth table. Each differs from a neighbour in one
  // field: the owner without the flag from the active owner (the flag), the
  // stranger from the parent-workspace member (the home organisation).
  const DIRECT_MEMBER: Caller = {
    home: TARGET_ID,
    isMultiBusinessOwner: false,
    ownership: 'none',
  };
  const ACTIVE_OWNER: Caller = {
    home: 'org-other',
    isMultiBusinessOwner: true,
    ownership: 'active',
  };
  const OWNER_WITHOUT_FLAG: Caller = {
    home: 'org-other',
    isMultiBusinessOwner: false,
    ownership: 'active',
  };
  const PARENT_MEMBER: Caller = {
    home: PARENT_ID,
    isMultiBusinessOwner: true,
    ownership: 'inactive',
  };
  const STRANGER: Caller = {
    home: 'org-other',
    isMultiBusinessOwner: true,
    ownership: 'inactive',
  };

  /**
   * Seed who exists. Beside user-1 there are decoys that must not count for
   * user-1: another user who is a member and an active owner of the target;
   * another user in the parent workspace; and user-1's own active ownership
   * of a sibling organisation.
   */
  function seedCaller(caller: Caller) {
    accessRows.seed({
      organization: [
        {
          id: PARENT_ID,
          name: 'Parent Workspace',
          slug: 'parent',
          parentOrgId: null,
        },
        {
          id: TARGET_ID,
          name: 'Child Brand',
          slug: 'child',
          parentOrgId: PARENT_ID,
        },
        {
          id: 'org-other',
          name: 'Sibling Brand',
          slug: 'sibling',
          parentOrgId: PARENT_ID,
        },
      ],
      user: [
        {
          id: USER_ID,
          organizationId: caller.home,
          isMultiBusinessOwner: caller.isMultiBusinessOwner,
        },
        { id: 'user-2', organizationId: TARGET_ID, isMultiBusinessOwner: true },
        {
          id: 'user-3',
          organizationId: PARENT_ID,
          isMultiBusinessOwner: false,
        },
      ],
      businessOwnership: [
        { ownerId: 'user-2', organizationId: TARGET_ID, isActive: true },
        { ownerId: USER_ID, organizationId: 'org-other', isActive: true },
        ...(caller.ownership === 'none'
          ? []
          : [
              {
                ownerId: USER_ID,
                organizationId: TARGET_ID,
                isActive: caller.ownership === 'active',
              },
            ]),
      ],
    });
  }

  // The rule's four reads, each named by the question it asks. `organization`
  // is read twice: by the target's id (its membership) and by the parent's id.
  const USER_READ: RowStoreTarget = { model: 'user' };
  const OWNERSHIP_READ: RowStoreTarget = { model: 'businessOwnership' };
  const MEMBERSHIP_READ: RowStoreTarget = {
    model: 'organization',
    where: where => where.id === TARGET_ID,
  };
  const PARENT_READ: RowStoreTarget = {
    model: 'organization',
    where: where => where.id === PARENT_ID,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    accessRows.reset();
    mockPrisma.user.findUnique.mockImplementation(
      rowRead('user', 'findUnique')
    );
    mockPrisma.businessOwnership.findUnique.mockImplementation(
      rowRead('businessOwnership', 'findUnique')
    );
    mockPrisma.organization.findUnique.mockImplementation(
      rowRead('organization', 'findUnique')
    );
    mockPrisma.organization.findFirst.mockImplementation(
      rowRead('organization', 'findFirst')
    );
  });

  afterEach(() => {
    // A query the row store does not know is a fault in the test set-up, even
    // when hasOrganizationAccess caught it and answered false.
    expect(accessRows.usageErrors).toEqual([]);
  });

  /**
   * The caller is a member of the parent workspace only: the rule reaches all
   * four of its reads for that caller and then grants, which the first line
   * shows. One thing then differs: one read fails.
   */
  async function checkThrowsWhenReadFails(target: RowStoreTarget) {
    seedCaller(PARENT_MEMBER);
    expect(await checkOrganizationAccess(USER_ID, TARGET_ID)).toBe(true);

    const planted = new Error('planted: this read failed');
    accessRows.fail(target, planted);

    await expect(checkOrganizationAccess(USER_ID, TARGET_ID)).rejects.toBe(
      planted
    );
  }

  /** The same failure through the wrapper: logged once, answered as false. */
  async function hasAnswersFalseAndLogsWhenReadFails(target: RowStoreTarget) {
    seedCaller(PARENT_MEMBER);
    expect(await hasOrganizationAccess(USER_ID, TARGET_ID)).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();

    const planted = new Error('planted: this read failed');
    accessRows.fail(target, planted);

    expect(await hasOrganizationAccess(USER_ID, TARGET_ID)).toBe(false);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to check organization access',
      {
        userId: USER_ID,
        organizationId: TARGET_ID,
        error: 'planted: this read failed',
      }
    );
  }

  /**
   * Both functions give the stated answer for this caller, with the parent
   * workspace counted (the default) and with it left out.
   */
  async function bothAnswer(
    caller: Caller,
    expected: { withParent: boolean; direct: boolean }
  ) {
    seedCaller(caller);
    const direct = { includeParentWorkspace: false };

    const checked = await checkOrganizationAccess(USER_ID, TARGET_ID);
    expect(checked).toBe(expected.withParent);
    expect(await hasOrganizationAccess(USER_ID, TARGET_ID)).toBe(checked);

    const checkedDirect = await checkOrganizationAccess(
      USER_ID,
      TARGET_ID,
      direct
    );
    expect(checkedDirect).toBe(expected.direct);
    expect(await hasOrganizationAccess(USER_ID, TARGET_ID, direct)).toBe(
      checkedDirect
    );
    expect(logger.error).not.toHaveBeenCalled();
  }

  describe('checkOrganizationAccess lets a failed read throw', () => {
    it('checkOrganizationAccess throws when the user read fails', () =>
      checkThrowsWhenReadFails(USER_READ));

    it('checkOrganizationAccess throws when the ownership read fails', () =>
      checkThrowsWhenReadFails(OWNERSHIP_READ));

    it('checkOrganizationAccess throws when the organisation membership read fails', () =>
      checkThrowsWhenReadFails(MEMBERSHIP_READ));

    it('checkOrganizationAccess throws when the parent organisation read fails', () =>
      checkThrowsWhenReadFails(PARENT_READ));
  });

  describe('hasOrganizationAccess keeps treating a failed read as no access', () => {
    it('hasOrganizationAccess still returns false and logs when the user read fails', () =>
      hasAnswersFalseAndLogsWhenReadFails(USER_READ));

    it('hasOrganizationAccess still returns false and logs when the ownership read fails', () =>
      hasAnswersFalseAndLogsWhenReadFails(OWNERSHIP_READ));

    it('hasOrganizationAccess still returns false and logs when the organisation membership read fails', () =>
      hasAnswersFalseAndLogsWhenReadFails(MEMBERSHIP_READ));

    it('hasOrganizationAccess still returns false and logs when the parent organisation read fails', () =>
      hasAnswersFalseAndLogsWhenReadFails(PARENT_READ));
  });

  describe('the two functions agree when every read works', () => {
    it('checkOrganizationAccess and hasOrganizationAccess agree for a direct member', () =>
      bothAnswer(DIRECT_MEMBER, { withParent: true, direct: true }));

    it('checkOrganizationAccess and hasOrganizationAccess agree for an active owner with the multi-business flag', () =>
      bothAnswer(ACTIVE_OWNER, { withParent: true, direct: true }));

    it('checkOrganizationAccess and hasOrganizationAccess agree for an owner without the multi-business flag', () =>
      bothAnswer(OWNER_WITHOUT_FLAG, { withParent: false, direct: false }));

    it('checkOrganizationAccess and hasOrganizationAccess agree for a parent-workspace member', () =>
      bothAnswer(PARENT_MEMBER, { withParent: true, direct: false }));

    it('checkOrganizationAccess and hasOrganizationAccess agree for a stranger', () =>
      bothAnswer(STRANGER, { withParent: false, direct: false }));
  });
});
