/**
 * Integration test — PATCH /api/businesses/switch manage-as hardening (Item #4).
 *
 * Proves the org-switch ("manage-as") endpoint returns 403 on a CROSS-ORG
 * switch attempt: a multi-business owner trying to switch into an organisation
 * they do NOT own (no active BusinessOwnership row) is denied, and
 * setActiveOrganization is never called.
 *
 * Mirrors tests/unit/marketing-agency/agents-route.test.ts: mock @/lib/prisma
 * and @/lib/auth/jwt-utils, exercise the real route handler.
 */

// ── Mocks — declared before importing the route under test ──────────────────
const findFirstOwnership = jest.fn();

jest.mock('@/lib/prisma', () => {
  const mockPrisma = {
    businessOwnership: {
      findFirst: (...a: unknown[]) => findFirstOwnership(...a),
    },
  };
  return { __esModule: true, default: mockPrisma, prisma: mockPrisma };
});

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));

const isMultiBusinessOwnerMock = jest.fn();
const setActiveOrganizationMock = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  isMultiBusinessOwner: (...a: unknown[]) => isMultiBusinessOwnerMock(...a),
  setActiveOrganization: (...a: unknown[]) => setActiveOrganizationMock(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { PATCH } from '@/app/api/businesses/switch/route';

function makeRequest(body: unknown) {
  return {
    json: async () => body,
  } as unknown as Parameters<typeof PATCH>[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('owner-1');
  isMultiBusinessOwnerMock.mockResolvedValue(true);
});

describe('PATCH /api/businesses/switch — manage-as cross-org hardening', () => {
  test('CROSS-ORG switch → 403, no context change', async () => {
    // The caller is a multi-business owner, but owns no active BusinessOwnership
    // row for the target org → findFirst resolves null.
    findFirstOwnership.mockResolvedValue(null);

    const res = await PATCH(makeRequest({ organizationId: 'org-not-mine' }));

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
    // The org context must NOT have been switched.
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
  });

  test('non-multi-business-owner → 403 before any ownership lookup', async () => {
    isMultiBusinessOwnerMock.mockResolvedValue(false);

    const res = await PATCH(makeRequest({ organizationId: 'org-x' }));

    expect(res.status).toBe(403);
    expect(findFirstOwnership).not.toHaveBeenCalled();
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
  });

  test('unauthenticated → 401', async () => {
    getUserIdMock.mockResolvedValue(null);

    const res = await PATCH(makeRequest({ organizationId: 'org-x' }));

    expect(res.status).toBe(401);
    expect(isMultiBusinessOwnerMock).not.toHaveBeenCalled();
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
  });

  test('OWNED org switch → 200, context switched (gate is not blanket-deny)', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    findFirstOwnership.mockResolvedValue({
      id: 'bo-1',
      organizationId: 'org-mine',
      displayName: 'My Brand',
      isActive: true,
      billingStatus: 'active',
      monthlyRate: 0,
      createdAt: now,
      updatedAt: now,
      organization: {
        id: 'org-mine',
        name: 'My Brand',
        slug: 'my-brand',
        plan: 'pro',
        status: 'active',
      },
    });
    setActiveOrganizationMock.mockResolvedValue(undefined);

    const res = await PATCH(makeRequest({ organizationId: 'org-mine' }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activeOrganizationId).toBe('org-mine');
    expect(setActiveOrganizationMock).toHaveBeenCalledWith('owner-1', 'org-mine');
  });
});
