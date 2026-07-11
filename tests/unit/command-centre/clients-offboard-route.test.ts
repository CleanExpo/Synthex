/**
 * Track B — client offboarding route (spec S6', criterion 5).
 *
 * POST /api/command-centre/clients/[id]/offboard — suspend the child org and
 * cut it off on every org-scoped plane in one transaction:
 *   (a) revoke every mcp_api_keys row (idempotent soft-revoke)
 *   (e) flip provisioning TeamInvitations out of the evidence set
 *   (d) neutralise ALL member home pointers (organizationId AND
 *       activeOrganizationId — owner and collaborators)
 * plus the status flip that the (b) MCP-auth, (c) withAuth and
 * (f) getEffectiveOrganizationId chokepoint gates key off.
 *
 * The two v1 residuals are DOCUMENTED, not silently passed (adversary-amended
 * criterion 5): already-issued JWT sessions survive until expiry, and
 * org-agnostic image generation (clientId=null) is untouched by org
 * suspension. The response names both.
 *
 * withAuth runs FOR REAL — only jwt identity, prisma, and the audit logger
 * are mocked.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

// --- Infra mocks ----------------------------------------------------------
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

const mockLogAuditEvent = jest.fn();
jest.mock('@/lib/audit/audit-logger', () => ({
  logAuditEvent: (...a: unknown[]) => mockLogAuditEvent(...a),
}));

// --- Prisma mock ----------------------------------------------------------
const mockUserFindUnique = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockTxOrgUpdate = jest.fn();
const mockTxKeyUpdateMany = jest.fn();
const mockTxInvitationUpdateMany = jest.fn();
const mockTxUserUpdateMany = jest.fn();
const mockTransaction = jest.fn();

const txMock = {
  organization: { update: (...a: unknown[]) => mockTxOrgUpdate(...a) },
  mcpApiKey: { updateMany: (...a: unknown[]) => mockTxKeyUpdateMany(...a) },
  teamInvitation: {
    updateMany: (...a: unknown[]) => mockTxInvitationUpdateMany(...a),
  },
  user: { updateMany: (...a: unknown[]) => mockTxUserUpdateMany(...a) },
};

const prismaMock = {
  user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  organization: { findUnique: (...a: unknown[]) => mockOrgFindUnique(...a) },
  $transaction: (...a: unknown[]) => mockTransaction(...a),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

import { POST } from '@/app/api/command-centre/clients/[id]/offboard/route';

const CHILD_ID = 'org-child-1';

function offboardRequest(id: string = CHILD_ID) {
  return createMockNextRequest({
    method: 'POST',
    url: `http://localhost/api/command-centre/clients/${id}/offboard`,
    body: {},
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-brand-admin');
  // Brand admin (owner) of org-brand-1.
  mockUserFindUnique.mockResolvedValue({
    organizationId: 'org-brand-1',
    teamMemberships: [],
  });
  // The child belongs to the caller's brand.
  mockOrgFindUnique.mockResolvedValue({
    id: CHILD_ID,
    parentOrgId: 'org-brand-1',
    status: 'active',
  });
  mockTxOrgUpdate.mockResolvedValue({ id: CHILD_ID, status: 'suspended' });
  mockTxKeyUpdateMany.mockResolvedValue({ count: 2 });
  mockTxInvitationUpdateMany.mockResolvedValue({ count: 1 });
  mockTxUserUpdateMany.mockResolvedValue({ count: 3 });
  mockLogAuditEvent.mockResolvedValue(undefined);
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof txMock) => unknown) => fn(txMock)
  );
});

// ===========================================================================
// Authz
// ===========================================================================
describe('POST offboard — authz', () => {
  it('401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(offboardRequest());
    expect(res.status).toBe(401);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('403 for a collaborator', async () => {
    mockUserFindUnique.mockResolvedValue({
      organizationId: 'org-brand-1',
      teamMemberships: [
        { role: 'collaborator', organizationId: 'org-brand-1' },
      ],
    });
    const res = await POST(offboardRequest());
    expect(res.status).toBe(403);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('403 when the child belongs to a DIFFERENT brand (no cross-brand offboard)', async () => {
    mockOrgFindUnique.mockResolvedValue({
      id: CHILD_ID,
      parentOrgId: 'org-other-brand',
      status: 'active',
    });
    const res = await POST(offboardRequest());
    expect(res.status).toBe(403);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('403 (never 404-leak) when the child does not exist', async () => {
    mockOrgFindUnique.mockResolvedValue(null);
    const res = await POST(offboardRequest('org-ghost'));
    expect(res.status).toBe(403);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Enforcement effects (S6' chokepoints a, d, e + the status flip)
// ===========================================================================
describe('POST offboard — enforcement effects', () => {
  it('suspends the child org', async () => {
    const res = await POST(offboardRequest());
    expect(res.status).toBe(200);
    expect(mockTxOrgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CHILD_ID },
        data: expect.objectContaining({ status: 'suspended' }),
      })
    );
  });

  it('revokes every un-revoked MCP key for the child (idempotent soft-revoke)', async () => {
    await POST(offboardRequest());
    expect(mockTxKeyUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: CHILD_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      })
    );
  });

  it('flips open provisioning invitations out of the evidence set', async () => {
    await POST(offboardRequest());
    expect(mockTxInvitationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: CHILD_ID,
          status: { in: ['sent', 'pending'] },
        }),
        data: { status: 'revoked' },
      })
    );
  });

  it('neutralises home pointers for EVERY member — organizationId AND activeOrganizationId', async () => {
    await POST(offboardRequest());
    expect(mockTxUserUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: CHILD_ID },
        data: { organizationId: null },
      })
    );
    expect(mockTxUserUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { activeOrganizationId: CHILD_ID },
        data: { activeOrganizationId: null },
      })
    );
  });

  it('audits provisioning.offboarded with the enforcement counts', async () => {
    await POST(offboardRequest());
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'provisioning.offboarded',
        userId: 'user-brand-admin',
        metadata: expect.objectContaining({
          organizationId: CHILD_ID,
          parentOrgId: 'org-brand-1',
        }),
      })
    );
  });

  it('returns the enforced-state summary AND documents the two v1 residuals', async () => {
    const res = await POST(offboardRequest());
    const json = await res.json();

    expect(json).toEqual(
      expect.objectContaining({
        success: true,
        organizationId: CHILD_ID,
        status: 'suspended',
        enforcement: expect.objectContaining({
          keysRevoked: 2,
          invitationsRevoked: 1,
        }),
      })
    );
    // Criterion 5 (adversary-amended): residuals are named, never claimed closed.
    const residuals = JSON.stringify(json.residuals);
    expect(residuals).toMatch(/session/i);
    expect(residuals).toMatch(/image/i);
  });

  it('is idempotent — offboarding an already-suspended child still returns 200', async () => {
    mockOrgFindUnique.mockResolvedValue({
      id: CHILD_ID,
      parentOrgId: 'org-brand-1',
      status: 'suspended',
    });
    mockTxKeyUpdateMany.mockResolvedValue({ count: 0 });
    mockTxInvitationUpdateMany.mockResolvedValue({ count: 0 });
    mockTxUserUpdateMany.mockResolvedValue({ count: 0 });

    const res = await POST(offboardRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('suspended');
  });
});
