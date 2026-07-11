/**
 * Track B — command-centre client provisioning routes (spec S3'/§9.2,
 * criteria 3 & 12).
 *
 * POST /api/command-centre/clients — provision a client child-org.
 *   The parent is derived from the AUTHENTICATED SESSION ORG ONLY (withAuth
 *   clientId). No request parameter can select it; a caller whose org is
 *   itself a child is rejected (depth-2 cap); collaborators are rejected
 *   (brand-admin only).
 * GET /api/command-centre/clients — list the caller-org's children (scoping
 *   copied from /api/organisations/children).
 *
 * withAuth runs FOR REAL here — only jwt identity + prisma + the provisioning
 * core are mocked — so the 401/403 paths are genuinely exercised.
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

const mockProvision = jest.fn();
jest.mock('@/lib/tenancy/provision-client-org', () => {
  const actual = jest.requireActual('@/lib/tenancy/provision-client-org');
  return {
    ...actual,
    provisionClientOrg: (...a: unknown[]) => mockProvision(...a),
  };
});

// --- Prisma mock ----------------------------------------------------------
const mockUserFindUnique = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockOrgFindMany = jest.fn();

const prismaMock = {
  user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  organization: {
    findUnique: (...a: unknown[]) => mockOrgFindUnique(...a),
    findMany: (...a: unknown[]) => mockOrgFindMany(...a),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

import { ProvisionConflictError } from '@/lib/tenancy/provision-client-org';
import { POST, GET } from '@/app/api/command-centre/clients/route';

const VALID_BODY = {
  externalRef: 'CRM-4711',
  clientName: 'Acme Restorations',
  ownerEmail: 'owner@acme.example',
};

const PROVISION_RESULT = {
  organization: {
    id: 'org-child-1',
    name: 'Acme Restorations',
    slug: 'c-abc123def456',
    plan: 'free',
    status: 'active',
    parentOrgId: 'org-brand-1',
    createdAt: new Date('2026-07-11T00:00:00Z'),
  },
  invitation: { id: 'ti-1', email: 'owner@acme.example', status: 'sent' },
  replayed: false,
  advisory: null,
  emailQueued: false,
};

function postRequest(body: object) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/command-centre/clients',
    body,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-brand-admin');
  // withAuth resolution: brand admin, owner of org-brand-1 (no membership row
  // = direct creator = owner).
  mockUserFindUnique.mockResolvedValue({
    organizationId: 'org-brand-1',
    teamMemberships: [],
    name: 'Phill',
  });
  // Parent validation lookup: org-brand-1 is a ROOT org.
  mockOrgFindUnique.mockResolvedValue({
    id: 'org-brand-1',
    parentOrgId: null,
    status: 'active',
  });
  mockOrgFindMany.mockResolvedValue([]);
  mockProvision.mockResolvedValue(PROVISION_RESULT);
});

// ===========================================================================
// POST — authz (criterion 12)
// ===========================================================================
describe('POST /api/command-centre/clients — authz', () => {
  it('401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect(mockProvision).not.toHaveBeenCalled();
  });

  it('403 when the user has no organisation', async () => {
    mockUserFindUnique.mockResolvedValue({
      organizationId: null,
      teamMemberships: [],
    });
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(mockProvision).not.toHaveBeenCalled();
  });

  it('403 for a collaborator — provisioning is brand-admin (owner) only', async () => {
    mockUserFindUnique.mockResolvedValue({
      organizationId: 'org-brand-1',
      teamMemberships: [
        { role: 'collaborator', organizationId: 'org-brand-1' },
      ],
    });
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(mockProvision).not.toHaveBeenCalled();
  });

  it("403 when the caller's org is itself a child (depth-2 cap, S3')", async () => {
    mockOrgFindUnique.mockResolvedValue({
      id: 'org-brand-1',
      parentOrgId: 'org-root',
      status: 'active',
    });
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(mockProvision).not.toHaveBeenCalled();
  });

  it('403 (never a 404 leak) when the session org row is missing', async () => {
    mockOrgFindUnique.mockResolvedValue(null);
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(mockProvision).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// POST — parent derivation (criteria 3 & 12: session org ONLY)
// ===========================================================================
describe('POST /api/command-centre/clients — parent derivation', () => {
  it('derives the parent from the session org, never from the body', async () => {
    const res = await POST(
      postRequest({
        ...VALID_BODY,
        // Hostile: caller tries to select a foreign parent — must be ignored.
        parentOrgId: 'org-victim-brand',
        parent: 'org-victim-brand',
      })
    );

    expect(res.status).toBe(201);
    expect(mockProvision).toHaveBeenCalledWith(
      expect.objectContaining({
        parentOrgId: 'org-brand-1',
        externalRef: 'CRM-4711',
        provisionedBy: 'user-brand-admin',
      })
    );
    const arg = mockProvision.mock.calls[0][0];
    expect(arg.parentOrgId).toBe('org-brand-1');
  });
});

// ===========================================================================
// POST — validation + outcomes
// ===========================================================================
describe('POST /api/command-centre/clients — validation and outcomes', () => {
  it('400 on missing externalRef', async () => {
    const res = await POST(
      postRequest({ clientName: 'Acme', ownerEmail: 'a@b.example' })
    );
    expect(res.status).toBe(400);
    expect(mockProvision).not.toHaveBeenCalled();
  });

  it('400 on invalid ownerEmail', async () => {
    const res = await POST(
      postRequest({ ...VALID_BODY, ownerEmail: 'not-an-email' })
    );
    expect(res.status).toBe(400);
    expect(mockProvision).not.toHaveBeenCalled();
  });

  it('201 with org + invitation summary on first provision', async () => {
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual(
      expect.objectContaining({
        success: true,
        replayed: false,
        organization: expect.objectContaining({
          id: 'org-child-1',
          slug: 'c-abc123def456',
        }),
        invitation: expect.objectContaining({ id: 'ti-1' }),
      })
    );
  });

  it('200 with replayed=true on idempotent replay', async () => {
    mockProvision.mockResolvedValue({ ...PROVISION_RESULT, replayed: true });
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.replayed).toBe(true);
  });

  it('409 when the core reports a tombstoned replay', async () => {
    mockProvision.mockRejectedValue(
      new ProvisionConflictError('TOMBSTONED', 'held by a deleted org')
    );
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });

  it('500 (not a leak) on unexpected core failure', async () => {
    mockProvision.mockRejectedValue(new Error('db down'));
    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// GET — children list (scoping copied from /api/organisations/children)
// ===========================================================================
describe('GET /api/command-centre/clients — children list', () => {
  function getRequest() {
    return createMockNextRequest({
      method: 'GET',
      url: 'http://localhost/api/command-centre/clients',
    });
  }

  it('401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it('lists ONLY children of the caller org — no request parameter selects the parent (criterion 12)', async () => {
    mockOrgFindMany.mockResolvedValue([
      {
        id: 'org-child-1',
        slug: 'c-abc',
        name: 'Acme',
        status: 'active',
        plan: 'free',
        createdAt: new Date('2026-07-11T00:00:00Z'),
      },
    ]);

    const res = await GET(getRequest());

    expect(res.status).toBe(200);
    expect(mockOrgFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parentOrgId: 'org-brand-1' },
      })
    );
    const json = await res.json();
    expect(json.children).toHaveLength(1);
    expect(json.children[0]).toEqual(
      expect.objectContaining({ id: 'org-child-1', status: 'active' })
    );
  });
});
