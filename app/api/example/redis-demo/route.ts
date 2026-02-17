/**
 * Example API Route with Redis Integration
 * Demonstrates session management, rate limiting, and caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { readDefault as withRateLimitWrapper } from '@/lib/rate-limit';
import { set, get, del, exists } from '@/lib/redis-unified';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';

// Session type for the stub
interface SessionData {
  userId?: string;
  user: { id: string; email?: string };
  sessionId: string;
  isValid: boolean;
  needsRefresh: boolean;
}

// Session middleware stub (src/middleware/session was deleted)
async function withSession<T>(
  req: NextRequest,
  handler: (req: NextRequest, session: SessionData) => Promise<T>
): Promise<T> {
  // Stub: extract userId from auth header if present
  const authHeader = req.headers.get('authorization');
  let userId: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        userId = payload.sub || payload.userId;
      }
    } catch {
      // Invalid token
    }
  }
  const session: SessionData = {
    userId,
    user: { id: userId || 'anonymous' },
    sessionId: `session_${userId || 'anon'}`,
    isValid: !!userId,
    needsRefresh: false,
  };
  return handler(req, session);
}

// Wrapper for rate limiting that matches old signature
async function withRateLimit(
  req: NextRequest,
  _preset: unknown,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return withRateLimitWrapper(req, async () => handler(req));
}

const RATE_LIMIT_PRESETS = {
  api: { maxRequests: 100, windowMs: 60000 },
  strict: { maxRequests: 10, windowMs: 60000 },
};

/**
 * GET /api/example/redis-demo
 * Demonstrates Redis caching with session validation
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting first
  return withRateLimit(request, RATE_LIMIT_PRESETS.api, async (req) => {
    // Then apply session validation
    return withSession(req, async (request, session) => {
      try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'status';
        
        switch (action) {
          case 'status':
            // Return session status
            return NextResponse.json({
              success: true,
              user: session.user,
              sessionId: session.sessionId,
              isValid: session.isValid,
              needsRefresh: session.needsRefresh,
              timestamp: new Date().toISOString()
            });
          
          case 'cache-get':
            // Demonstrate cache retrieval
            const cacheKey = searchParams.get('key');
            if (!cacheKey) {
              return NextResponse.json(
                { error: 'Cache key required' },
                { status: 400 }
              );
            }
            
            const cachedValue = await get(`demo:${session.user.id}:${cacheKey}`);
            
            return NextResponse.json({
              success: true,
              key: cacheKey,
              value: cachedValue,
              exists: cachedValue !== null,
              timestamp: new Date().toISOString()
            });
          
          case 'user-data':
            // Get user's cached profile
            const userProfile = await get(`user_profile:${session.user.id}`);
            const userSessions = await get(`user:sessions:${session.user.id}`);
            
            return NextResponse.json({
              success: true,
              profile: userProfile,
              activeSessions: userSessions?.length || 0,
              currentSession: session.sessionId,
              timestamp: new Date().toISOString()
            });
          
          default:
            return NextResponse.json(
              { error: 'Invalid action' },
              { status: 400 }
            );
        }
      } catch (error: unknown) {
        console.error('Redis demo error:', error);
        return NextResponse.json(
          { error: 'Internal server error', message: sanitizeErrorForResponse(error, 'Redis operation failed') },
          { status: 500 }
        );
      }
    });
  });
}

/**
 * POST /api/example/redis-demo
 * Demonstrates Redis write operations with rate limiting
 */
export async function POST(request: NextRequest) {
  // Stricter rate limit for write operations
  return withRateLimit(request, {
    limit: 10,
    windowMs: 60000,
    message: 'Too many write operations'
  }, async (req) => {
    return withSession(req, async (request, session) => {
      try {
        const body = await request.json();
        const { action, key, value, ttl = 3600 } = body;
        
        if (!action) {
          return NextResponse.json(
            { error: 'Action required' },
            { status: 400 }
          );
        }
        
        switch (action) {
          case 'cache-set':
            // Validate input
            if (!key || value === undefined) {
              return NextResponse.json(
                { error: 'Key and value required' },
                { status: 400 }
              );
            }
            
            // Store with user namespace
            const cacheKey = `demo:${session.user.id}:${key}`;
            await set(cacheKey, value, ttl);
            
            return NextResponse.json({
              success: true,
              message: 'Value cached successfully',
              key,
              ttl,
              expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
            });
          
          case 'increment':
            // Demonstrate atomic increment
            if (!key) {
              return NextResponse.json(
                { error: 'Key required' },
                { status: 400 }
              );
            }
            
            const counterKey = `counter:${session.user.id}:${key}`;
            const currentValue = await get(counterKey) || 0;
            const newValue = Number(currentValue) + 1;
            await set(counterKey, newValue, 86400); // 24 hours
            
            return NextResponse.json({
              success: true,
              message: 'Counter incremented',
              key,
              previousValue: currentValue,
              newValue
            });
          
          case 'track-activity':
            // Track user activity
            const activityKey = `activity:${session.user.id}:${new Date().toISOString().split('T')[0]}`;
            const activities = await get(activityKey) || [];
            
            activities.push({
              action: body.activityType || 'api_call',
              timestamp: new Date().toISOString(),
              metadata: body.metadata || {}
            });
            
            await set(activityKey, activities, 86400 * 7); // Keep for 7 days
            
            return NextResponse.json({
              success: true,
              message: 'Activity tracked',
              totalActivities: activities.length
            });
          
          default:
            return NextResponse.json(
              { error: 'Invalid action' },
              { status: 400 }
            );
        }
      } catch (error: unknown) {
        console.error('Redis demo write error:', error);
        return NextResponse.json(
          { error: 'Internal server error', message: sanitizeErrorForResponse(error, 'Redis operation failed') },
          { status: 500 }
        );
      }
    });
  });
}

/**
 * DELETE /api/example/redis-demo
 * Demonstrates Redis delete operations
 */
export async function DELETE(request: NextRequest) {
  return withRateLimit(request, RATE_LIMIT_PRESETS.strict, async (req) => {
    return withSession(req, async (request, session) => {
      try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        
        if (!key) {
          return NextResponse.json(
            { error: 'Key required' },
            { status: 400 }
          );
        }
        
        // Delete with user namespace
        const cacheKey = `demo:${session.user.id}:${key}`;
        const existed = await exists(cacheKey);
        
        if (!existed) {
          return NextResponse.json({
            success: false,
            message: 'Key does not exist',
            key
          });
        }
        
        await del(cacheKey);
        
        return NextResponse.json({
          success: true,
          message: 'Key deleted successfully',
          key
        });
      } catch (error: unknown) {
        console.error('Redis demo delete error:', error);
        return NextResponse.json(
          { error: 'Internal server error', message: sanitizeErrorForResponse(error, 'Redis operation failed') },
          { status: 500 }
        );
      }
    });
  });
}