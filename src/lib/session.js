/**
 * Session Management Middleware
 * Integrates Redis with authentication system for session handling
 */

import { redisService } from './redis.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const SESSION_COOKIE_NAME = 'synthex_session';

// Session middleware for API routes
export function sessionMiddleware(req, res, next) {
  // Skip session handling for OPTIONS requests
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Get session from various sources
  const sessionId = getSessionIdFromRequest(req);
  
  if (sessionId) {
    // Attach session getter to request
    req.getSession = async () => {
      const session = await redisService.getSession(sessionId);
      if (session && new Date(session.expiresAt) > new Date()) {
        // Update last activity
        await redisService.updateSession(sessionId, {
          lastActivity: new Date().toISOString(),
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        });
        return session;
      }
      return null;
    };

    // Attach session update method
    req.updateSession = async (data, extendTTL = false) => {
      return await redisService.updateSession(sessionId, data, extendTTL);
    };

    // Attach session destroy method
    req.destroySession = async () => {
      await redisService.deleteSession(sessionId);
      // Clear session cookie
      res.clearCookie(SESSION_COOKIE_NAME);
      return true;
    };
  } else {
    // No session found - provide empty methods
    req.getSession = async () => null;
    req.updateSession = async () => null;
    req.destroySession = async () => false;
  }

  next();
}

// Create a new session
export async function createUserSession(userId, userData, options = {}) {
  const sessionData = {
    userId,
    email: userData.email,
    username: userData.username || userData.name,
    plan: userData.plan || 'free',
    permissions: userData.permissions || [],
    preferences: userData.preferences || {},
    ...options.additionalData
  };

  const sessionId = await redisService.createSession(
    userId, 
    sessionData, 
    options.ttl
  );

  // Also create JWT token for stateless authentication
  const jwtToken = jwt.sign(
    { 
      userId, 
      sessionId, 
      email: userData.email,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: options.jwtExpiry || '24h' }
  );

  return {
    sessionId,
    jwtToken,
    expiresAt: new Date(Date.now() + (options.ttl || 24 * 60 * 60) * 1000)
  };
}

// Verify session and return user data
export async function verifySession(sessionId) {
  if (!sessionId) return null;

  const session = await redisService.getSession(sessionId);
  if (!session) return null;

  // Check expiration
  if (new Date(session.expiresAt) <= new Date()) {
    await redisService.deleteSession(sessionId);
    return null;
  }

  return session;
}

// Verify JWT token and optionally check session
export async function verifyJWT(token, checkSession = true) {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (checkSession && decoded.sessionId) {
      // Verify session still exists
      const session = await verifySession(decoded.sessionId);
      if (!session) return null;
      
      return { ...decoded, session };
    }

    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

// Get session ID from request (cookie, header, or query)
export function getSessionIdFromRequest(req) {
  // Try cookie first
  let sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  
  // Try Authorization header
  if (!sessionId) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.decode(token);
        sessionId = decoded?.sessionId;
      } catch (error) {
        // Invalid JWT, continue to other methods
      }
    }
  }
  
  // Try session header
  if (!sessionId) {
    sessionId = req.headers['x-session-id'];
  }
  
  // Try query parameter (for WebSocket upgrades)
  if (!sessionId) {
    sessionId = req.query?.sessionId;
  }

  return sessionId;
}

// Set session cookie
export function setSessionCookie(res, sessionId, options = {}) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: options.maxAge || 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
    ...options.cookieOptions
  };

  res.cookie(SESSION_COOKIE_NAME, sessionId, cookieOptions);
}

// Authentication middleware that uses sessions
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Verify JWT and optionally session
  verifyJWT(token, true).then(user => {
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  }).catch(error => {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  });
}

// Optional authentication (doesn't fail if no auth)
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    req.user = null;
    return next();
  }

  verifyJWT(token, false).then(user => {
    req.user = user || null;
    next();
  }).catch(error => {
    console.error('Optional auth error:', error);
    req.user = null;
    next();
  });
}

// Session cleanup utility
export async function cleanupExpiredSessions() {
  try {
    // This would be implemented based on Redis scanning
    // For now, rely on Redis TTL to handle cleanup
    console.log('Session cleanup completed');
  } catch (error) {
    console.error('Session cleanup failed:', error);
  }
}

// Get session statistics
export async function getSessionStats() {
  const redisStats = redisService.getStats();
  
  return {
    redis: redisStats,
    timestamp: new Date().toISOString()
  };
}

// Session activity tracking
export async function trackSessionActivity(sessionId, activity) {
  try {
    const session = await redisService.getSession(sessionId);
    if (session) {
      const activities = session.activities || [];
      activities.push({
        type: activity.type,
        timestamp: new Date().toISOString(),
        details: activity.details
      });

      // Keep only last 10 activities
      const recentActivities = activities.slice(-10);

      await redisService.updateSession(sessionId, {
        activities: recentActivities,
        lastActivity: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Failed to track session activity:', error);
  }
}

const sessionService = {
  middleware: sessionMiddleware,
  create: createUserSession,
  verify: verifySession,
  verifyJWT,
  requireAuth,
  optionalAuth,
  getSessionId: getSessionIdFromRequest,
  setCookie: setSessionCookie,
  cleanup: cleanupExpiredSessions,
  stats: getSessionStats,
  track: trackSessionActivity
};

export default sessionService;
