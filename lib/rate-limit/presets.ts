/**
 * Category-Based Rate Limit Presets
 *
 * Pre-configured rate limit wrappers by route sensitivity category.
 * Uses the core RateLimiter class with Upstash Redis + in-memory fallback.
 *
 * Usage:
 *   import { authStrict, readDefault } from '@/lib/rate-limit';
 *
 *   export async function POST(req: NextRequest) {
 *     return authStrict(req, async () => { ... });
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from './rate-limiter';

// ---------------------------------------------------------------------------
// Helper: create a rate-limited wrapper with fixed window and max requests
// ---------------------------------------------------------------------------

function createCategoryLimiter(
  category: string,
  windowMs: number,
  maxRequests: number
) {
  return async function rateLimitedHandler(
    req: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const limiter = new RateLimiter({
      windowMs,
      maxRequests,
      identifier: (r: NextRequest) => {
        // Use IP + category as key so limits are per-category
        const ip =
          r.headers.get('x-forwarded-for') ||
          r.headers.get('x-real-ip') ||
          'unknown';
        return `${category}:${ip}`;
      },
    });

    const result = await limiter.check(req);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: new Date(result.resetTime).toISOString(),
        },
        {
          status: 429,
          headers: {
            ...RateLimiter.createHeaders(result),
            'Retry-After': Math.ceil(
              (result.resetTime - Date.now()) / 1000
            ).toString(),
          },
        }
      );
    }

    const response = await handler();

    // Attach rate-limit headers to successful responses
    const headers = RateLimiter.createHeaders(result);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

// ---------------------------------------------------------------------------
// Category Presets
// ---------------------------------------------------------------------------

/**
 * Login, signup, password reset — brute force protection.
 * 5 requests per minute.
 */
export const authStrict = createCategoryLimiter('auth-strict', 60_000, 5);

/**
 * Token refresh, verify — moderate protection.
 * 15 requests per minute.
 */
export const authGeneral = createCategoryLimiter('auth-general', 60_000, 15);

/**
 * Admin operations.
 * 30 requests per minute.
 */
export const admin = createCategoryLimiter('admin', 60_000, 30);

/**
 * Checkout, subscription changes.
 * 20 requests per minute.
 */
export const billing = createCategoryLimiter('billing', 60_000, 20);

/**
 * AI generation — tier-based limits.
 * For routes that need per-tier limits, use withRateLimit from rate-limiter
 * directly (it resolves the user's subscription tier). This wrapper applies
 * a flat limit suitable for AI-adjacent endpoints that don't need tier logic.
 * 20 requests per minute.
 */
export const aiGeneration = createCategoryLimiter('ai-generation', 60_000, 20);

/**
 * POST/PUT/DELETE on user data.
 * 60 requests per minute.
 */
export const mutation = createCategoryLimiter('mutation', 60_000, 60);

/**
 * GET endpoints.
 * 120 requests per minute.
 */
export const readDefault = createCategoryLimiter('read-default', 60_000, 120);

// ---------------------------------------------------------------------------
// Preset configuration export (for documentation/tooling)
// ---------------------------------------------------------------------------

export const PRESET_CONFIG = {
  authStrict: { category: 'auth-strict', windowMs: 60_000, maxRequests: 5 },
  authGeneral: { category: 'auth-general', windowMs: 60_000, maxRequests: 15 },
  admin: { category: 'admin', windowMs: 60_000, maxRequests: 30 },
  billing: { category: 'billing', windowMs: 60_000, maxRequests: 20 },
  aiGeneration: { category: 'ai-generation', windowMs: 60_000, maxRequests: 20 },
  mutation: { category: 'mutation', windowMs: 60_000, maxRequests: 60 },
  readDefault: { category: 'read-default', windowMs: 60_000, maxRequests: 120 },
} as const;
