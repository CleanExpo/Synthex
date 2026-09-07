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

const mockIsAdmin = jest.fn();
const mockIsMember = jest.fn();
jest.mock('@/lib/auth/org-admin', () => ({
  isOrganizationAdmin: (...a: unknown[]) => mockIsAdmin(...a),
  isOrganizationMember: (...a: unknown[]) => mockIsMember(...a),
}));

jest.mock('@/lib/api/response-optimizer', () => {
  const { NextResponse } = require('next/server');
  return {
    ResponseOptimizer: {
      createResponse: (data: unknown) =>
        NextResponse.json(data, { status: 200 }),
      createErrorResponse: (message: string, status: number) =>
        NextResponse.json({ error: message }, { status }),
    },
  };
});

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
jest.mock('@/lib/cache/cache-manager', () => ({
  getCache: () => ({
    get: (...a: unknown[]) => mockCacheGet(...a),
    set: (...a: unknown[]) => mockCacheSet(...a),
  }),
}));

const mockOrgFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    organization: {
      findUnique: (...a: unknown[]) => mockOrgFindUnique(...a),
    },
  },
  default: {
    organization: {
      findUnique: (...a: unknown[]) => mockOrgFindUnique(...a),
    },
  },
}));

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { GET } from '@/app/api/organizations/[orgId]/route';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';

const orgRow = {
  id: ORG_ID,
  name: 'Acme',
  slug: 'acme',
  description: null,
  plan: 'free',
  status: 'active',
  domain: 'acme.synthex.social',
  customDomain: null,
  logo: null,
  primaryColor: null,
  settings: {
    admins: [USER_ID],
    provisioning: { parentOrgId: 'parent' },
    studio: { funnelUrl: 'https://acme.example' },
  },
  maxUsers: 5,
  maxPosts: 50,
  maxCampaigns: 5,
  stripeCustomerId: 'cus_secret',
  billingEmail: 'billing@acme.test',
  billingStatus: 'active',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  users: [
    {
      id: USER_ID,
      name: 'Ada',
      email: 'ada@acme.test',
      avatar: null,
      createdAt: new Date('2026-01-01'),
    },
  ],
  roles: [
    {
      id: 'role-1',
      name: 'editor',
      description: null,
      permissions: ['posts:write', '*'],
      isDefault: true,
      isSystem: false,
    },
  ],
  _count: { users: 1, campaigns: 0, teamInvitations: 0 },
};

describe('GET /api/organizations/[orgId] — member redaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(USER_ID);
    mockIsMember.mockResolvedValue(true);
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockOrgFindUnique.mockResolvedValue(orgRow);
  });

  it('hides billing identifiers, emails, permissions and reserved settings from members', async () => {
    mockIsAdmin.mockResolvedValue(false);

    const res = await GET(
      createMockNextRequest({
        method: 'GET',
        url: `http://localhost/api/organizations/${ORG_ID}`,
      }),
      { params: Promise.resolve({ orgId: ORG_ID }) }
    );
    const body = await res.json();

    expect(body.canAdminister).toBe(false);
    expect(body.billing).toEqual({ billingStatus: 'active' });
    expect(body.users[0].email).toBeUndefined();
    expect(body.roles[0].permissions).toBeUndefined();
    expect(body.settings.provisioning).toBeUndefined();
    expect(body.settings.admins).toBeUndefined();
    expect(body.settings.studio).toEqual({ funnelUrl: 'https://acme.example' });
  });

  it('returns full billing and role permissions to admins', async () => {
    mockIsAdmin.mockResolvedValue(true);

    const res = await GET(
      createMockNextRequest({
        method: 'GET',
        url: `http://localhost/api/organizations/${ORG_ID}`,
      }),
      { params: Promise.resolve({ orgId: ORG_ID }) }
    );
    const body = await res.json();

    expect(body.canAdminister).toBe(true);
    expect(body.billing.stripeCustomerId).toBe('cus_secret');
    expect(body.users[0].email).toBe('ada@acme.test');
    expect(body.roles[0].permissions).toContain('posts:write');
    expect(body.settings.provisioning).toEqual({ parentOrgId: 'parent' });
  });
});
