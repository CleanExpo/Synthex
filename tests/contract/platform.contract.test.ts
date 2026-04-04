/**
 * Platform & Social API Contract Tests
 *
 * Validates platform connection, social posting, and integration schemas.
 *
 * @module tests/contract/platform.contract.test
 */

import { describe, it, expect } from '@jest/globals';
import {
  platformEnumSchema,
  platformConnectionSchema,
  listPlatformConnectionsResponseSchema,
  errorResponseSchema,
  successResponseSchema,
  paginationSchema,
} from '@/lib/schemas';

describe('Platform API Contract Tests', () => {
  describe('Platform Enum Validation', () => {
    it('should validate all 9 supported platforms', () => {
      const platforms = [
        'youtube', 'instagram', 'tiktok', 'twitter',
        'facebook', 'linkedin', 'pinterest', 'reddit', 'threads',
      ];

      platforms.forEach((platform) => {
        const result = platformEnumSchema.safeParse(platform);
        expect(result.success).toBe(true);
      });
    });

    it('should reject unknown platforms', () => {
      const invalid = ['snapchat', 'mastodon', 'bluesky', '', 123];
      invalid.forEach((platform) => {
        const result = platformEnumSchema.safeParse(platform);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Platform Connection Schema', () => {
    it('should validate a connected platform', () => {
      const connection = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        platform: 'twitter',
        platformUserId: '12345',
        platformUsername: '@synthex',
        isActive: true,
        connectedAt: '2025-01-01T00:00:00.000Z',
        metadata: { scope: 'read,write' },
      };

      const result = platformConnectionSchema.safeParse(connection);
      expect(result.success).toBe(true);
    });

    it('should validate a disconnected platform', () => {
      const connection = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        platform: 'instagram',
        platformUserId: null,
        platformUsername: null,
        isActive: false,
        metadata: null,
      };

      const result = platformConnectionSchema.safeParse(connection);
      expect(result.success).toBe(true);
    });

    it('should reject connection with invalid platform', () => {
      const invalid = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        platform: 'snapchat',
        isActive: true,
      };

      const result = platformConnectionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('List Platform Connections Response', () => {
    it('should validate list response with multiple platforms', () => {
      const response = {
        success: true,
        data: [
          {
            id: '1',
            platform: 'twitter',
            platformUserId: '123',
            platformUsername: '@test',
            isActive: true,
          },
          {
            id: '2',
            platform: 'instagram',
            platformUserId: '456',
            platformUsername: 'test',
            isActive: true,
          },
          {
            id: '3',
            platform: 'linkedin',
            isActive: false,
          },
        ],
      };

      const result = listPlatformConnectionsResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate empty connections list', () => {
      const response = {
        success: true,
        data: [],
      };

      const result = listPlatformConnectionsResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('Pagination Schema', () => {
    it('should validate standard pagination', () => {
      const pagination = {
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
      };

      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
    });

    it('should validate empty result pagination', () => {
      const pagination = {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      };

      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
    });

    it('should reject negative page', () => {
      const invalid = { page: -1, limit: 20, total: 10, totalPages: 1 };
      const result = paginationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Error Response Schema', () => {
    it('should validate basic error', () => {
      const error = { error: 'Platform not found' };
      const result = errorResponseSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('should validate error with message', () => {
      const error = { error: 'Connection failed', message: 'OAuth token expired' };
      const result = errorResponseSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('should validate error with details', () => {
      const error = {
        error: 'Validation failed',
        details: [
          { field: 'platform', message: 'Invalid platform' },
        ],
      };
      const result = errorResponseSchema.safeParse(error);
      expect(result.success).toBe(true);
    });
  });

  describe('Success Response Schema', () => {
    it('should validate success without message', () => {
      const response = { success: true };
      const result = successResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate success with message', () => {
      const response = { success: true, message: 'Platform connected' };
      const result = successResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should reject success: false', () => {
      const response = { success: false };
      const result = successResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });
});
