/**
 * Track B — client provisioning core (spec: docs/specs/spm-track-b-client-provisioning.md).
 *
 * Unit tests for lib/tenancy/provision-client-org.ts:
 *   - deriveClientSlug: deterministic idempotency anchor from IMMUTABLE inputs
 *     only (parentOrgId + externalRef — never the renameable brand slug) [S2'/§11,
 *     criterion 17]
 *   - provisionClientOrg create path: single transaction writing the child org,
 *     default roles, an ORG-LOCKED owner TeamInvitation, and an ENFORCING
 *     OrgBudgetPolicy row; audits provisioning.created; email is env-gated OFF
 *     by default [S1'/S4'/S7'/S8', criteria 6, 7, 8, 9]
 *
 * The provisioning logic runs for real; only the data layer (prisma), RBAC
 * seeding, audit logger, and email sender are mocked — same doctrine as
 * tests/unit/auth/invite-gate-routes.test.ts.
 */

// --- Infra mocks ----------------------------------------------------------
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockEnsureDefaultRoles = jest.fn();
jest.mock('@/lib/auth/rbac/ensure-default-roles', () => ({
  ensureDefaultRoles: (...a: unknown[]) => mockEnsureDefaultRoles(...a),
}));

const mockLogAuditEvent = jest.fn();
jest.mock('@/lib/audit/audit-logger', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

const mockSendInviteEmail = jest.fn();
jest.mock('@/lib/email/team-invite-email', () => ({
  sendBrandedTeamInviteEmail: (...a: unknown[]) => mockSendInviteEmail(...a),
}));

// --- Prisma mock ----------------------------------------------------------
const mockTxOrgCreate = jest.fn();
const mockTxInvitationCreate = jest.fn();
const mockTxBudgetCreate = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockInvitationFindFirst = jest.fn();
const mockOwnershipFindMany = jest.fn();
const mockTransaction = jest.fn();

const txMock = {
  organization: { create: (...a: unknown[]) => mockTxOrgCreate(...a) },
  teamInvitation: { create: (...a: unknown[]) => mockTxInvitationCreate(...a) },
  orgBudgetPolicy: { create: (...a: unknown[]) => mockTxBudgetCreate(...a) },
};

const prismaMock = {
  organization: { findUnique: (...a: unknown[]) => mockOrgFindUnique(...a) },
  teamInvitation: {
    findFirst: (...a: unknown[]) => mockInvitationFindFirst(...a),
  },
  businessOwnership: {
    findMany: (...a: unknown[]) => mockOwnershipFindMany(...a),
  },
  $transaction: (...a: unknown[]) => mockTransaction(...a),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

import {
  deriveClientSlug,
  provisionClientOrg,
} from '@/lib/tenancy/provision-client-org';

const INPUT = {
  parentOrgId: 'org-brand-1',
  externalRef: 'CRM-4711',
  clientName: 'Acme Restorations',
  ownerEmail: 'owner@acme.example',
  provisionedBy: 'user-brand-admin',
};

const EXPECTED_SLUG = deriveClientSlug('org-brand-1', 'CRM-4711');

const CHILD_ORG = {
  id: 'org-child-1',
  name: 'Acme Restorations',
  slug: EXPECTED_SLUG,
  plan: 'free',
  status: 'active',
  parentOrgId: 'org-brand-1',
  createdAt: new Date('2026-07-11T00:00:00Z'),
};

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.SYNTHEX_PROVISIONING_INVITE_EMAILS;
  jest.clearAllMocks();

  mockTxOrgCreate.mockResolvedValue(CHILD_ORG);
  mockTxInvitationCreate.mockResolvedValue({
    id: 'ti-1',
    email: 'owner@acme.example',
    status: 'sent',
    organizationId: 'org-child-1',
  });
  mockTxBudgetCreate.mockResolvedValue({ id: 'bp-1' });
  mockEnsureDefaultRoles.mockResolvedValue(undefined);
  mockOrgFindUnique.mockResolvedValue(null);
  mockInvitationFindFirst.mockResolvedValue(null);
  mockOwnershipFindMany.mockResolvedValue([]);
  mockLogAuditEvent.mockResolvedValue(undefined);
  mockSendInviteEmail.mockResolvedValue({ success: true });
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof txMock) => unknown) => fn(txMock)
  );
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// ===========================================================================
// deriveClientSlug (S2', criterion 17)
// ===========================================================================
describe("deriveClientSlug — deterministic idempotency anchor (S2')", () => {
  it('derives c-<12 lowercase base36 chars> from parentOrgId + externalRef', () => {
    const slug = deriveClientSlug('org-parent-1', 'CRM-4711');
    expect(slug).toMatch(/^c-[a-z0-9]{12}$/);
  });

  it('is deterministic — identical inputs always yield the identical slug', () => {
    expect(deriveClientSlug('org-parent-1', 'CRM-4711')).toBe(
      deriveClientSlug('org-parent-1', 'CRM-4711')
    );
  });

  it('changes when externalRef changes', () => {
    expect(deriveClientSlug('org-parent-1', 'CRM-4711')).not.toBe(
      deriveClientSlug('org-parent-1', 'CRM-4712')
    );
  });

  it('changes when parentOrgId changes (sibling brands never collide on the same ref)', () => {
    expect(deriveClientSlug('org-parent-1', 'CRM-4711')).not.toBe(
      deriveClientSlug('org-parent-2', 'CRM-4711')
    );
  });

  it('separator is collision-safe: (ab, c) and (a, bc) derive different slugs', () => {
    expect(deriveClientSlug('ab', 'c')).not.toBe(deriveClientSlug('a', 'bc'));
  });
});

// ===========================================================================
// provisionClientOrg — create path (S1'/S4'/S7'/S8')
// ===========================================================================
describe('provisionClientOrg — create path', () => {
  it('creates the child org in one transaction with parentOrgId + derived slug', async () => {
    const result = await provisionClientOrg(INPUT);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxOrgCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Acme Restorations',
          slug: EXPECTED_SLUG,
          plan: 'free',
          status: 'active',
          parentOrgId: 'org-brand-1',
        }),
      })
    );
    expect(result.replayed).toBe(false);
    expect(result.organization).toEqual(
      expect.objectContaining({ id: 'org-child-1', slug: EXPECTED_SLUG })
    );
  });

  it('stamps server-owned provisioning provenance into settings (display-only, §11)', async () => {
    await provisionClientOrg(INPUT);

    const data = mockTxOrgCreate.mock.calls[0][0].data;
    expect(data.settings.provisioning).toEqual(
      expect.objectContaining({
        externalRef: 'CRM-4711',
        parentOrgId: 'org-brand-1',
        provisionedBy: 'user-brand-admin',
      })
    );
  });

  it('seeds default RBAC roles inside the same transaction', async () => {
    await provisionClientOrg(INPUT);
    expect(mockEnsureDefaultRoles).toHaveBeenCalledWith('org-child-1', txMock);
  });

  it("creates an ORG-LOCKED owner TeamInvitation — never an InviteCode (S4', criterion 6)", async () => {
    const result = await provisionClientOrg(INPUT);

    expect(mockTxInvitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'owner@acme.example',
          role: 'owner',
          status: 'sent',
          organizationId: 'org-child-1',
          userId: 'user-brand-admin',
        }),
      })
    );
    expect(result.invitation).toEqual(
      expect.objectContaining({ id: 'ti-1', email: 'owner@acme.example' })
    );
  });

  it('writes an ENFORCING OrgBudgetPolicy with explicit ceilings — no log-only default survives (criterion 8)', async () => {
    await provisionClientOrg(INPUT);

    expect(mockTxBudgetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-child-1',
          enforcementMode: 'enforce',
          dailyCeilingUsd: expect.any(Number),
          monthlyCeilingUsd: expect.any(Number),
        }),
      })
    );
    const data = mockTxBudgetCreate.mock.calls[0][0].data;
    expect(data.dailyCeilingUsd).toBeGreaterThan(0);
    expect(data.monthlyCeilingUsd).toBeGreaterThan(0);
  });

  it('audits provisioning.created with org identifiers in details (criterion 9)', async () => {
    await provisionClientOrg(INPUT);

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'provisioning.created',
        userId: 'user-brand-admin',
        metadata: expect.objectContaining({
          organizationId: 'org-child-1',
          parentOrgId: 'org-brand-1',
          externalRef: 'CRM-4711',
        }),
      })
    );
  });

  it('does NOT send the invite email when the env gate is unset (criterion 7 — off by default)', async () => {
    const result = await provisionClientOrg(INPUT);
    expect(mockSendInviteEmail).not.toHaveBeenCalled();
    expect(result.emailQueued).toBe(false);
  });

  it('sends the branded invite email when SYNTHEX_PROVISIONING_INVITE_EMAILS=true (criterion 7)', async () => {
    process.env.SYNTHEX_PROVISIONING_INVITE_EMAILS = 'true';

    const result = await provisionClientOrg(INPUT);

    expect(mockSendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@acme.example',
        invitationId: 'ti-1',
      })
    );
    expect(result.emailQueued).toBe(true);
  });

  it('a failed email send never fails provisioning (best-effort)', async () => {
    process.env.SYNTHEX_PROVISIONING_INVITE_EMAILS = 'true';
    mockSendInviteEmail.mockRejectedValue(new Error('smtp down'));

    const result = await provisionClientOrg(INPUT);

    expect(result.organization.id).toBe('org-child-1');
    expect(result.emailQueued).toBe(false);
  });
});

// ===========================================================================
// provisionClientOrg — P2002 replay path (S2', criteria 1 & 17)
// ===========================================================================
describe('provisionClientOrg — replay path (slug unique index arbitrates)', () => {
  beforeEach(() => {
    // The DB unique index rejects the duplicate slug — duck-typed P2002.
    mockTransaction.mockRejectedValue({ code: 'P2002' });
  });

  it('returns the existing ACTIVE child with replayed=true and audits replay_detected', async () => {
    mockOrgFindUnique.mockResolvedValue(CHILD_ORG);
    mockInvitationFindFirst.mockResolvedValue({
      id: 'ti-existing',
      email: 'owner@acme.example',
      status: 'sent',
    });

    const result = await provisionClientOrg(INPUT);

    expect(result.replayed).toBe(true);
    expect(result.organization.id).toBe('org-child-1');
    expect(result.invitation).toEqual(
      expect.objectContaining({ id: 'ti-existing' })
    );
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'provisioning.replay_detected',
        metadata: expect.objectContaining({
          organizationId: 'org-child-1',
          externalRef: 'CRM-4711',
        }),
      })
    );
  });

  it('returns a SUSPENDED child with its status flagged, not hidden', async () => {
    mockOrgFindUnique.mockResolvedValue({ ...CHILD_ORG, status: 'suspended' });

    const result = await provisionClientOrg(INPUT);

    expect(result.replayed).toBe(true);
    expect(result.organization.status).toBe('suspended');
  });

  it('replay never sends an email even when the env gate is on', async () => {
    process.env.SYNTHEX_PROVISIONING_INVITE_EMAILS = 'true';
    mockOrgFindUnique.mockResolvedValue(CHILD_ORG);

    const result = await provisionClientOrg(INPUT);

    expect(result.replayed).toBe(true);
    expect(mockSendInviteEmail).not.toHaveBeenCalled();
    expect(result.emailQueued).toBe(false);
  });

  it('throws TOMBSTONED conflict when the slug holder is soft-deleted (criterion 17)', async () => {
    mockOrgFindUnique.mockResolvedValue({ ...CHILD_ORG, status: 'deleted' });

    await expect(provisionClientOrg(INPUT)).rejects.toMatchObject({
      name: 'ProvisionConflictError',
      reason: 'TOMBSTONED',
    });
  });

  it('throws SLUG_COLLISION when the slug is held outside this brand', async () => {
    mockOrgFindUnique.mockResolvedValue({
      ...CHILD_ORG,
      parentOrgId: 'org-other-brand',
    });

    await expect(provisionClientOrg(INPUT)).rejects.toMatchObject({
      name: 'ProvisionConflictError',
      reason: 'SLUG_COLLISION',
    });
  });

  it('rethrows non-P2002 transaction failures untouched', async () => {
    const dbDown = new Error('connection refused');
    mockTransaction.mockRejectedValue(dbDown);

    await expect(provisionClientOrg(INPUT)).rejects.toBe(dbDown);
    expect(mockOrgFindUnique).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// provisionClientOrg — duplicate-business advisory (S9', criterion 11)
// ===========================================================================
describe('provisionClientOrg — duplicate-business advisory', () => {
  it('returns a non-blocking advisory when the caller already owns a business with this name', async () => {
    mockOwnershipFindMany.mockResolvedValue([
      { organization: { id: 'org-owned-1', name: 'ACME Restorations ' } },
      { organization: { id: 'org-owned-2', name: 'Different Biz' } },
    ]);

    const result = await provisionClientOrg(INPUT);

    // Provisioning still proceeds — advisory only.
    expect(result.organization.id).toBe('org-child-1');
    expect(result.advisory).toEqual({
      duplicateBusinessName: true,
      matches: [{ organizationId: 'org-owned-1', name: 'ACME Restorations ' }],
    });
  });

  it('advisory is null when no owned business shares the name', async () => {
    mockOwnershipFindMany.mockResolvedValue([
      { organization: { id: 'org-owned-2', name: 'Different Biz' } },
    ]);

    const result = await provisionClientOrg(INPUT);
    expect(result.advisory).toBeNull();
  });
});
