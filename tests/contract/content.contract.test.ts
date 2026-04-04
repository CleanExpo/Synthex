/**
 * Content API Contract Tests
 *
 * Validates that content/campaign API endpoints conform to their Zod schemas.
 *
 * @module tests/contract/content.contract.test
 */

import { describe, it, expect } from '@jest/globals';
import {
  createPostSchema,
  createCampaignSchema,
  postResponseSchema,
  campaignResponseSchema,
  createPostResponseSchema,
  listPostsResponseSchema,
  createCampaignResponseSchema,
  listCampaignsResponseSchema,
  contentErrorResponseSchema,
  contentPlatformSchema,
  contentStatusSchema,
} from '@/lib/schemas';

describe('Content API Contract Tests', () => {
  describe('Post Input Schema Validation', () => {
    it('should validate correct post creation input', () => {
      const validInput = {
        content: 'This is a test post with great content!',
        platforms: ['twitter', 'linkedin'],
        contentType: 'post',
        hashtags: ['testing', 'synthex'],
      };

      const result = createPostSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject empty content', () => {
      const invalidInput = {
        content: '',
        platforms: ['twitter'],
      };

      const result = createPostSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty platforms array', () => {
      const invalidInput = {
        content: 'Valid content',
        platforms: [],
      };

      const result = createPostSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject invalid platform', () => {
      const invalidInput = {
        content: 'Valid content',
        platforms: ['invalid-platform'],
      };

      const result = createPostSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should validate scheduled post with datetime', () => {
      const validInput = {
        content: 'Scheduled post content',
        platforms: ['instagram'],
        scheduledAt: '2025-12-25T10:00:00.000Z',
        timezone: 'America/New_York',
      };

      const result = createPostSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate post with media', () => {
      const validInput = {
        content: 'Post with image',
        platforms: ['instagram'],
        media: [
          {
            url: 'https://example.com/image.jpg',
            type: 'image',
            altText: 'A beautiful image',
          },
        ],
      };

      const result = createPostSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('Campaign Input Schema Validation', () => {
    it('should validate correct campaign creation input', () => {
      const validInput = {
        name: 'Q1 Marketing Campaign',
        description: 'Our big Q1 push',
        platforms: ['twitter', 'linkedin', 'instagram'],
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-03-31T23:59:59.000Z',
        status: 'draft',
      };

      const result = createCampaignSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject campaign without name', () => {
      const invalidInput = {
        name: '',
        platforms: ['twitter'],
        startDate: '2025-01-01T00:00:00.000Z',
      };

      const result = createCampaignSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should validate campaign with budget', () => {
      const validInput = {
        name: 'Paid Campaign',
        platforms: ['facebook'],
        startDate: '2025-01-01T00:00:00.000Z',
        budget: {
          amount: 5000,
          currency: 'USD',
        },
      };

      const result = createCampaignSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate campaign with goals', () => {
      const validInput = {
        name: 'Goal-driven Campaign',
        platforms: ['linkedin'],
        startDate: '2025-01-01T00:00:00.000Z',
        goals: [
          { type: 'reach', target: 10000, metric: 'impressions' },
          { type: 'engagement', target: 500, metric: 'likes' },
        ],
      };

      const result = createCampaignSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('Post Response Schema Validation', () => {
    it('should validate post response shape', () => {
      const mockPost = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        content: 'Test post content',
        status: 'draft',
        platforms: ['twitter'],
        scheduledAt: null,
        publishedAt: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        campaignId: null,
        metadata: {},
      };

      const result = postResponseSchema.safeParse(mockPost);
      expect(result.success).toBe(true);
    });

    it('should validate create post response', () => {
      const mockResponse = {
        success: true,
        message: 'Post created successfully',
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          content: 'New post',
          status: 'draft',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      };

      const result = createPostResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should validate list posts response', () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            content: 'Post 1',
            status: 'published',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: '223e4567-e89b-12d3-a456-426614174001',
            content: 'Post 2',
            status: 'scheduled',
            scheduledAt: '2025-02-01T10:00:00.000Z',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 50,
          totalPages: 3,
        },
      };

      const result = listPostsResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('Campaign Response Schema Validation', () => {
    it('should validate campaign response shape', () => {
      const mockCampaign = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Campaign',
        description: 'A test campaign',
        status: 'active',
        platforms: ['twitter', 'linkedin'],
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-03-31T23:59:59.000Z',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        _count: { posts: 15 },
      };

      const result = campaignResponseSchema.safeParse(mockCampaign);
      expect(result.success).toBe(true);
    });

    it('should validate list campaigns response', () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Campaign 1',
            status: 'active',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
            userId: '123e4567-e89b-12d3-a456-426614174000',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 5,
          totalPages: 1,
        },
      };

      const result = listCampaignsResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Response Schema Validation', () => {
    it('should validate content error response', () => {
      const mockError = {
        success: false,
        error: 'Content creation failed',
        message: 'Platform connection not found',
      };

      const result = contentErrorResponseSchema.safeParse(mockError);
      expect(result.success).toBe(true);
    });

    it('should validate validation error with details', () => {
      const mockError = {
        error: 'Validation failed',
        details: [
          { field: 'content', message: 'Content is required' },
          { field: 'platforms', message: 'At least one platform is required' },
        ],
      };

      const result = contentErrorResponseSchema.safeParse(mockError);
      expect(result.success).toBe(true);
    });
  });

  describe('Enum Validation', () => {
    it('should validate all supported platforms', () => {
      const platforms = [
        'twitter',
        'linkedin',
        'instagram',
        'facebook',
        'tiktok',
        'threads',
        'youtube',
        'pinterest',
      ];

      platforms.forEach((platform) => {
        const result = contentPlatformSchema.safeParse(platform);
        expect(result.success).toBe(true);
      });
    });

    it('should validate all content statuses', () => {
      const statuses = ['draft', 'scheduled', 'published', 'failed', 'archived', 'pending_review'];

      statuses.forEach((status) => {
        const result = contentStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      });
    });
  });
});
