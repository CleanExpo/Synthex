/**
 * SYN-1216 — GET /api/auth/user restamps a stale incomplete JWT when
 * the database (or owner bypass) already says onboarding is complete.
 */

const mockGetUserId = jest.fn();
const mockVerifyTokenSafe = jest.fn();
const mockGenerateToken = jest.fn();
const mockIsOwnerEmail = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => {
  const { NextResponse } = require('next/server');
  return {
    getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
    verifyTokenSafe: (...a: unknown[]) => mockVerifyTokenSafe(...a),
    generateToken: (...a: unknown[]) => mockGenerateToken(...a),
    isOwnerEmail: (...a: unknown[]) => mockIsOwnerEmail(...a),
    unauthorizedResponse: () =>
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
});

const mockUserFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  };
  return { __esModule: true, prisma: prismaMock, default: prismaMock };
});

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { GET } from '@/app/api/auth/user/route';

function getRequest(cookieValue?: string) {
  const req = createMockNextRequest({
    method: 'GET',
    url: 'http://localhost/api/auth/user',
  }) as unknown as import('next/server').NextRequest;

  (
    req as { cookies: { get: (name: string) => { value: string } | undefined } }
  ).cookies = {
    get: (name: string) =>
      name === 'auth-token' && cookieValue ? { value: cookieValue } : undefined,
  };

  return req;
}

const dbUser = {
  id: 'user_1',
  email: 'user@x.com',
  name: 'User',
  avatar: null,
  emailVerified: null,
  createdAt: new Date(),
  lastLogin: new Date(),
  preferences: {},
  organizationId: 'org_1',
  isMultiBusinessOwner: false,
  activeOrganizationId: 'org_1',
  onboardingComplete: true,
  onboardingStep: 3,
  businessProfileComplete: true,
  apiKeyConfigured: true,
  apiKeyValid: true,
  timezone: 'Australia/Sydney',
  conversionCopyVariant: 'control',
  organization: { id: 'org_1', name: 'Acme', slug: 'acme', plan: 'starter' },
  _count: {
    campaigns: 0,
    projects: 0,
    ownedBusinesses: 1,
    notifications: 0,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user_1');
  mockIsOwnerEmail.mockReturnValue(false);
  mockGenerateToken.mockReturnValue('fresh-complete-token');
  mockUserFindUnique.mockResolvedValue(dbUser);
});

describe('GET /api/auth/user — SYN-1216 cookie restamp', () => {
  it('restamps auth-token when DB is complete and the cookie is not', async () => {
    mockVerifyTokenSafe.mockReturnValue({
      userId: 'user_1',
      onboardingComplete: false,
    });

    const res = await GET(getRequest('stale-false-token'));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.onboardingComplete).toBe(true);
    expect(mockGenerateToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        email: 'user@x.com',
        onboardingComplete: true,
      })
    );
    expect(res.cookies.get('auth-token')?.value).toBe('fresh-complete-token');
  });

  it('does not restamp when the cookie already says complete', async () => {
    mockVerifyTokenSafe.mockReturnValue({
      userId: 'user_1',
      onboardingComplete: true,
    });

    const res = await GET(getRequest('already-complete-token'));

    expect(res.status).toBe(200);
    expect(mockGenerateToken).not.toHaveBeenCalled();
    expect(res.cookies.get('auth-token')?.value).toBeUndefined();
  });
});
