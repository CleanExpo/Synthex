/**
 * API SECURITY CHECKER
 * 
 * ⚠️ CRITICAL SECURITY MODULE
 * This module MUST be used for EVERY API endpoint to ensure:
 * 1. Proper authentication and authorization
 * 2. Input validation and sanitization
 * 3. Rate limiting and abuse prevention
 * 4. Secure headers and CORS
 * 5. Audit logging
 * 
 * FAILURE TO USE THIS MODULE WILL RESULT IN SECURITY VULNERABILITIES
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { envValidator } from './env-validator';

// ============================================
// INTERNAL TYPES
// ============================================

/** Audit log entry structure */
interface AuditLogEntry {
  requestId: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  method: string;
  path: string;
  userId?: string;
  userRole?: string;
  isAuthenticated: boolean;
  result: string;
  error: string | null;
}

/** JWT payload structure */
interface JwtPayload {
  userId?: string;
  sub?: string;
  role?: string;
  exp?: number;
  iat?: number;
}

/** Extended request with security context */
export interface SecuredRequest extends NextRequest {
  securityContext?: SecurityContext;
}

// ============================================
// SECURITY POLICIES
// ============================================
export interface SecurityPolicy {
  requireAuth: boolean;
  allowedRoles?: string[];
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  cors?: {
    allowedOrigins: string[];
    allowedMethods: string[];
  };
  validateInput?: z.ZodSchema;
  validateOutput?: z.ZodSchema;
  auditLog?: boolean;
  preventCSRF?: boolean;
  requireHTTPS?: boolean;
  maxBodySize?: number; // in bytes
  timeout?: number; // in ms
  allowedIPs?: string[];
  blockedIPs?: string[];
}

// ============================================
// DEFAULT SECURITY POLICIES BY ENDPOINT TYPE
// ============================================
export const DEFAULT_POLICIES = {
  PUBLIC_READ: {
    requireAuth: false,
    rateLimit: { maxRequests: 100, windowMs: 60000 },
    auditLog: false,
    requireHTTPS: true
  } as SecurityPolicy,

  AUTHENTICATED_READ: {
    requireAuth: true,
    rateLimit: { maxRequests: 200, windowMs: 60000 },
    auditLog: true,
    requireHTTPS: true
  } as SecurityPolicy,

  AUTHENTICATED_WRITE: {
    requireAuth: true,
    rateLimit: { maxRequests: 50, windowMs: 60000 },
    auditLog: true,
    preventCSRF: true,
    requireHTTPS: true,
    maxBodySize: 1048576 // 1MB
  } as SecurityPolicy,

  ADMIN_ONLY: {
    requireAuth: true,
    allowedRoles: ['admin'],
    rateLimit: { maxRequests: 100, windowMs: 60000 },
    auditLog: true,
    preventCSRF: true,
    requireHTTPS: true
  } as SecurityPolicy,

  WEBHOOK: {
    requireAuth: false, // Uses signature validation instead
    rateLimit: { maxRequests: 1000, windowMs: 60000 },
    auditLog: true,
    requireHTTPS: true,
    maxBodySize: 5242880 // 5MB
  } as SecurityPolicy,

  INTERNAL_ONLY: {
    requireAuth: false,
    allowedIPs: ['127.0.0.1', '::1'], // localhost only
    auditLog: true,
    requireHTTPS: false
  } as SecurityPolicy
};

// ============================================
// SECURITY CONTEXT
// ============================================
export interface SecurityContext {
  requestId: string;
  timestamp: number;
  ip: string;
  userAgent: string;
  method: string;
  path: string;
  userId?: string;
  userRole?: string;
  isAuthenticated: boolean;
}

// ============================================
// RATE LIMITER
// ============================================
// NOTE: This is a per-instance in-memory rate limiter. On Vercel serverless,
// each function invocation may run in a different instance, so rate limiting
// is best-effort per warm instance. For production-grade distributed rate
// limiting, upgrade to Redis (Vercel KV) or an edge-level WAF.
class RateLimiter {
  private static attempts = new Map<string, number[]>();
  // Cap map size to prevent memory leaks in long-lived warm instances
  private static readonly MAX_ENTRIES = 10000;

  static check(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const attempts = this.attempts.get(identifier) || [];

    // Clean old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < windowMs);
    const resetAt = validAttempts.length > 0
      ? validAttempts[0] + windowMs
      : now + windowMs;

    if (validAttempts.length >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }

    validAttempts.push(now);
    this.attempts.set(identifier, validAttempts);

    // Evict oldest entries if map is too large (prevents memory bloat)
    if (this.attempts.size > this.MAX_ENTRIES) {
      this.evictOldest();
    }

    return {
      allowed: true,
      remaining: maxRequests - validAttempts.length,
      resetAt,
    };
  }

  private static evictOldest() {
    const now = Date.now();
    // Delete entries with no recent attempts first
    for (const [key, attempts] of this.attempts.entries()) {
      if (this.attempts.size <= this.MAX_ENTRIES * 0.8) break;
      const recent = attempts.filter(time => now - time < 300000); // 5 min
      if (recent.length === 0) {
        this.attempts.delete(key);
      }
    }
  }
}

// ============================================
// MAIN SECURITY CHECKER CLASS
// ============================================
export class APISecurityChecker {
  private static auditLog: AuditLogEntry[] = [];

  /**
   * Main security check function - MUST be called for every API endpoint
   */
  static async check(
    request: NextRequest,
    policy: SecurityPolicy = DEFAULT_POLICIES.AUTHENTICATED_READ
  ): Promise<{ allowed: boolean; context: SecurityContext; error?: string }> {
    const context = this.buildSecurityContext(request);

    try {
      // 1. HTTPS Check (skip in development — localhost doesn't use HTTPS)
      if (policy.requireHTTPS && process.env.NODE_ENV === 'production' && !this.isHTTPS(request)) {
        throw new SecurityError('HTTPS required', 'HTTPS_REQUIRED');
      }

      // 2. IP Filtering
      if (!this.checkIPFilter(context.ip, policy)) {
        throw new SecurityError('IP not allowed', 'IP_BLOCKED');
      }

      // 3. Rate Limiting
      if (policy.rateLimit) {
        const rateLimitResult = this.checkRateLimit(context, policy.rateLimit);
        // Attach rate limit info to context for response headers
        (context as SecurityContext & { rateLimit?: { remaining: number; resetAt: number; limit: number } }).rateLimit = {
          remaining: rateLimitResult.remaining,
          resetAt: rateLimitResult.resetAt,
          limit: policy.rateLimit.maxRequests,
        };
        if (!rateLimitResult.allowed) {
          throw new SecurityError('Rate limit exceeded', 'RATE_LIMIT');
        }
      }

      // 4. Authentication
      if (policy.requireAuth) {
        const authResult = await this.checkAuthentication(request, context);
        if (!authResult.isValid) {
          throw new SecurityError(authResult.error || 'Authentication required', 'AUTH_REQUIRED');
        }
        context.userId = authResult.userId;
        context.userRole = authResult.userRole;
        context.isAuthenticated = true;
      }

      // 5. Authorization
      if (policy.allowedRoles && !this.checkAuthorization(context.userRole, policy.allowedRoles)) {
        throw new SecurityError('Insufficient permissions', 'FORBIDDEN');
      }

      // 6. CSRF Protection
      if (policy.preventCSRF && !this.checkCSRF(request)) {
        throw new SecurityError('CSRF token invalid', 'CSRF_INVALID');
      }

      // 7. Body Size Check
      if (policy.maxBodySize && request.body) {
        const size = await this.getBodySize(request);
        if (size > policy.maxBodySize) {
          throw new SecurityError('Request body too large', 'BODY_TOO_LARGE');
        }
      }

      // 8. Audit Logging
      if (policy.auditLog) {
        this.logAudit(context, 'ALLOWED', null);
      }

      return { allowed: true, context };

    } catch (error) {
      // Log security violations
      if (policy.auditLog) {
        this.logAudit(context, 'DENIED', error);
      }

      return {
        allowed: false,
        context,
        error: error instanceof SecurityError ? error.message : 'Security check failed'
      };
    }
  }

  /**
   * Validates request input against schema
   */
  static validateInput<T>(data: unknown, schema: z.ZodSchema<T>): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid input', error.errors);
      }
      throw error;
    }
  }

  /**
   * Sanitizes output before sending to client
   */
  static sanitizeOutput<T>(data: T, schema?: z.ZodSchema<T>): T {
    // Remove any sensitive fields
    const sanitized = this.removeSensitiveFields(data);
    
    // Validate against schema if provided
    if (schema) {
      try {
        return schema.parse(sanitized);
      } catch (error) {
        throw new ValidationError('Invalid output format', []);
      }
    }
    
    return sanitized as T;
  }

  /**
   * Creates secure API response with proper headers
   */
  static createSecureResponse<T>(
    data: T,
    status: number = 200,
    context?: SecurityContext
  ): NextResponse {
    const response = NextResponse.json(data, { status });

    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    if (context) {
      response.headers.set('X-Request-ID', context.requestId);

      // Rate limit headers (standard draft RFC 6585 / RateLimit fields)
      const rl = (context as SecurityContext & { rateLimit?: { remaining: number; resetAt: number; limit: number } }).rateLimit;
      if (rl) {
        response.headers.set('X-RateLimit-Limit', String(rl.limit));
        response.headers.set('X-RateLimit-Remaining', String(rl.remaining));
        response.headers.set('X-RateLimit-Reset', String(Math.ceil(rl.resetAt / 1000)));
      }
    }

    // Cache control for sensitive data
    if (status === 200) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }

    return response;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private static buildSecurityContext(request: NextRequest): SecurityContext {
    return {
      requestId: crypto.randomUUID(),
      timestamp: Date.now(),
      ip: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      method: request.method,
      path: request.nextUrl.pathname,
      isAuthenticated: false
    };
  }

  private static getClientIP(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
           request.headers.get('x-real-ip') ||
           'unknown';
  }

  private static isHTTPS(request: NextRequest): boolean {
    const proto = request.headers.get('x-forwarded-proto');
    return proto === 'https' || request.nextUrl.protocol === 'https:';
  }

  private static checkIPFilter(ip: string, policy: SecurityPolicy): boolean {
    if (policy.blockedIPs?.includes(ip)) {
      return false;
    }
    if (policy.allowedIPs && !policy.allowedIPs.includes(ip)) {
      return false;
    }
    return true;
  }

  private static checkRateLimit(
    context: SecurityContext,
    rateLimit: { maxRequests: number; windowMs: number }
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const identifier = context.userId || context.ip;
    return RateLimiter.check(identifier, rateLimit.maxRequests, rateLimit.windowMs);
  }

  private static async checkAuthentication(
    request: NextRequest,
    context: SecurityContext
  ): Promise<{ isValid: boolean; userId?: string; userRole?: string; error?: string }> {
    try {
      // Check Authorization header OR auth-token cookie
      const authHeader = request.headers.get('authorization');
      const cookieToken = request.cookies.get('auth-token')?.value;

      let token: string | null = null;

      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (cookieToken) {
        token = cookieToken;
      }

      if (!token) {
        return { isValid: false, error: 'No bearer token provided' };
      }

      const jwtSecret = envValidator.get('JWT_SECRET');

      // Verify JWT
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      // Check expiration
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        return { isValid: false, error: 'Token expired' };
      }

      return {
        isValid: true,
        userId: decoded.userId || decoded.sub,
        userRole: decoded.role || 'user'
      };

    } catch (error) {
      return { isValid: false, error: 'Invalid token' };
    }
  }

  private static checkAuthorization(userRole?: string, allowedRoles?: string[]): boolean {
    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }
    if (!userRole) {
      return false;
    }
    return allowedRoles.includes(userRole);
  }

  private static checkCSRF(request: NextRequest): boolean {
    // CSRF protection is only needed for cookie-based browser sessions.
    // API clients using Authorization: Bearer tokens are inherently safe from
    // CSRF because browsers don't auto-send Bearer headers on cross-origin requests.
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return true; // Bearer token auth — CSRF not applicable
    }

    // For cookie-based auth, validate the double-submit CSRF token
    const csrfToken = request.headers.get('x-csrf-token');
    const cookieToken = request.cookies.get('csrf-token')?.value;

    if (!csrfToken || !cookieToken) {
      return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    if (csrfToken.length !== cookieToken.length) {
      return false;
    }
    try {
      return crypto.timingSafeEqual(
        Buffer.from(csrfToken),
        Buffer.from(cookieToken)
      );
    } catch {
      return false;
    }
  }

  private static async getBodySize(request: NextRequest): Promise<number> {
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
    
    // Estimate from body if content-length not available
    try {
      const body = await request.text();
      return new Blob([body]).size;
    } catch {
      return 0;
    }
  }

  private static removeSensitiveFields<T>(data: T): T {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password', 'token', 'secret', 'apiKey', 'api_key',
      'authorization', 'cookie', 'session', 'salt', 'hash',
      'creditCard', 'credit_card', 'cvv', 'ssn'
    ];

    const cleaned = Array.isArray(data) ? [...data] : { ...data };

    for (const key in cleaned) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        if (Array.isArray(cleaned)) {
          // Don't modify arrays directly
        } else {
          (cleaned as Record<string, unknown>)[key] = '[REDACTED]';
        }
      } else if (typeof (cleaned as Record<string, unknown>)[key] === 'object') {
        (cleaned as Record<string, unknown>)[key] = this.removeSensitiveFields((cleaned as Record<string, unknown>)[key]);
      }
    }

    return cleaned as T;
  }

  private static logAudit(context: SecurityContext, result: string, error: unknown) {
    const entry: AuditLogEntry = {
      ...context,
      result,
      error: error instanceof Error ? error.message : error ? String(error) : null,
      timestamp: new Date().toISOString()
    };

    this.auditLog.push(entry);

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }

    // In production, send to logging service
    if (process.env.NODE_ENV === 'production') {
      console.log('AUDIT:', JSON.stringify(entry));
    }
  }

  /**
   * Get audit log entries
   */
  static getAuditLog(filter?: { userId?: string; result?: string }): AuditLogEntry[] {
    if (!filter) {
      return [...this.auditLog];
    }

    return this.auditLog.filter(entry => {
      if (filter.userId && entry.userId !== filter.userId) return false;
      if (filter.result && entry.result !== filter.result) return false;
      return true;
    });
  }
}

// ============================================
// CUSTOM ERROR CLASSES
// ============================================
class SecurityError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

class ValidationError extends Error {
  errors: z.ZodIssue[];

  constructor(message: string, errors: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// ============================================
// WEBHOOK SIGNATURE VALIDATION
// ============================================
export class WebhookValidator {
  /**
   * Validates Stripe webhook signature
   */
  static validateStripe(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const elements = signature.split(',');
      let timestamp = '';
      let signatures: string[] = [];

      for (const element of elements) {
        const [key, value] = element.split('=');
        if (key === 't') {
          timestamp = value;
        } else if (key === 'v1') {
          signatures.push(value);
        }
      }

      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      return signatures.includes(expectedSignature);
    } catch {
      return false;
    }
  }

  /**
   * Validates GitHub webhook signature
   */
  static validateGitHub(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }
}

// ============================================
// EXPORT SECURITY MIDDLEWARE
// ============================================
export function createSecurityMiddleware(policy: SecurityPolicy) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const result = await APISecurityChecker.check(request, policy);

    if (!result.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: result.error },
        403,
        result.context
      );
    }

    // Attach context to request for use in handler
    (request as SecuredRequest).securityContext = result.context;

    return null; // Continue to handler
  };
}