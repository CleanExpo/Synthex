/**
 * Unit Tests for Campaigns API Route
 * Tests GET, POST, PUT, DELETE /api/campaigns handler logic
 *
 * Tests actual route handlers with mocked Prisma and auth dependencies.
 * Uses createMockNextRequest to avoid the jest.setup.js polyfill conflict with NextRequest.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// Mock Prisma
const mockPrisma = {
  campaign: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

// Mock multi-business scope (required by campaigns route)
const mockGetEffectiveQueryFilter = jest.fn();
const mockResolveCampaignOrganizationId = jest.fn();
// Real OrgAccessError so `instanceof` checks in the route behave correctly.
class OrgAccessError extends Error {
  constructor(message = 'Forbidden — no access to target organization') {
    super(message);
    this.name = 'OrgAccessError';
  }
}
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveQueryFilter: (...args: unknown[]) =>
    mockGetEffectiveQueryFilter(...args),
  resolveCampaignOrganizationId: (...args: unknown[]) =>
    mockResolveCampaignOrganizationId(...args),
  OrgAccessError,
}));

// Mock Redis — a shared, stateful in-memory store so a key WRITTEN on GET can be
// asserted to be MATCHED + DELETED by a subsequent mutation's invalidation glob.
// `keys()` mirrors the real client's anchored-glob semantics (lib/redis-client.ts:
// escape metachars, translate `*`→`.*`, full-string match) — this is what makes
// the test able to catch the prefix-drift bug where the invalidation pattern
// never matched the stored read key.
const mockRedisStore = new Map<string, string>();
// Mirror real Redis (Upstash) glob semantics: escape regex metachars, then
// translate the Redis glob `*` into `.*`. (We deliberately model production
// Upstash here, not the dev in-memory fallback client.)
function redisKeysGlob(pattern: string): string[] {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\\\*/g, '.*') + '$');
  return Array.from(mockRedisStore.keys()).filter(k => regex.test(k));
}
const mockRedisClient = {
  get: jest.fn(async (key: string) => mockRedisStore.get(key) ?? null),
  set: jest.fn(async (key: string, value: string) => {
    mockRedisStore.set(key, value);
  }),
  del: jest.fn(async (keys: string | string[]) => {
    const arr = Array.isArray(keys) ? keys : [keys];
    let n = 0;
    for (const k of arr) if (mockRedisStore.delete(k)) n++;
    return n;
  }),
  keys: jest.fn(async (pattern: string) => redisKeysGlob(pattern)),
};
jest.mock('@/lib/redis-client', () => ({
  getRedisClient: () => mockRedisClient,
}));

// Mock the rate limiter — these are handler-logic unit tests, not rate-limit
// tests. `writeDefault` uses a module-level in-memory counter that persists
// across tests in this file; without this mock, accumulated mutation calls trip
// the 30/min limit and later tests see a spurious 429. Pass straight through.
jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_request: unknown, handler: () => Promise<unknown>) =>
    handler(),
}));

// Mock auth
const mockGetUserIdFromRequestOrCookies = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) =>
    mockGetUserIdFromRequestOrCookies(...args),
  unauthorizedResponse: () => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  },
}));

import { GET, POST, PUT, DELETE } from '@/app/api/campaigns/route';

describe('Campaigns API - /api/campaigns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisStore.clear();
    // clearAllMocks() wipes the inline implementations on the shared Redis mock —
    // re-bind them so the stateful store keeps working across GET→mutation flows.
    mockRedisClient.get.mockImplementation(
      async (key: string) => mockRedisStore.get(key) ?? null
    );
    mockRedisClient.set.mockImplementation(
      async (key: string, value: string) => {
        mockRedisStore.set(key, value);
      }
    );
    mockRedisClient.del.mockImplementation(async (keys: string | string[]) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      let n = 0;
      for (const k of arr) if (mockRedisStore.delete(k)) n++;
      return n;
    });
    mockRedisClient.keys.mockImplementation(async (pattern: string) =>
      redisKeysGlob(pattern)
    );
    // Default: user has an org context — returns a non-empty filter so the
    // guard (Object.keys(filter).length === 0) does not reject the request.
    mockGetEffectiveQueryFilter.mockResolvedValue({ userId: 'user-123' });
    // Default: no explicit org requested → resolves the user's effective org.
    mockResolveCampaignOrganizationId.mockResolvedValue('org-123');
  });

  function createRequest(
    method: string = 'GET',
    body?: object,
    url: string = 'http://localhost:3000/api/campaigns'
  ) {
    return createMockNextRequest({ method, body, url });
  }

  // =========================================================================
  // GET /api/campaigns
  // =========================================================================
  describe('GET /api/campaigns', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);

      const req = createRequest('GET');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('should return campaigns for authenticated user', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const mockCampaigns = [
        {
          id: 'camp-1',
          name: 'Summer Campaign',
          platform: 'instagram',
          status: 'active',
          posts: [
            {
              id: 'p1',
              status: 'published',
              platform: 'instagram',
              scheduledAt: null,
              publishedAt: new Date(),
            },
          ],
        },
        {
          id: 'camp-2',
          name: 'Product Launch',
          platform: 'multi',
          status: 'draft',
          posts: [],
        },
      ];

      mockPrisma.campaign.findMany.mockResolvedValue(mockCampaigns);

      const req = createRequest('GET');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.campaigns).toHaveLength(2);
      expect(body.campaigns[0].name).toBe('Summer Campaign');
      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' }, // matches mockGetEffectiveQueryFilter return value
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should return empty array when no campaigns exist', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-empty');
      mockPrisma.campaign.findMany.mockResolvedValue([]);

      const req = createRequest('GET');
      const res = await GET(req);
      const body = await res.json();

      expect(body.campaigns).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
      mockPrisma.campaign.findMany.mockRejectedValue(
        new Error('Connection lost')
      );

      const req = createRequest('GET');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('Failed to fetch campaigns');
    });
  });

  // =========================================================================
  // POST /api/campaigns
  // =========================================================================
  describe('POST /api/campaigns', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);

      const req = createRequest('POST', {
        name: 'New Campaign',
        platform: 'twitter',
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it('should create campaign with valid data', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const createdCampaign = {
        id: 'camp-new',
        name: 'New Campaign',
        description: 'Test description',
        platform: 'twitter',
        content: null,
        settings: null,
        userId: 'user-123',
        status: 'draft',
      };

      // Mock $transaction to execute the callback
      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          campaign: { create: jest.fn().mockResolvedValue(createdCampaign) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const req = createRequest('POST', {
        name: 'New Campaign',
        description: 'Test description',
        platform: 'twitter',
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.campaign.name).toBe('New Campaign');
      expect(body.campaign.status).toBe('draft');
    });

    // ── SYN-847: active child-brand org wiring ────────────────────────────
    it('should return 403 when targeting a child org the user cannot access', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('member-user');
      // Non-member of the requested brand → resolver throws OrgAccessError.
      mockResolveCampaignOrganizationId.mockRejectedValue(new OrgAccessError());

      const req = createRequest('POST', {
        name: 'Cross-Org Campaign',
        platform: 'twitter',
        organizationId: 'child-brand-not-mine',
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toMatch(/access to target organization/i);
      // Must NOT have created anything when access is denied.
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should create against the active child-brand org when authorised', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('master-admin');
      // Parent/master admin acting on a child brand → resolver returns the brand.
      mockResolveCampaignOrganizationId.mockResolvedValue('child-brand-org');

      let capturedCreateArgs: { data: Record<string, unknown> } | undefined;
      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          campaign: {
            create: jest
              .fn()
              .mockImplementation((args: typeof capturedCreateArgs) => {
                capturedCreateArgs = args;
                return Promise.resolve({
                  id: 'camp-child',
                  name: 'Brand Launch',
                  platform: 'linkedin',
                  organizationId: 'child-brand-org',
                  status: 'draft',
                });
              }),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const req = createRequest('POST', {
        name: 'Brand Launch',
        platform: 'linkedin',
        organizationId: 'child-brand-org',
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockResolveCampaignOrganizationId).toHaveBeenCalledWith(
        'master-admin',
        'child-brand-org'
      );
      // The campaign is persisted against the selected child brand, not a default.
      expect(capturedCreateArgs?.data.organizationId).toBe('child-brand-org');
    });

    it('should return 400 for missing required name', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const req = createRequest('POST', {
        platform: 'twitter',
        // Missing name
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid platform', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const req = createRequest('POST', {
        name: 'Test',
        platform: 'invalid-platform',
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Validation failed');
    });

    it('should return 400 for name exceeding max length', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const req = createRequest('POST', {
        name: 'a'.repeat(101),
        platform: 'twitter',
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Validation failed');
    });

    it('should accept all valid platforms', async () => {
      const validPlatforms = [
        'twitter',
        'linkedin',
        'instagram',
        'facebook',
        'tiktok',
        'threads',
        'multi',
      ];

      for (const platform of validPlatforms) {
        mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
        mockPrisma.$transaction.mockImplementation(
          async (callback: Function) => {
            const tx = {
              campaign: {
                create: jest.fn().mockResolvedValue({
                  id: `camp-${platform}`,
                  name: 'Test',
                  platform,
                  status: 'draft',
                }),
              },
              auditLog: { create: jest.fn().mockResolvedValue({}) },
            };
            return callback(tx);
          }
        );

        const req = createRequest('POST', { name: 'Test', platform });
        const res = await POST(req);

        expect(res.status).toBe(200);
      }
    });
  });

  // =========================================================================
  // PUT /api/campaigns
  // =========================================================================
  describe('PUT /api/campaigns', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);

      const req = createRequest('PUT', {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Updated',
      });
      const res = await PUT(req);

      expect(res.status).toBe(401);
    });

    it('should update campaign with valid data', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const existingCampaign = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
      };
      mockPrisma.campaign.findFirst.mockResolvedValue(existingCampaign);

      const updatedCampaign = {
        ...existingCampaign,
        name: 'Updated Campaign',
        status: 'active',
      };
      mockPrisma.campaign.update.mockResolvedValue(updatedCampaign);

      const req = createRequest('PUT', {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Updated Campaign',
        status: 'active',
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.campaign.name).toBe('Updated Campaign');
    });

    it('should return 404 when campaign not found or not owned', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
      mockPrisma.campaign.findFirst.mockResolvedValue(null);

      const req = createRequest('PUT', {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test',
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Campaign not found');
    });

    it('should return 400 for invalid campaign ID format', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const req = createRequest('PUT', {
        id: 'not-a-uuid',
        name: 'Test',
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid status value', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const req = createRequest('PUT', {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'invalid-status',
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Validation failed');
    });
  });

  // =========================================================================
  // DELETE /api/campaigns
  // =========================================================================
  describe('DELETE /api/campaigns', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);

      const req = createRequest(
        'DELETE',
        undefined,
        'http://localhost:3000/api/campaigns?id=camp-1'
      );
      const res = await DELETE(req);

      expect(res.status).toBe(401);
    });

    it('should return 400 when campaign ID is missing', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const req = createRequest('DELETE');
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Campaign ID is required');
    });

    it('should return 404 when campaign not found', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
      mockPrisma.campaign.findFirst.mockResolvedValue(null);

      const req = createRequest(
        'DELETE',
        undefined,
        'http://localhost:3000/api/campaigns?id=nonexistent'
      );
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Campaign not found');
    });

    it('should delete campaign when owned by user', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const existingCampaign = {
        id: 'camp-1',
        userId: 'user-123',
        name: 'To Delete',
      };
      mockPrisma.campaign.findFirst.mockResolvedValue(existingCampaign);

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          campaign: { delete: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const req = createRequest(
        'DELETE',
        undefined,
        'http://localhost:3000/api/campaigns?id=camp-1'
      );
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Campaign deleted successfully');
    });
  });

  // =========================================================================
  // Org-scoped mutation authorisation (SYN-847 cross-brand divergence fix)
  //
  // PUT/DELETE must authorise by the caller's effective ACTIVE org, exactly like
  // GET — not solely by the campaign creator's userId. These tests pin the three
  // consequences of the fix: (1) a brand MEMBER (non-creator) in the active org
  // CAN mutate the brand's campaign; (2) a user CANNOT mutate a campaign in a
  // DIFFERENT org than their active one; (3) the personal/no-org fallback still
  // authorises by userId.
  // =========================================================================
  describe('org-scoped mutation authorisation', () => {
    const CAMPAIGN_ID = '550e8400-e29b-41d4-a716-446655440000';

    // Helper: make the active-org context org-scoped (multi-business / brand
    // member viewing a specific brand → filter is { organizationId }).
    function setActiveOrg(orgId: string) {
      mockGetEffectiveQueryFilter.mockResolvedValue({ organizationId: orgId });
    }

    // ── (1) brand MEMBER (non-creator) CAN edit the active brand's campaign ──
    it('PUT: a brand member who is NOT the creator can edit the active org campaign', async () => {
      // Caller is a brand member, not the original creator.
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('member-not-creator');
      setActiveOrg('brand-org');

      // findFirst is now scoped by { id, organizationId: 'brand-org' } — so the
      // campaign resolves even though its creator userId differs from the caller.
      let capturedWhere: Record<string, unknown> | undefined;
      mockPrisma.campaign.findFirst.mockImplementation(
        (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return Promise.resolve({
            id: CAMPAIGN_ID,
            userId: 'original-creator', // NOT the caller
            organizationId: 'brand-org',
            status: 'draft',
          });
        }
      );
      mockPrisma.campaign.update.mockResolvedValue({
        id: CAMPAIGN_ID,
        name: 'Edited By Member',
        organizationId: 'brand-org',
      });

      const req = createRequest('PUT', {
        id: CAMPAIGN_ID,
        name: 'Edited By Member',
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      // Authorisation is org-scoped, NOT userId-scoped.
      expect(capturedWhere).toEqual({
        id: CAMPAIGN_ID,
        organizationId: 'brand-org',
      });
      expect(capturedWhere).not.toHaveProperty('userId');
    });

    it('DELETE: a brand member who is NOT the creator can delete the active org campaign', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('member-not-creator');
      setActiveOrg('brand-org');

      let capturedWhere: Record<string, unknown> | undefined;
      mockPrisma.campaign.findFirst.mockImplementation(
        (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return Promise.resolve({
            id: CAMPAIGN_ID,
            userId: 'original-creator',
            organizationId: 'brand-org',
            name: 'Brand Campaign',
          });
        }
      );
      mockPrisma.$transaction.mockImplementation(async (cb: Function) =>
        cb({
          campaign: { delete: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        })
      );

      const req = createRequest(
        'DELETE',
        undefined,
        `http://localhost:3000/api/campaigns?id=${CAMPAIGN_ID}`
      );
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(capturedWhere).toEqual({
        id: CAMPAIGN_ID,
        organizationId: 'brand-org',
      });
      expect(capturedWhere).not.toHaveProperty('userId');
    });

    // ── (2) CANNOT mutate a campaign in a DIFFERENT org than the active one ──
    // The active-org filter never matches the other brand's campaign, so the
    // scoped findFirst returns null → 404. This is the cross-brand block: the
    // creator can no longer mutate a non-active brand's campaign.
    it('PUT: cannot edit a campaign that belongs to a different (non-active) org → 404', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('creator-user');
      setActiveOrg('active-brand');

      // The campaign lives in 'other-brand'; scoped to 'active-brand' it is not found.
      let capturedWhere: Record<string, unknown> | undefined;
      mockPrisma.campaign.findFirst.mockImplementation(
        (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return Promise.resolve(null);
        }
      );

      const req = createRequest('PUT', { id: CAMPAIGN_ID, status: 'active' });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Campaign not found');
      // The query was scoped to the ACTIVE brand — not the campaign's real org.
      expect(capturedWhere).toEqual({
        id: CAMPAIGN_ID,
        organizationId: 'active-brand',
      });
      // No mutation, and no Unite-Group Nexus lifecycle event fired for the wrong brand.
      expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    });

    it('DELETE: cannot delete a campaign that belongs to a different (non-active) org → 404', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('creator-user');
      setActiveOrg('active-brand');

      let capturedWhere: Record<string, unknown> | undefined;
      mockPrisma.campaign.findFirst.mockImplementation(
        (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return Promise.resolve(null);
        }
      );

      const req = createRequest(
        'DELETE',
        undefined,
        `http://localhost:3000/api/campaigns?id=${CAMPAIGN_ID}`
      );
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Campaign not found');
      expect(capturedWhere).toEqual({
        id: CAMPAIGN_ID,
        organizationId: 'active-brand',
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    // ── (3) personal/no-org fallback still authorises by userId ──
    it('PUT: personal (no-org) context still authorises by userId', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('solo-user');
      // Single-brand / no-org user → effective filter is { userId }.
      mockGetEffectiveQueryFilter.mockResolvedValue({ userId: 'solo-user' });

      let capturedWhere: Record<string, unknown> | undefined;
      mockPrisma.campaign.findFirst.mockImplementation(
        (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return Promise.resolve({ id: CAMPAIGN_ID, userId: 'solo-user' });
        }
      );
      mockPrisma.campaign.update.mockResolvedValue({
        id: CAMPAIGN_ID,
        name: 'Solo Edit',
      });

      const req = createRequest('PUT', { id: CAMPAIGN_ID, name: 'Solo Edit' });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      // Fallback preserved: scoped by userId, not organizationId.
      expect(capturedWhere).toEqual({ id: CAMPAIGN_ID, userId: 'solo-user' });
      expect(capturedWhere).not.toHaveProperty('organizationId');
    });

    it('DELETE: personal (no-org) context still authorises by userId', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('solo-user');
      mockGetEffectiveQueryFilter.mockResolvedValue({ userId: 'solo-user' });

      let capturedWhere: Record<string, unknown> | undefined;
      mockPrisma.campaign.findFirst.mockImplementation(
        (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return Promise.resolve({
            id: CAMPAIGN_ID,
            userId: 'solo-user',
            name: 'Solo',
          });
        }
      );
      mockPrisma.$transaction.mockImplementation(async (cb: Function) =>
        cb({
          campaign: { delete: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        })
      );

      const req = createRequest(
        'DELETE',
        undefined,
        `http://localhost:3000/api/campaigns?id=${CAMPAIGN_ID}`
      );
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(capturedWhere).toEqual({ id: CAMPAIGN_ID, userId: 'solo-user' });
      expect(capturedWhere).not.toHaveProperty('organizationId');
    });

    // ── Invalid org context → 403 (mirrors GET's empty-filter guard) ──
    it('PUT: returns 403 when the org context is invalid (empty filter)', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('ctx-less-user');
      mockGetEffectiveQueryFilter.mockResolvedValue({});

      const req = createRequest('PUT', { id: CAMPAIGN_ID, name: 'X' });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toMatch(/organisation context/i);
      expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
    });

    it('DELETE: returns 403 when the org context is invalid (empty filter)', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('ctx-less-user');
      mockGetEffectiveQueryFilter.mockResolvedValue({});

      const req = createRequest(
        'DELETE',
        undefined,
        `http://localhost:3000/api/campaigns?id=${CAMPAIGN_ID}`
      );
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toMatch(/organisation context/i);
      expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Cache invalidation — regression for the prefix-drift bug where the read key
  // (`...campaigns:org:<org>:all`) was never matched by the write-side glob
  // (`...campaigns:<org>:*`), so mutations left stale data for up to the TTL.
  // =========================================================================
  describe('cache invalidation matches the read key', () => {
    function setOrgContext(orgId: string) {
      // Multi-business owner viewing a specific brand → org-scoped filter + org.
      mockGetEffectiveQueryFilter.mockResolvedValue({ organizationId: orgId });
      mockResolveCampaignOrganizationId.mockResolvedValue(orgId);
    }

    it('POST busts the exact org-scoped list key written by a prior GET', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('owner-1');
      setOrgContext('org-A');

      // GET populates the cache for the active brand.
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      await GET(createRequest('GET'));

      const writtenKey = 'synthex:cache:campaigns:org:org-A:all';
      expect(mockRedisStore.has(writtenKey)).toBe(true);

      // POST against the same active brand must invalidate that exact key.
      mockPrisma.$transaction.mockImplementation(async (cb: Function) =>
        cb({
          campaign: {
            create: jest
              .fn()
              .mockResolvedValue({ id: 'c1', organizationId: 'org-A' }),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        })
      );

      await POST(
        createRequest('POST', {
          name: 'New',
          platform: 'twitter',
          organizationId: 'org-A',
        })
      );

      // The stale read key is gone — without the prefix fix it would survive.
      expect(mockRedisStore.has(writtenKey)).toBe(false);
    });

    it('DELETE busts the org-scoped list key written by a prior GET', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('owner-1');
      setOrgContext('org-B');

      mockPrisma.campaign.findMany.mockResolvedValue([]);
      await GET(createRequest('GET'));

      const writtenKey = 'synthex:cache:campaigns:org:org-B:all';
      expect(mockRedisStore.has(writtenKey)).toBe(true);

      mockPrisma.campaign.findFirst.mockResolvedValue({
        id: 'camp-x',
        userId: 'owner-1',
        name: 'Gone',
        organizationId: 'org-B',
      });
      mockPrisma.$transaction.mockImplementation(async (cb: Function) =>
        cb({
          campaign: { delete: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        })
      );

      await DELETE(
        createRequest(
          'DELETE',
          undefined,
          'http://localhost:3000/api/campaigns?id=camp-x'
        )
      );

      expect(mockRedisStore.has(writtenKey)).toBe(false);
    });
  });
});
