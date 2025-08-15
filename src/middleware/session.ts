/**
 * Session Management Middleware
 * Handles Redis-based session validation and management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession, get } from '@/src/lib/redis-unified';

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
  lastActivity?: string;
}

export interface SessionData {
  user: SessionUser;
  sessionId: string;
  isValid: boolean;
  needsRefresh: boolean;
}

/**
 * Validate and retrieve session from Redis
 */
export async function validateSession(request: NextRequest): Promise<SessionData | null> {
  try {
    // Get session ID from cookie
    const sessionId = request.cookies.get('redis-session-id')?.value;
    
    if (!sessionId) {
      return null;
    }
    
    // Retrieve session from Redis
    const session = await getSession(sessionId);
    
    if (!session) {
      return null;
    }
    
    // Check if session is expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return null;
    }
    
    // Update last activity
    const now = new Date();
    const lastActivity = session.lastActivity ? new Date(session.lastActivity) : now;
    const timeSinceActivity = now.getTime() - lastActivity.getTime();
    const shouldUpdateActivity = timeSinceActivity > 60000; // Update if more than 1 minute
    
    if (shouldUpdateActivity) {
      await updateSession(sessionId, {
        lastActivity: now.toISOString()
      });
    }
    
    // Get cached user profile for quick access
    const userId = session.userId;
    let userProfile = await get(`user_profile:${userId}`);
    
    if (!userProfile) {
      // Fallback to session data
      userProfile = {
        id: userId,
        email: session.email,
        name: session.name || session.email?.split('@')[0],
        emailVerified: session.emailVerified
      };
    }
    
    return {
      user: userProfile,
      sessionId,
      isValid: true,
      needsRefresh: timeSinceActivity > 3600000 // Needs refresh after 1 hour
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Session middleware for API routes
 */
export async function withSession(
  request: NextRequest,
  handler: (request: NextRequest, session: SessionData) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await validateSession(request);
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized - Please login' },
      { status: 401 }
    );
  }
  
  // Add session data to request headers for downstream use
  request.headers.set('x-user-id', session.user.id);
  request.headers.set('x-session-id', session.sessionId);
  request.headers.set('x-user-email', session.user.email);
  
  return handler(request, session);
}

/**
 * Optional session middleware (doesn't require auth)
 */
export async function withOptionalSession(
  request: NextRequest,
  handler: (request: NextRequest, session?: SessionData) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await validateSession(request);
  
  if (session) {
    // Add session data to request headers if available
    request.headers.set('x-user-id', session.user.id);
    request.headers.set('x-session-id', session.sessionId);
    request.headers.set('x-user-email', session.user.email);
    return handler(request, session);
  }
  
  return handler(request);
}

/**
 * Admin session middleware (requires admin role)
 */
export async function withAdminSession(
  request: NextRequest,
  handler: (request: NextRequest, session: SessionData) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await validateSession(request);
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized - Please login' },
      { status: 401 }
    );
  }
  
  // Check admin role in Redis cache
  const userRole = await get(`user_role:${session.user.id}`);
  
  if (userRole !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    );
  }
  
  return handler(request, session);
}

/**
 * Extract session from request without validation
 * Useful for logging and monitoring
 */
export function getSessionInfo(request: NextRequest): {
  sessionId?: string;
  userId?: string;
  userEmail?: string;
} {
  return {
    sessionId: request.cookies.get('redis-session-id')?.value || 
               request.headers.get('x-session-id') || undefined,
    userId: request.cookies.get('user-id')?.value || 
            request.headers.get('x-user-id') || undefined,
    userEmail: request.headers.get('x-user-email') || undefined
  };
}
