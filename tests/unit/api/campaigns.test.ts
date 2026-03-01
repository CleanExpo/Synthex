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
}));

// Mock auth
const mockGetUserIdFromRequestOrCookies = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserIdFromRequestOrCookies(...args),
  unauthorizedResponse: () => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
  },
}));

import { GET, POST, PUT, DELETE } from '@/app/api/campaigns/route';

describe('Campaigns API - /api/campaigns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
            { id: 'p1', status: 'published', platform: 'instagram', scheduledAt: null, publishedAt: new Date() },
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
          where: { userId: 'user-123' },
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
      mockPrisma.campaign.findMany.mockRejectedValue(new Error('Connection lost'));

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
      const validPlatforms = ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'threads', 'multi'];

      for (const platform of validPlatforms) {
        mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
        mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
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
        });

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

      const existingCampaign = { id: '550e8400-e29b-41d4-a716-446655440000', userId: 'user-123' };
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

      const req = createRequest('DELETE', undefined, 'http://localhost:3000/api/campaigns?id=camp-1');
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

      const req = createRequest('DELETE', undefined, 'http://localhost:3000/api/campaigns?id=nonexistent');
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe('Campaign not found');
    });

    it('should delete campaign when owned by user', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const existingCampaign = { id: 'camp-1', userId: 'user-123', name: 'To Delete' };
      mockPrisma.campaign.findFirst.mockResolvedValue(existingCampaign);

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          campaign: { delete: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const req = createRequest('DELETE', undefined, 'http://localhost:3000/api/campaigns?id=camp-1');
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Campaign deleted successfully');
    });
  });
});
