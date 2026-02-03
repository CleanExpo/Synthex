/**
 * Unit Tests for JWT Utilities
 *
 * Tests the centralized JWT verification and token generation.
 * These tests verify security requirements are enforced.
 */

import jwt from 'jsonwebtoken';

// Mock process.env before importing the module
const originalEnv = process.env;

describe('JWT Utilities', () => {
  const TEST_SECRET = 'a-very-long-test-secret-that-is-at-least-32-chars';
  const TEST_PAYLOAD = {
    userId: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, JWT_SECRET: TEST_SECRET };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const { verifyToken, generateToken } = await import('../../../lib/auth/jwt-utils');

      const token = generateToken(TEST_PAYLOAD);
      const decoded = verifyToken(token);

      expect(decoded.userId).toBe(TEST_PAYLOAD.userId);
      expect(decoded.email).toBe(TEST_PAYLOAD.email);
      expect(decoded.name).toBe(TEST_PAYLOAD.name);
    });

    it('should throw on invalid token', async () => {
      const { verifyToken } = await import('../../../lib/auth/jwt-utils');

      expect(() => verifyToken('invalid-token')).toThrow();
    });

    it('should throw on expired token', async () => {
      const { verifyToken } = await import('../../../lib/auth/jwt-utils');

      // Create an expired token
      const expiredToken = jwt.sign(
        { ...TEST_PAYLOAD, iat: Math.floor(Date.now() / 1000) - 3600 },
        TEST_SECRET,
        { expiresIn: '1s' }
      );

      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(() => verifyToken(expiredToken)).toThrow();
    });

    it('should throw on token signed with wrong secret', async () => {
      const { verifyToken } = await import('../../../lib/auth/jwt-utils');

      const wrongToken = jwt.sign(TEST_PAYLOAD, 'wrong-secret');

      expect(() => verifyToken(wrongToken)).toThrow();
    });
  });

  describe('verifyTokenSafe', () => {
    it('should return payload for valid token', async () => {
      const { verifyTokenSafe, generateToken } = await import('../../../lib/auth/jwt-utils');

      const token = generateToken(TEST_PAYLOAD);
      const decoded = verifyTokenSafe(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(TEST_PAYLOAD.userId);
    });

    it('should return null for invalid token', async () => {
      const { verifyTokenSafe } = await import('../../../lib/auth/jwt-utils');

      const decoded = verifyTokenSafe('invalid-token');

      expect(decoded).toBeNull();
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', async () => {
      const { generateToken } = await import('../../../lib/auth/jwt-utils');

      const token = generateToken(TEST_PAYLOAD);

      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

      // Verify the token is decodable
      const decoded = jwt.verify(token, TEST_SECRET) as any;
      expect(decoded.userId).toBe(TEST_PAYLOAD.userId);
    });

    it('should set iat claim', async () => {
      const { generateToken } = await import('../../../lib/auth/jwt-utils');

      const token = generateToken(TEST_PAYLOAD);
      const decoded = jwt.decode(token) as any;

      expect(decoded.iat).toBeDefined();
      expect(typeof decoded.iat).toBe('number');
    });

    it('should set exp claim based on expiresIn', async () => {
      const { generateToken } = await import('../../../lib/auth/jwt-utils');

      const token = generateToken(TEST_PAYLOAD, '1h');
      const decoded = jwt.decode(token) as any;

      expect(decoded.exp).toBeDefined();
      // exp should be roughly 1 hour from iat
      expect(decoded.exp - decoded.iat).toBeCloseTo(3600, -1);
    });

    it('should use default 7d expiration', async () => {
      const { generateToken } = await import('../../../lib/auth/jwt-utils');

      const token = generateToken(TEST_PAYLOAD);
      const decoded = jwt.decode(token) as any;

      // Default is 7 days = 604800 seconds
      expect(decoded.exp - decoded.iat).toBeCloseTo(604800, -1);
    });
  });

  describe('JWT_SECRET requirement', () => {
    it('should throw if JWT_SECRET is not set', async () => {
      jest.resetModules();
      delete process.env.JWT_SECRET;

      const { verifyToken, generateToken } = await import('../../../lib/auth/jwt-utils');

      const testToken = jwt.sign(TEST_PAYLOAD, 'any-secret');

      expect(() => verifyToken(testToken)).toThrow('JWT_SECRET');
      expect(() => generateToken(TEST_PAYLOAD)).toThrow('JWT_SECRET');
    });

    it('should warn if JWT_SECRET is too short', async () => {
      jest.resetModules();
      process.env.JWT_SECRET = 'short';

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      try {
        const { generateToken } = await import('../../../lib/auth/jwt-utils');
        generateToken(TEST_PAYLOAD);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('JWT_SECRET should be at least 32 characters')
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('getUserIdFromRequest', () => {
    it('should extract userId from valid Authorization header', async () => {
      const { getUserIdFromRequest, generateToken } = await import('../../../lib/auth/jwt-utils');

      const token = generateToken(TEST_PAYLOAD);
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(`Bearer ${token}`),
        },
      } as any;

      const userId = await getUserIdFromRequest(mockRequest);

      expect(userId).toBe(TEST_PAYLOAD.userId);
    });

    it('should return null if no Authorization header', async () => {
      const { getUserIdFromRequest } = await import('../../../lib/auth/jwt-utils');

      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
      } as any;

      const userId = await getUserIdFromRequest(mockRequest);

      expect(userId).toBeNull();
    });

    it('should return null if Authorization header is not Bearer', async () => {
      const { getUserIdFromRequest } = await import('../../../lib/auth/jwt-utils');

      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Basic abc123'),
        },
      } as any;

      const userId = await getUserIdFromRequest(mockRequest);

      expect(userId).toBeNull();
    });

    it('should return null for invalid token', async () => {
      const { getUserIdFromRequest } = await import('../../../lib/auth/jwt-utils');

      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer invalid-token'),
        },
      } as any;

      const userId = await getUserIdFromRequest(mockRequest);

      expect(userId).toBeNull();
    });
  });

  describe('authenticateRequest', () => {
    it('should return authenticated: true for valid request', async () => {
      const { authenticateRequest, generateToken } = await import('../../../lib/auth/jwt-utils');

      const token = generateToken(TEST_PAYLOAD);
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(`Bearer ${token}`),
        },
      } as any;

      const result = await authenticateRequest(mockRequest);

      expect(result.authenticated).toBe(true);
      expect(result.userId).toBe(TEST_PAYLOAD.userId);
      expect(result.error).toBeUndefined();
    });

    it('should return authenticated: false for missing header', async () => {
      const { authenticateRequest } = await import('../../../lib/auth/jwt-utils');

      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
      } as any;

      const result = await authenticateRequest(mockRequest);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });

  describe('withAuth higher-order function', () => {
    it('should call handler with userId for authenticated request', async () => {
      const { withAuth, generateToken } = await import('../../../lib/auth/jwt-utils');

      const token = generateToken(TEST_PAYLOAD);
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(`Bearer ${token}`),
        },
      } as any;

      const mockResponse = { status: 200, body: 'ok' };
      const handler = jest.fn().mockResolvedValue(mockResponse);

      const wrappedHandler = withAuth(handler);
      const result = await wrappedHandler(mockRequest);

      expect(handler).toHaveBeenCalledWith(mockRequest, TEST_PAYLOAD.userId);
      expect(result).toBe(mockResponse);
    });

    it('should not call handler for unauthenticated request', async () => {
      const { withAuth } = await import('../../../lib/auth/jwt-utils');

      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
      } as any;

      const handler = jest.fn();

      const wrappedHandler = withAuth(handler);

      // The wrapped handler attempts to return an unauthorized response
      // which requires NextResponse.json - we verify the handler was not called
      try {
        await wrappedHandler(mockRequest);
      } catch {
        // NextResponse.json may fail in test environment, but handler should not be called
      }

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
