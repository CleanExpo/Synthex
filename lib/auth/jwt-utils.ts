/**
 * JWT Utilities
 *
 * Centralized JWT verification and token generation.
 * CRITICAL: This module enforces JWT_SECRET requirement - no fallback secrets.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET (CRITICAL) - Must be set, app will fail without it
 *
 * @module lib/auth/jwt-utils
 */

import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// =============================================================================
// Types
// =============================================================================

export interface JWTPayload {
  userId: string;
  email?: string;
  name?: string;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
}

// =============================================================================
// Secret Management
// =============================================================================

/**
 * Get the JWT secret from environment variables.
 * CRITICAL: This will throw if JWT_SECRET is not set.
 */
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required but not set. ' +
      'Please set JWT_SECRET in your environment variables. ' +
      'This is a critical security requirement.'
    );
  }

  // Warn if secret is too short (should be at least 32 characters)
  if (secret.length < 32) {
    console.warn(
      '[SECURITY WARNING] JWT_SECRET should be at least 32 characters long. ' +
      'Current length: ' + secret.length
    );
  }

  return secret;
}

// =============================================================================
// Token Verification
// =============================================================================

/**
 * Verify a JWT token and return the payload.
 * @throws Error if JWT_SECRET is not set or token is invalid
 */
export function verifyToken(token: string): JWTPayload {
  const secret = getJWTSecret();
  const decoded = jwt.verify(token, secret) as JwtPayload;

  return {
    userId: decoded.userId || decoded.sub || '',
    email: decoded.email,
    name: decoded.name,
    iat: decoded.iat,
    exp: decoded.exp,
  };
}

/**
 * Safely verify a token without throwing.
 * Returns null if verification fails.
 */
export function verifyTokenSafe(token: string): JWTPayload | null {
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

// =============================================================================
// Token Generation
// =============================================================================

/**
 * Generate a new JWT token.
 * @throws Error if JWT_SECRET is not set
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: string | number = '7d'): string {
  const secret = getJWTSecret();

  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };

  return jwt.sign(
    {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    options
  );
}

// =============================================================================
// Request Authentication
// =============================================================================

/**
 * Extract and verify user ID from request authorization header.
 * Returns null if not authenticated.
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  try {
    const payload = verifyToken(token);
    return payload.userId || null;
  } catch (error) {
    // Log for debugging but don't expose details
    console.error('[AUTH] Token verification failed:', error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error');
    return null;
  }
}

/**
 * Authenticate a request and return full auth result.
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return {
        authenticated: false,
        error: 'Unauthorized',
      };
    }

    return {
      authenticated: true,
      userId,
    };
  } catch (error) {
    return {
      authenticated: false,
      error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Authentication failed',
    };
  }
}

/**
 * Create a standard unauthorized response.
 */
export function unauthorizedResponse(message: string = 'Authentication required'): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized', message },
    { status: 401 }
  );
}

/**
 * Create a standard forbidden response.
 */
export function forbiddenResponse(message: string = 'Access denied'): NextResponse {
  return NextResponse.json(
    { error: 'Forbidden', message },
    { status: 403 }
  );
}

// =============================================================================
// Middleware Helper
// =============================================================================

/**
 * Higher-order function to wrap API route handlers with authentication.
 * Usage:
 *   export const GET = withAuth(async (request, userId) => { ... });
 */
export function withAuth<T extends NextResponse>(
  handler: (request: NextRequest, userId: string) => Promise<T>
): (request: NextRequest) => Promise<T | NextResponse> {
  return async (request: NextRequest) => {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return unauthorizedResponse() as T;
    }

    return handler(request, userId);
  };
}

// =============================================================================
// Cookie-Based Authentication (for API routes using httpOnly cookies)
// =============================================================================

/**
 * Extract user ID from auth-token cookie.
 * This is the primary method for authenticated API routes using httpOnly cookies.
 * Falls back to Authorization header if cookie is not present.
 *
 * Usage in API routes:
 *   const userId = await getUserIdFromCookies();
 *   if (!userId) return unauthorizedResponse();
 *
 * @returns User ID if authenticated, null otherwise
 */
export async function getUserIdFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return null;
    }

    const payload = verifyTokenSafe(token);
    return payload?.userId || null;
  } catch (error) {
    // Cookie access may fail in certain contexts
    console.error('[AUTH] Cookie access failed:', error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error');
    return null;
  }
}

/**
 * Combined auth check: tries cookies first, then Authorization header.
 * Use this for maximum compatibility across different client implementations.
 */
export async function getUserIdFromRequestOrCookies(request: NextRequest): Promise<string | null> {
  // First try cookies (preferred for httpOnly security)
  const cookieUserId = await getUserIdFromCookies();
  if (cookieUserId) {
    return cookieUserId;
  }

  // Fallback to Authorization header
  return getUserIdFromRequest(request);
}

/**
 * Require authentication - throws/returns early if not authenticated.
 * Convenience wrapper that returns an error response if not authenticated.
 */
export async function requireAuth(request: NextRequest): Promise<{ userId: string } | NextResponse> {
  const userId = await getUserIdFromRequestOrCookies(request);

  if (!userId) {
    return unauthorizedResponse();
  }

  return { userId };
}
