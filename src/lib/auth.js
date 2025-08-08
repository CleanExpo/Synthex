/**
 * Authentication Library
 * Handles JWT tokens, session management, and security
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'synthex-dev-secret-change-in-production-2024-secure';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

// Rate limiting configuration
const RATE_LIMITS = {
  login: { attempts: 5, window: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  signup: { attempts: 3, window: 60 * 60 * 1000 }, // 3 attempts per hour
  resetPassword: { attempts: 3, window: 60 * 60 * 1000 } // 3 attempts per hour
};

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map();

class AuthService {
  constructor() {
    this.jwtSecret = JWT_SECRET;
    this.jwtExpiresIn = JWT_EXPIRES_IN;
  }

  // Generate secure JWT token
  generateToken(payload, expiresIn = this.jwtExpiresIn) {
    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn,
      issuer: 'synthex-marketing',
      audience: 'synthex-users'
    });
  }

  // Generate refresh token
  generateRefreshToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'synthex-marketing',
        audience: 'synthex-users'
      });
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Hash password
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Compare password
  async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate secure session ID
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Validate password strength
  validatePassword(password) {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors = [];

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUppercase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowercase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: this.calculatePasswordStrength(password)
    };
  }

  // Calculate password strength
  calculatePasswordStrength(password) {
    let score = 0;
    
    // Length bonus
    score += Math.min(password.length * 2, 20);
    
    // Character variety bonus
    if (/[a-z]/.test(password)) score += 5;
    if (/[A-Z]/.test(password)) score += 5;
    if (/\d/.test(password)) score += 5;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 10;
    
    // Pattern penalties
    if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated characters
    if (/123|abc|qwerty/i.test(password)) score -= 15; // Common patterns

    if (score >= 80) return 'strong';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'weak';
    return 'very-weak';
  }

  // Rate limiting
  checkRateLimit(key, action) {
    const limit = RATE_LIMITS[action];
    if (!limit) return { allowed: true };

    const identifier = `${action}:${key}`;
    const now = Date.now();
    
    if (!rateLimitStore.has(identifier)) {
      rateLimitStore.set(identifier, { count: 1, resetTime: now + limit.window });
      return { allowed: true, remaining: limit.attempts - 1 };
    }

    const record = rateLimitStore.get(identifier);
    
    // Reset if window expired
    if (now > record.resetTime) {
      rateLimitStore.set(identifier, { count: 1, resetTime: now + limit.window });
      return { allowed: true, remaining: limit.attempts - 1 };
    }

    // Check if limit exceeded
    if (record.count >= limit.attempts) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        message: `Too many ${action} attempts. Try again later.`
      };
    }

    // Increment counter
    record.count++;
    return { allowed: true, remaining: limit.attempts - record.count };
  }

  // Create secure cookie options
  getCookieOptions(isProduction = false) {
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    };
  }

  // Generate CSRF token
  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Verify CSRF token
  verifyCSRFToken(token, storedToken) {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(storedToken));
  }

  // Extract user ID from request
  getUserIdFromRequest(req) {
    const token = this.extractTokenFromRequest(req);
    if (!token) return null;

    try {
      const decoded = this.verifyToken(token);
      return decoded.userId || decoded.sub;
    } catch (error) {
      return null;
    }
  }

  // Extract token from request
  extractTokenFromRequest(req) {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookies
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }

    return null;
  }

  // Middleware for protecting routes
  requireAuth(req, res, next) {
    try {
      const token = this.extractTokenFromRequest(req);
      
      if (!token) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'NO_TOKEN'
        });
      }

      const decoded = this.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }
  }

  // Middleware for optional auth
  optionalAuth(req, res, next) {
    try {
      const token = this.extractTokenFromRequest(req);
      
      if (token) {
        const decoded = this.verifyToken(token);
        req.user = decoded;
      }
      
      next();
    } catch (error) {
      // Invalid token, but continue without user
      req.user = null;
      next();
    }
  }

  // Create authentication response
  createAuthResponse(user, includeRefreshToken = true) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role || 'user',
      plan: user.plan || 'free'
    };

    const token = this.generateToken(payload);
    const refreshToken = includeRefreshToken ? this.generateRefreshToken() : null;

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        role: user.role || 'user',
        plan: user.plan || 'free',
        credits: user.credits || 0
      },
      token,
      refreshToken,
      expiresIn: JWT_EXPIRES_IN
    };
  }

  // Clean expired rate limit entries
  cleanupRateLimit() {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }
}

// Create singleton instance
export const authService = new AuthService();

// Cleanup rate limit store every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    authService.cleanupRateLimit();
  }, 60 * 60 * 1000);
}

// Export individual functions for convenience
export const {
  generateToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword,
  validatePassword,
  generateSessionId,
  checkRateLimit,
  getCookieOptions,
  generateCSRFToken,
  verifyCSRFToken,
  getUserIdFromRequest,
  extractTokenFromRequest,
  requireAuth,
  optionalAuth,
  createAuthResponse
} = authService;

// Export for browser (limited functionality)
if (typeof window !== 'undefined') {
  window.synthexAuth = {
    validatePassword: authService.validatePassword.bind(authService),
    generateCSRFToken: authService.generateCSRFToken.bind(authService)
  };
}