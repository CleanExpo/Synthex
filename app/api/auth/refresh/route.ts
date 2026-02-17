/**
 * JWT Token Refresh Endpoint
 * POST /api/auth/refresh
 *
 * Refreshes an expiring or recently-expired JWT access token.
 * Reads the current auth-token cookie and issues a fresh token.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection for user validation (CRITICAL)
 *
 * FAILURE MODE: Returns 401 for invalid/expired tokens, 500 for server errors
 *
 * @module api/auth/refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { generateToken, verifyTokenSafe } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { authGeneral } from '@/lib/middleware/api-rate-limit';

const GRACE_PERIOD_SECONDS = 24 * 60 * 60; // 24 hours after expiration

export async function POST(request: NextRequest) {
  // Distributed rate limiting via Upstash Redis
  return authGeneral(request, async () => {
  try {
    // 1. Extract token from cookie or Authorization header
    const cookieToken = request.cookies.get('auth-token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken || headerToken;

    if (!token) {
      logger.warn('Token refresh attempted without token');
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    // 2. Try normal verification first
    let userId: string | null = null;
    const payload = verifyTokenSafe(token);

    if (payload?.userId) {
      userId = payload.userId;
      logger.debug('Token verified successfully', { userId });
    } else {
      // 3. Token might be expired — decode without verification to check grace period
      try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          logger.error('JWT_SECRET not configured');
          return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const decoded = jwt.verify(token, secret, { ignoreExpiration: true }) as jwt.JwtPayload;

        if (decoded.exp) {
          const expiredAt = decoded.exp;
          const now = Math.floor(Date.now() / 1000);
          const secondsSinceExpiry = now - expiredAt;

          if (secondsSinceExpiry <= GRACE_PERIOD_SECONDS && decoded.userId) {
            userId = decoded.userId;
            logger.info('Token within grace period', {
              userId: decoded.userId,
              expiredSecondsAgo: secondsSinceExpiry
            });
          } else {
            logger.warn('Token expired beyond grace period', {
              secondsSinceExpiry,
              gracePeriod: GRACE_PERIOD_SECONDS
            });
            return NextResponse.json(
              { error: 'Token expired beyond grace period. Please log in again.' },
              { status: 401 }
            );
          }
        } else {
          logger.warn('Token missing expiration claim');
          return NextResponse.json(
            { error: 'Invalid token format' },
            { status: 401 }
          );
        }
      } catch (error) {
        logger.error('Token verification failed', { error });
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        );
      }
    }

    if (!userId) {
      logger.warn('Unable to extract user identity from token');
      return NextResponse.json(
        { error: 'Unable to extract user identity' },
        { status: 401 }
      );
    }

    // 4. Verify user still exists and is active
    if (!prisma) {
      logger.error('Prisma client not initialized');
      return NextResponse.json(
        { error: 'Database connection unavailable' },
        { status: 500 }
      );
    }

    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      logger.warn('User not found during token refresh', { userId });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // 5. Generate fresh token
    const newToken = generateToken(
      { userId: user.id, email: user.email, name: user.name },
      '7d'
    );

    // 6. Build response with new cookie
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      expiresAt: expiresAt.toISOString(),
    });

    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    logger.info('Token refreshed successfully', {
      userId: user.id,
      expiresAt: expiresAt.toISOString()
    });

    return response;
  } catch (error) {
    logger.error('Token refresh error', { error });
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    );
  }
  });
}

export const runtime = 'nodejs';
