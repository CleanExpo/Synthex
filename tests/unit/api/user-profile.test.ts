/**
 * Unit Tests for User Profile API Route
 * Tests GET, PUT, DELETE /api/user/profile handler logic
 *
 * Tests actual route handlers with mocked Prisma and auth dependencies.
 * Uses createMockNextRequest to avoid the jest.setup.js polyfill conflict with NextRequest.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock auth
const mockGetUserIdFromRequestOrCookies = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserIdFromRequestOrCookies(...args),
  unauthorizedResponse: () => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  },
}));

import { GET, PUT, DELETE } from '@/app/api/user/profile/route';

describe('User Profile API - /api/user/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(
    method: string = 'GET',
    body?: object,
    url: string = 'http://localhost:3000/api/user/profile'
  ) {
    return createMockNextRequest({ method, body, url });
  }

  // =========================================================================
  // GET /api/user/profile
  // =========================================================================
  describe('GET /api/user/profile', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);

      const req = createRequest('GET');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('should return user profile when authenticated', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        company: 'Test Corp',
        jobRole: 'Developer',
        bio: 'Test bio',
        phone: '+1234567890',
        website: 'https://example.com',
        socialLinks: { twitter: '@testuser' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-01'),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const req = createRequest('GET');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.profile).toBeDefined();
      expect(body.profile.id).toBe('user-123');
      expect(body.profile.email).toBe('test@example.com');
      expect(body.profile.name).toBe('Test User');
      expect(body.profile.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(body.profile.company).toBe('Test Corp');
      expect(body.profile.role).toBe('Developer');
      // Check legacy snake_case aliases
      expect(body.profile.avatar_url).toBe('https://example.com/avatar.jpg');
      expect(body.profile.social_links).toEqual({ twitter: '@testuser' });
    });

    it('should return default profile when user not found in DB', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-new');
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const req = createRequest('GET');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.profile.id).toBe('user-new');
      expect(body.profile.name).toBe('');
      expect(body.profile.email).toBe('');
    });

    it('should return default profile on database error', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-err');
      mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));

      const req = createRequest('GET');
      const res = await GET(req);
      const body = await res.json();

      // Route returns a default profile instead of 500
      expect(res.status).toBe(200);
      expect(body.profile).toBeDefined();
      expect(body.profile.name).toBe('');
    });

    it('should handle null optional fields gracefully', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-minimal');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-minimal',
        email: 'min@example.com',
        name: null,
        avatar: null,
        company: null,
        jobRole: null,
        bio: null,
        phone: null,
        website: null,
        socialLinks: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = createRequest('GET');
      const res = await GET(req);
      const body = await res.json();

      expect(body.profile.name).toBe('');
      expect(body.profile.avatarUrl).toBe('');
      expect(body.profile.company).toBe('');
      expect(body.profile.socialLinks).toEqual({});
    });
  });

  // =========================================================================
  // PUT /api/user/profile
  // =========================================================================
  describe('PUT /api/user/profile', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);

      const req = createRequest('PUT', { name: 'New Name' });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('should update profile with valid data', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const updatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Updated Name',
        avatar: null,
        company: 'New Corp',
        jobRole: null,
        bio: 'Updated bio',
        phone: null,
        website: null,
        socialLinks: null,
        updatedAt: new Date(),
      };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const req = createRequest('PUT', {
        name: 'Updated Name',
        company: 'New Corp',
        bio: 'Updated bio',
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.profile.name).toBe('Updated Name');
      expect(body.message).toBe('Profile updated successfully');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
        })
      );
    });

    it('should return 400 for validation errors (name too long)', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const req = createRequest('PUT', {
        name: 'a'.repeat(101),
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Validation failed');
      expect(body.details).toBeDefined();
    });

    it('should return 400 for invalid website URL', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const req = createRequest('PUT', {
        website: 'not-a-valid-url',
      });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Validation failed');
    });

    it('should accept empty string for website', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: null,
        avatar: null,
        company: null,
        jobRole: null,
        bio: null,
        phone: null,
        website: null,
        socialLinks: null,
        updatedAt: new Date(),
      });

      const req = createRequest('PUT', { website: '' });
      const res = await PUT(req);

      expect(res.status).toBe(200);
    });

    it('should return 500 when database update fails', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
      mockPrisma.user.update.mockRejectedValue(new Error('Update failed'));

      const req = createRequest('PUT', { name: 'Test' });
      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('Failed to update profile');
    });

    it('should strip unknown fields from input', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Valid',
        avatar: null,
        company: null,
        jobRole: null,
        bio: null,
        phone: null,
        website: null,
        socialLinks: null,
        updatedAt: new Date(),
      });

      // The schema uses .strip() so unknown fields are silently removed
      const req = createRequest('PUT', {
        name: 'Valid',
        unknownField: 'should be stripped',
      });
      const res = await PUT(req);

      // Should succeed because strip() removes unknowns
      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // DELETE /api/user/profile
  // =========================================================================
  describe('DELETE /api/user/profile', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);

      const req = createRequest('DELETE', { confirmation: 'DELETE_MY_ACCOUNT' });
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('should return 400 when confirmation is missing', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const req = createRequest('DELETE', {});
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Account deletion requires confirmation');
    });

    it('should return 400 when confirmation text is wrong', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');

      const req = createRequest('DELETE', { confirmation: 'WRONG_TEXT' });
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe('Account deletion requires confirmation');
    });

    it('should delete account with valid confirmation', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
      mockPrisma.user.delete.mockResolvedValue({ id: 'user-123' });

      const req = createRequest('DELETE', { confirmation: 'DELETE_MY_ACCOUNT' });
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Account deleted successfully');
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should return 500 when delete fails', async () => {
      mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
      mockPrisma.user.delete.mockRejectedValue(new Error('FK constraint'));

      const req = createRequest('DELETE', { confirmation: 'DELETE_MY_ACCOUNT' });
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('Failed to delete account');
    });
  });
});
