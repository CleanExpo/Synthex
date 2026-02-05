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
class RateLimiter {
  private static attempts = new Map<string, number[]>();

  static check(identifier: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(identifier) || [];
    
    // Clean old attempts
    const validAttempts = attempts.filter(time => now - time < windowMs);
    
    if (validAttempts.length >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    validAttempts.push(now);
    this.attempts.set(identifier, validAttempts);
    
    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      this.cleanup();
    }
    
    return true;
  }

  private static cleanup() {
    const now = Date.now();
    for (const [key, attempts] of this.attempts.entries()) {
      const validAttempts = attempts.filter(time => now - time < 3600000); // Keep 1 hour
      if (validAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, validAttempts);
      }
    }
  }
}

// ============================================
// MAIN SECURITY CHECKER CLASS
// ============================================
export class APISecurityChecker {
  private static auditLog: any[] = [];

  /**
   * Main security check function - MUST be called for every API endpoint
   */
  static async check(
    request: NextRequest,
    policy: SecurityPolicy = DEFAULT_POLICIES.AUTHENTICATED_READ
  ): Promise<{ allowed: boolean; context: SecurityContext; error?: string }> {
    const context = this.buildSecurityContext(request);

    try {
      // 1. HTTPS Check
      if (policy.requireHTTPS && !this.isHTTPS(request)) {
        throw new SecurityError('HTTPS required', 'HTTPS_REQUIRED');
      }

      // 2. IP Filtering
      if (!this.checkIPFilter(context.ip, policy)) {
        throw new SecurityError('IP not allowed', 'IP_BLOCKED');
      }

      // 3. Rate Limiting
      if (policy.rateLimit && !this.checkRateLimit(context, policy.rateLimit)) {
        throw new SecurityError('Rate limit exceeded', 'RATE_LIMIT');
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
        error: error instanceof SecurityError ? error instanceof Error ? error.message : String(error) : 'Security check failed'
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
  static createSecureResponse(
    data: any,
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
  ): boolean {
    const identifier = context.userId || context.ip;
    return RateLimiter.check(identifier, rateLimit.maxRequests, rateLimit.windowMs);
  }

  private static async checkAuthentication(
    request: NextRequest,
    context: SecurityContext
  ): Promise<{ isValid: boolean; userId?: string; userRole?: string; error?: string }> {
    try {
      // Check Authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return { isValid: false, error: 'No bearer token provided' };
      }

      const token = authHeader.substring(7);
      const jwtSecret = envValidator.get('JWT_SECRET');

      // Verify JWT
      const decoded = jwt.verify(token, jwtSecret) as any;
      
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
    const csrfToken = request.headers.get('x-csrf-token');
    const cookieToken = request.cookies.get('csrf-token')?.value;
    
    if (!csrfToken || !cookieToken) {
      return false;
    }
    
    return csrfToken === cookieToken;
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

  private static removeSensitiveFields(data: any): any {
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
          cleaned[key] = '[REDACTED]';
        }
      } else if (typeof cleaned[key] === 'object') {
        cleaned[key] = this.removeSensitiveFields(cleaned[key]);
      }
    }

    return cleaned;
  }

  private static logAudit(context: SecurityContext, result: string, error: any) {
    const entry = {
      ...context,
      result,
      error: error?.message || null,
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
  static getAuditLog(filter?: { userId?: string; result?: string }): any[] {
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
  errors: any[];
  
  constructor(message: string, errors: any[]) {
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
  return async (request: NextRequest) => {
    const result = await APISecurityChecker.check(request, policy);
    
    if (!result.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: result.error },
        403,
        result.context
      );
    }

    // Attach context to request for use in handler
    (request as any).securityContext = result.context;
    
    return null; // Continue to handler
  };
}