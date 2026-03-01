/**
 * Unit Tests for JWT Utilities and Auth Helpers
 * Tests token generation/verification, getUserIdFromRequest, isOwnerEmail,
 * withAuth HOF, unauthorizedResponse, forbiddenResponse.
 *
 * Uses the real jsonwebtoken library for JWT operations.
 * Mocks next/headers cookies() for cookie-based auth tests.
 * Uses createMockNextRequest to avoid the jest.setup.js polyfill conflict with NextRequest.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// Mock next/headers for cookie-based auth
// NOTE: We use a wrapper function pattern so the mock survives jest's resetMocks: true.
// The inner implementation is re-applied in beforeEach().
const mockCookieGet = jest.fn();
const mockCookies = jest.fn();

jest.mock('next/headers', () => ({
  cookies: (...args: unknown[]) => mockCookies(...args),
}));

// Set JWT_SECRET before importing the module
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

import {
  verifyToken,
  verifyTokenSafe,
  generateToken,
  getUserIdFromRequest,
  getUserIdFromCookies,
  getUserIdFromRequestOrCookies,
  authenticateRequest,
  withAuth,
  isOwnerEmail,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/jwt-utils';

describe('JWT Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply the cookies() mock implementation after resetMocks clears it
    mockCookies.mockImplementation(async () => ({
      get: (...args: unknown[]) => mockCookieGet(...args),
    }));
    mockCookieGet.mockReturnValue(undefined);
  });

  function createRequest(
    url: string = 'http://localhost:3000/api/test',
    headers: Record<string, string> = {}
  ) {
    return createMockNextRequest({ url, headers });
  }

  // =========================================================================
  // generateToken + verifyToken roundtrip
  // =========================================================================
  describe('generateToken + verifyToken', () => {
    it('should generate and verify a token', () => {
      const token = generateToken({ userId: 'user-123', email: 'test@example.com' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

      const payload = verifyToken(token);

      expect(payload.userId).toBe('user-123');
      expect(payload.email).toBe('test@example.com');
    });

    it('should set iat timestamp', () => {
      const token = generateToken({ userId: 'user-iat' });
      const payload = verifyToken(token);

      expect(payload.iat).toBeDefined();
      expect(payload.iat).toBeGreaterThan(0);
    });

    it('should set exp timestamp', () => {
      const token = generateToken({ userId: 'user-exp' }, '1h');
      const payload = verifyToken(token);

      expect(payload.exp).toBeDefined();
      // exp should be roughly 1 hour from iat
      expect(payload.exp! - payload.iat!).toBeCloseTo(3600, -1);
    });

    it('should include optional fields in token', () => {
      const token = generateToken({
        userId: 'user-full',
        email: 'full@example.com',
        name: 'Full User',
        onboardingComplete: true,
        apiKeyConfigured: false,
      });
      const payload = verifyToken(token);

      expect(payload.userId).toBe('user-full');
      expect(payload.email).toBe('full@example.com');
      expect(payload.name).toBe('Full User');
    });

    it('should accept numeric expiresIn', () => {
      // 3600 seconds = 1 hour
      const token = generateToken({ userId: 'user-num' }, 3600);
      const payload = verifyToken(token);

      expect(payload.userId).toBe('user-num');
      expect(payload.exp).toBeDefined();
    });
  });

  // =========================================================================
  // verifyToken error cases
  // =========================================================================
  describe('verifyToken error cases', () => {
    it('should throw on invalid token', () => {
      expect(() => verifyToken('invalid.token.here')).toThrow();
    });

    it('should throw on empty string', () => {
      expect(() => verifyToken('')).toThrow();
    });

    it('should throw on expired token', () => {
      // Generate a token that expires in 0 seconds (already expired)
      const token = generateToken({ userId: 'expired-user' }, '0s');

      // Should throw because it's expired
      expect(() => verifyToken(token)).toThrow();
    });

    it('should throw on token signed with different secret', () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ userId: 'hacker' }, 'different-secret');

      expect(() => verifyToken(token)).toThrow();
    });
  });

  // =========================================================================
  // verifyTokenSafe
  // =========================================================================
  describe('verifyTokenSafe', () => {
    it('should return payload for valid token', () => {
      const token = generateToken({ userId: 'safe-user' });
      const payload = verifyTokenSafe(token);

      expect(payload).not.toBeNull();
      expect(payload!.userId).toBe('safe-user');
    });

    it('should return null for invalid token', () => {
      const payload = verifyTokenSafe('garbage-token');

      expect(payload).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(verifyTokenSafe('')).toBeNull();
    });
  });

  // =========================================================================
  // getUserIdFromRequest (via Authorization header)
  // =========================================================================
  describe('getUserIdFromRequest', () => {
    it('should extract userId from Bearer token', async () => {
      const token = generateToken({ userId: 'bearer-user' });
      const req = createRequest('http://localhost:3000/api/test', {
        authorization: `Bearer ${token}`,
      });

      const userId = await getUserIdFromRequest(req);

      expect(userId).toBe('bearer-user');
    });

    it('should return null when no authorization header', async () => {
      const req = createRequest();

      const userId = await getUserIdFromRequest(req);

      expect(userId).toBeNull();
    });

    it('should return null when authorization is not Bearer', async () => {
      const req = createRequest('http://localhost:3000/api/test', {
        authorization: 'Basic dXNlcjpwYXNz',
      });

      const userId = await getUserIdFromRequest(req);

      expect(userId).toBeNull();
    });

    it('should return null for invalid Bearer token', async () => {
      const req = createRequest('http://localhost:3000/api/test', {
        authorization: 'Bearer invalid-token',
      });

      const userId = await getUserIdFromRequest(req);

      expect(userId).toBeNull();
    });
  });

  // =========================================================================
  // getUserIdFromCookies
  // =========================================================================
  describe('getUserIdFromCookies', () => {
    it('should extract userId from auth-token cookie', async () => {
      const token = generateToken({ userId: 'cookie-user' });
      mockCookieGet.mockReturnValue({ value: token });

      const userId = await getUserIdFromCookies();

      expect(userId).toBe('cookie-user');
      expect(mockCookieGet).toHaveBeenCalledWith('auth-token');
    });

    it('should return null when cookie is not set', async () => {
      mockCookieGet.mockReturnValue(undefined);

      const userId = await getUserIdFromCookies();

      expect(userId).toBeNull();
    });

    it('should return null for invalid cookie token', async () => {
      mockCookieGet.mockReturnValue({ value: 'not-a-jwt' });

      const userId = await getUserIdFromCookies();

      expect(userId).toBeNull();
    });
  });

  // =========================================================================
  // getUserIdFromRequestOrCookies
  // =========================================================================
  describe('getUserIdFromRequestOrCookies', () => {
    it('should prefer cookie auth over header auth', async () => {
      const cookieToken = generateToken({ userId: 'cookie-user' });
      const headerToken = generateToken({ userId: 'header-user' });

      mockCookieGet.mockReturnValue({ value: cookieToken });

      const req = createRequest('http://localhost:3000/api/test', {
        authorization: `Bearer ${headerToken}`,
      });

      const userId = await getUserIdFromRequestOrCookies(req);

      // Cookies are checked first
      expect(userId).toBe('cookie-user');
    });

    it('should fall back to header when cookie is not set', async () => {
      mockCookieGet.mockReturnValue(undefined);

      const headerToken = generateToken({ userId: 'fallback-user' });
      const req = createRequest('http://localhost:3000/api/test', {
        authorization: `Bearer ${headerToken}`,
      });

      const userId = await getUserIdFromRequestOrCookies(req);

      expect(userId).toBe('fallback-user');
    });

    it('should return null when neither cookie nor header is set', async () => {
      mockCookieGet.mockReturnValue(undefined);
      const req = createRequest();

      const userId = await getUserIdFromRequestOrCookies(req);

      expect(userId).toBeNull();
    });
  });

  // =========================================================================
  // authenticateRequest
  // =========================================================================
  describe('authenticateRequest', () => {
    it('should return authenticated=true with userId for valid request', async () => {
      const token = generateToken({ userId: 'auth-user' });
      const req = createRequest('http://localhost:3000/api/test', {
        authorization: `Bearer ${token}`,
      });

      const result = await authenticateRequest(req);

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe('auth-user');
      expect(result.error).toBeUndefined();
    });

    it('should return authenticated=false for unauthenticated request', async () => {
      const req = createRequest();

      const result = await authenticateRequest(req);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(result.userId).toBeUndefined();
    });
  });

  // =========================================================================
  // withAuth HOF
  // =========================================================================
  describe('withAuth', () => {
    it('should call handler with userId for authenticated requests', async () => {
      const { NextResponse } = require('next/server');
      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ ok: true })
      );

      const wrapped = withAuth(handler);

      const token = generateToken({ userId: 'hof-user' });
      const req = createRequest('http://localhost:3000/api/test', {
        authorization: `Bearer ${token}`,
      });

      await wrapped(req);

      expect(handler).toHaveBeenCalledWith(req, 'hof-user');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const handler = jest.fn();
      const wrapped = withAuth(handler);

      const req = createRequest();
      const res = await wrapped(req);
      const body = await res.json();

      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });
  });

  // =========================================================================
  // isOwnerEmail
  // =========================================================================
  describe('isOwnerEmail', () => {
    it('should return true for owner email', () => {
      expect(isOwnerEmail('phill.mcgurk@gmail.com')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isOwnerEmail('Phill.McGurk@Gmail.com')).toBe(true);
      expect(isOwnerEmail('PHILL.MCGURK@GMAIL.COM')).toBe(true);
    });

    it('should return false for non-owner email', () => {
      expect(isOwnerEmail('someone@example.com')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isOwnerEmail(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isOwnerEmail(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isOwnerEmail('')).toBe(false);
    });
  });

  // =========================================================================
  // Response helpers
  // =========================================================================
  describe('unauthorizedResponse', () => {
    it('should return 401 with default message', async () => {
      const res = unauthorizedResponse();
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Authentication required');
    });

    it('should accept custom message', async () => {
      const res = unauthorizedResponse('Token expired');
      const body = await res.json();

      expect(body.message).toBe('Token expired');
    });
  });

  describe('forbiddenResponse', () => {
    it('should return 403 with default message', async () => {
      const res = forbiddenResponse();
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toBe('Forbidden');
      expect(body.message).toBe('Access denied');
    });

    it('should accept custom message', async () => {
      const res = forbiddenResponse('Insufficient permissions');
      const body = await res.json();

      expect(body.message).toBe('Insufficient permissions');
    });
  });
});
