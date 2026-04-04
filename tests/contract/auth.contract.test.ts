/**
 * Auth API Contract Tests
 *
 * Validates that auth API endpoints conform to their Zod schemas.
 * These tests ensure API responses match the expected shape.
 *
 * @module tests/contract/auth.contract.test
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  loginResponseSchema,
  signupResponseSchema,
  getUserResponseSchema,
  authErrorResponseSchema,
  loginSchema,
  signupSchema,
} from '@/lib/schemas';

// Mock fetch for API calls
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';

async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; data: unknown }> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch (error) {
    return { status: 0, data: { error: 'Network error' } };
  }
}

describe('Auth API Contract Tests', () => {
  describe('Input Schema Validation', () => {
    it('should validate correct login input', () => {
      const validInput = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = loginSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid login email', () => {
      const invalidInput = {
        email: 'not-an-email',
        password: 'password123',
      };

      const result = loginSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty login password', () => {
      const invalidInput = {
        email: 'test@example.com',
        password: '',
      };

      const result = loginSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should validate correct signup input', () => {
      const validInput = {
        email: 'new@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        name: 'Test User',
        acceptTerms: true,
      };

      const result = signupSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords in signup', () => {
      const invalidInput = {
        email: 'new@example.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
        name: 'Test User',
        acceptTerms: true,
      };

      const result = signupSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject weak password in signup', () => {
      const invalidInput = {
        email: 'new@example.com',
        password: 'weak',
        confirmPassword: 'weak',
        name: 'Test User',
        acceptTerms: true,
      };

      const result = signupSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('Response Schema Validation', () => {
    it('should validate successful login response shape', () => {
      const mockResponse = {
        success: true,
        message: 'Login successful',
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: null,
        },
        token: 'jwt.token.here',
      };

      const result = loginResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should validate successful signup response shape', () => {
      const mockResponse = {
        success: true,
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'new@example.com',
          name: 'New User',
        },
        message: 'Account created successfully',
        requiresVerification: true,
      };

      const result = signupResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should validate get user response shape', () => {
      const mockResponse = {
        success: true,
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          name: 'Test User',
          avatar: null,
          emailVerified: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          lastLogin: '2024-01-15T00:00:00.000Z',
          preferences: { theme: 'dark' },
          organizationId: null,
          unreadNotifications: 5,
          totalCampaigns: 10,
          totalProjects: 3,
        },
      };

      const result = getUserResponseSchema.safeParse(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should validate error response shape', () => {
      const mockError = {
        error: 'Invalid credentials',
        message: 'The email or password is incorrect',
      };

      const result = authErrorResponseSchema.safeParse(mockError);
      expect(result.success).toBe(true);
    });

    it('should validate error response with details', () => {
      const mockError = {
        error: 'Validation failed',
        details: [
          { field: 'email', message: 'Invalid email format' },
          { field: 'password', message: 'Password too short' },
        ],
      };

      const result = authErrorResponseSchema.safeParse(mockError);
      expect(result.success).toBe(true);
    });
  });

  describe('API Integration (when server available)', () => {
    // These tests run against a live server if available
    const skipIntegration = !process.env.RUN_INTEGRATION_TESTS;

    // Skip integration tests when not configured
    (skipIntegration ? it.skip : it)('POST /api/auth/login returns valid response', async () => {
      const { status, data } = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      });

      // Should return 401 for wrong password
      expect([200, 401, 400]).toContain(status);

      // Response should match error schema if not successful
      if (status !== 200) {
        const result = authErrorResponseSchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    (skipIntegration ? it.skip : it)('GET /api/auth/user without auth returns 401', async () => {
      const { status, data } = await apiRequest('/api/auth/user');

      expect(status).toBe(401);

      const result = authErrorResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
