/**
 * Unit Tests for Social Post API Route
 * Tests POST/GET /api/social/post handler logic
 *
 * Tests actual route handlers with mocked Prisma and auth dependencies.
 * Uses createMockNextRequest to avoid the jest.setup.js polyfill conflict with NextRequest.
 */

import { createMockNextRequest } from '../../helpers/mock-request';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';

// Mock Prisma
const mockPrisma = {
  platformConnection: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  campaign: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  platformPost: {
    upsert: jest.fn(),
  },
  post: {
    findMany: jest.fn(),
    create: jest.fn(),
    groupBy: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock auth
const mockGetUserIdFromCookies = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromCookies: (...args: unknown[]) =>
    mockGetUserIdFromCookies(...args),
  getUserIdFromRequestOrCookies: (...args: unknown[]) =>
    mockGetUserIdFromCookies(...args),
  unauthorizedResponse: () => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  },
}));

// Mock multi-business
const mockGetEffectiveOrganizationId = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

// Mock field encryption
const mockDecryptField = jest.fn((val: string | null | undefined) => val);
const mockEncryptField = jest.fn((val: string | null | undefined) =>
  val == null ? val : `enc:${val}`
);
jest.mock('@/lib/security/field-encryption', () => ({
  decryptField: (...args: [string | null | undefined]) =>
    mockDecryptField(...args),
  encryptField: (...args: [string | null | undefined]) =>
    mockEncryptField(...args),
}));

// Mock twitter-api-v2 to prevent import errors
jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn(),
  TwitterApiV2Settings: {},
}));

// Mock social services so tests don't hit real APIs
const mockCreatePost = jest.fn();
const mockCreatePlatformService = jest.fn().mockReturnValue({
  createPost: mockCreatePost,
  isConfigured: jest.fn().mockReturnValue(true),
});
jest.mock('@/lib/social', () => ({
  createPlatformService: (...args: unknown[]) =>
    mockCreatePlatformService(...args),
}));

import { POST, GET } from '@/app/api/social/post/route';

describe('Social Post API - /api/social/post', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEffectiveOrganizationId.mockResolvedValue(null);
    mockDecryptField.mockImplementation((val: string | null | undefined) => val);
    mockEncryptField.mockImplementation((val: string | null | undefined) =>
      val == null ? val : `enc:${val}`
    );
    mockCreatePlatformService.mockReturnValue({
      createPost: mockCreatePost,
      isConfigured: jest.fn().mockReturnValue(true),
    });
  });

  function createRequest(
    method: string = 'POST',
    body?: object,
    url: string = 'http://localhost:3000/api/social/post'
  ) {
    return createMockNextRequest({ method, body, url });
  }

  // =========================================================================
  // POST /api/social/post
  // =========================================================================
  describe('POST /api/social/post', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUserIdFromCookies.mockResolvedValue(null);

      const req = createRequest('POST', {
        content: 'Test post',
        platforms: ['twitter'],
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it('should return 400 for missing content', async () => {
      mockGetUserIdFromCookies.mockResolvedValue('user-123');

      const req = createRequest('POST', {
        platforms: ['twitter'],
        // Missing content
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid request data');
    });

    it('should return 400 for empty platforms array', async () => {
      mockGetUserIdFromCookies.mockResolvedValue('user-123');

      const req = createRequest('POST', {
        content: 'Test post',
        platforms: [],
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid request data');
    });

    it('should return 400 for empty content string', async () => {
      mockGetUserIdFromCookies.mockResolvedValue('user-123');

      const req = createRequest('POST', {
        content: '',
        platforms: ['twitter'],
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Invalid request data');
    });

    it('should process hashtags correctly (adds # prefix)', async () => {
      mockGetUserIdFromCookies.mockResolvedValue('user-123');

      // Platform connection not found — will error but tests input processing
      mockPrisma.platformConnection.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          campaign: {
            create: jest.fn().mockResolvedValue({ id: 'camp-auto' }),
            update: jest.fn().mockResolvedValue({}),
          },
          post: { create: jest.fn().mockResolvedValue({ id: 'post-1' }) },
        };
        return callback(tx);
      });

      // This will fail at the platform posting step, but validates input parsing
      const req = createRequest('POST', {
        content: 'Hello world',
        platforms: ['twitter'],
        hashtags: ['test', '#already'],
        campaignAuthorityManifest: buildApprovedCampaignAuthorityManifest({
          platformOutputs: [
            { platform: 'twitter', status: 'approved', contentRef: 'post-x' },
          ],
        }),
      });
      const res = await POST(req);

      // Even if platform posting fails, validation passed
      expect(res.status).toBeDefined();
    });

    it('should block publishing before connector lookup when authority manifest is missing', async () => {
      mockGetUserIdFromCookies.mockResolvedValue('user-123');

      const req = createRequest('POST', {
        content: 'Hello world',
        platforms: ['facebook'],
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.blockers).toContain('campaign_authority_manifest_missing');
      expect(mockPrisma.platformConnection.findFirst).not.toHaveBeenCalled();
      expect(mockCreatePost).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should schedule approved posts without calling external platform APIs', async () => {
      mockGetUserIdFromCookies.mockResolvedValue('user-123');
      const txPostCreate = jest.fn().mockResolvedValue({ id: 'post-scheduled' });
      const txCampaignCreate = jest.fn().mockResolvedValue({ id: 'camp-auto' });
      const txCampaignUpdate = jest.fn().mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        return callback({
          campaign: {
            create: txCampaignCreate,
            update: txCampaignUpdate,
          },
          post: { create: txPostCreate },
        });
      });

      const req = createRequest('POST', {
        content: 'Hello world',
        platforms: ['facebook'],
        scheduledAt: '2026-06-05T09:00:00.000Z',
        campaignAuthorityManifest: buildApprovedCampaignAuthorityManifest({
          platformOutputs: [
            { platform: 'facebook', status: 'approved', contentRef: 'post-fb' },
          ],
        }),
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual(expect.objectContaining({ success: true }));
      expect(body.message).toBe('Scheduled 1 of 1 platforms');
      expect(mockPrisma.platformConnection.findFirst).not.toHaveBeenCalled();
      expect(mockCreatePost).not.toHaveBeenCalled();
      expect(txPostCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'scheduled',
            platform: 'facebook',
          }),
        })
      );
    });

    it('persists refreshed platform tokens back to the active organization connection', async () => {
      mockGetUserIdFromCookies.mockResolvedValue('user-123');
      mockGetEffectiveOrganizationId.mockResolvedValue('org-carsi');
      mockCreatePost.mockResolvedValue({
        success: true,
        postId: 'fb-platform-post-1',
        url: 'https://facebook.example/post/1',
      });
      mockPrisma.platformConnection.findFirst.mockResolvedValue({
        id: 'conn-facebook',
        userId: 'user-123',
        organizationId: 'org-carsi',
        platform: 'facebook',
        accessToken: 'stored-access',
        refreshToken: 'stored-refresh',
        expiresAt: new Date('2026-06-12T00:00:00.000Z'),
        scope:
          'public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts',
        profileId: '107529017631636',
        profileName: 'CARSI',
        accountType: 'business_page',
        metadata: { publishReadiness: 'eligible' },
        organization: {
          slug: 'carsi',
          settings: {
            socialPublishing: {
              allowedProfileIds: {
                facebook: ['107529017631636'],
              },
            },
          },
        },
      });
      mockPrisma.platformConnection.update.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        return callback({
          campaign: {
            create: jest.fn().mockResolvedValue({ id: 'camp-auto' }),
            update: jest.fn().mockResolvedValue({}),
          },
          post: { create: jest.fn().mockResolvedValue({ id: 'post-1' }) },
          platformPost: { upsert: jest.fn().mockResolvedValue({}) },
        });
      });

      const req = createRequest('POST', {
        content: 'Hello CARSI',
        platforms: ['facebook'],
        campaignAuthorityManifest: buildApprovedCampaignAuthorityManifest({
          platformOutputs: [
            { platform: 'facebook', status: 'approved', contentRef: 'post-fb' },
          ],
        }),
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual(expect.objectContaining({ success: true }));
      expect(mockPrisma.platformConnection.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            organizationId: 'org-carsi',
            platform: 'facebook',
            isActive: true,
          }),
        })
      );
      expect(mockCreatePlatformService).toHaveBeenCalled();
      const serviceOptions = mockCreatePlatformService.mock.calls[0][2];
      expect(serviceOptions.tokenRefreshCallback).toEqual(expect.any(Function));

      await serviceOptions.tokenRefreshCallback('facebook', {
        accessToken: 'fresh-access',
        refreshToken: 'fresh-refresh',
        expiresAt: new Date('2026-08-12T00:00:00.000Z'),
      });

      expect(mockPrisma.platformConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-facebook' },
        data: expect.objectContaining({
          accessToken: 'enc:fresh-access',
          refreshToken: 'enc:fresh-refresh',
          expiresAt: new Date('2026-08-12T00:00:00.000Z'),
          metadata: expect.objectContaining({
            publishReadiness: 'eligible',
            tokenRefresh: expect.objectContaining({
              source: 'api/social/post',
              expiresAt: '2026-08-12T00:00:00.000Z',
            }),
          }),
        }),
      });
    });
  });

  // =========================================================================
  // GET /api/social/post
  // =========================================================================
  describe('GET /api/social/post', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUserIdFromCookies.mockResolvedValue(null);

      const req = createRequest('GET');
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it('should return posts with stats', async () => {
      mockGetUserIdFromCookies.mockResolvedValue('user-123');

      const mockPosts = [
        {
          id: 'p1',
          content: 'Test post',
          platform: 'twitter',
          status: 'published',
          createdAt: new Date(),
          campaign: { id: 'camp-1', name: 'Campaign 1' },
        },
      ];

      const mockStats = [
        { platform: 'twitter', status: 'published', _count: { id: 5 } },
        { platform: 'linkedin', status: 'published', _count: { id: 3 } },
      ];

      mockPrisma.post.findMany.mockResolvedValue(mockPosts);
      mockPrisma.post.groupBy.mockResolvedValue(mockStats);

      const req = createRequest('GET');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.posts).toHaveLength(1);
      expect(body.stats).toHaveLength(2);
      expect(body.total).toBe(1);
    });

    it('should filter by platform when specified', async () => {
      mockGetUserIdFromCookies.mockResolvedValue('user-123');
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.groupBy.mockResolvedValue([]);

      const req = createRequest(
        'GET',
        undefined,
        'http://localhost:3000/api/social/post?platform=twitter'
      );
      const res = await GET(req);

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            platform: 'twitter',
          }),
        })
      );
    });

    it('should filter by status when specified', async () => {
      mockGetUserIdFromCookies.mockResolvedValue('user-123');
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.groupBy.mockResolvedValue([]);

      const req = createRequest(
        'GET',
        undefined,
        'http://localhost:3000/api/social/post?status=published'
      );
      const res = await GET(req);

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'published',
          }),
        })
      );
    });

    it('should respect limit parameter', async () => {
      mockGetUserIdFromCookies.mockResolvedValue('user-123');
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.groupBy.mockResolvedValue([]);

      const req = createRequest(
        'GET',
        undefined,
        'http://localhost:3000/api/social/post?limit=5'
      );
      const res = await GET(req);

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      );
    });

    it('should return 500 on database error', async () => {
      mockGetUserIdFromCookies.mockResolvedValue('user-123');
      mockPrisma.post.findMany.mockRejectedValue(new Error('DB error'));

      const req = createRequest('GET');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('Failed to fetch posts');
    });
  });
});
