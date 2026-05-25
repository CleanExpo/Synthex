/**
 * Agency API RBAC — SYN-971
 */

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: jest.fn(),
  isOwnerEmail: jest.fn().mockReturnValue(false),
}));

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveQueryFilter: jest.fn(),
  getEffectiveOrganizationId: jest.fn(),
}));

const mockGetUserPermissions = jest.fn();
const mockCheckAny = jest.fn();
jest.mock('@/lib/auth/rbac/permission-engine', () => ({
  PermissionEngine: {
    getUserPermissions: (...args: unknown[]) => mockGetUserPermissions(...args),
    checkAny: (...args: unknown[]) => mockCheckAny(...args),
  },
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'member@example.com' }),
    },
  },
}));

import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveQueryFilter } from '@/lib/multi-business/business-scope';
import {
  enforceAgencyPermission,
  AGENCY_CEO_QUEUE_READ,
} from '@/lib/agency/agency-api-auth';
import { createMockNextRequest } from '../../../helpers/mock-request';

const mockGetUserId = getUserIdFromRequestOrCookies as jest.Mock;
const mockGetFilter = getEffectiveQueryFilter as jest.Mock;

describe('enforceAgencyPermission', () => {
  beforeEach(() => {
    mockGetUserPermissions.mockReset();
    mockCheckAny.mockReset();
  });

  it('allows when user has no RBAC roles (legacy org access)', async () => {
    mockGetUserPermissions.mockResolvedValue(null);
    const result = await enforceAgencyPermission(
      'user-1',
      'org-1',
      AGENCY_CEO_QUEUE_READ
    );
    expect(result).toBeNull();
    expect(mockCheckAny).not.toHaveBeenCalled();
  });

  it('returns 403 when roles exist but permission denied', async () => {
    mockGetUserPermissions.mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',
      permissions: ['posts:read'],
      roles: [],
      cachedAt: new Date(),
    });
    mockCheckAny.mockResolvedValue(false);

    const result = await enforceAgencyPermission(
      'user-1',
      'org-1',
      AGENCY_CEO_QUEUE_READ
    );
    expect(result).not.toBeNull();
    expect((result as { status: number }).status).toBe(403);
  });
});

describe('requireAgencyOrg', () => {
  beforeEach(() => {
    mockGetUserId.mockResolvedValue('user-1');
    mockGetFilter.mockResolvedValue({ organizationId: 'org-1' });
  });

  it('returns 401 without session', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { requireAgencyOrg } = await import('@/lib/agency/agency-api-auth');
    const res = await requireAgencyOrg(
      createMockNextRequest({ method: 'GET' }) as never
    );
    expect((res as { status: number }).status).toBe(401);
  });
});
