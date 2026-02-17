/**
 * Pre-configured rate limit wrappers by route sensitivity category.
 *
 * Uses the canonical rate limiter (lib/middleware/rate-limiter.ts) which is
 * backed by Upstash Redis in production and falls back to in-memory in dev.
 *
 * Usage:
 *   import { authStrict } from '@/lib/middleware/api-rate-limit';
 *   export async function POST(req: NextRequest) {
 *     return authStrict(req, async () => { ... });
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from '@/lib/middleware/rate-limiter';

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
// Category wrappers
// ---------------------------------------------------------------------------

/** Login, signup, password reset — brute force protection (5 req/min) */
export const authStrict = createCategoryLimiter('auth-strict', 60_000, 5);

/** Token refresh, verify — moderate protection (15 req/min) */
export const authGeneral = createCategoryLimiter('auth-general', 60_000, 15);

/** Admin operations (30 req/min) */
export const admin = createCategoryLimiter('admin', 60_000, 30);

/** Checkout, subscription changes (20 req/min) */
export const billing = createCategoryLimiter('billing', 60_000, 20);

/**
 * AI generation — tier-based limits.
 * For routes that need per-tier limits, use withRateLimit from rate-limiter.ts
 * directly (it resolves the user's subscription tier). This wrapper applies
 * a flat limit suitable for AI-adjacent endpoints that don't need tier logic.
 * Free=5, Pro=20, Business=100 — use withRateLimit for full tier resolution.
 */
export const aiGeneration = createCategoryLimiter('ai-generation', 60_000, 20);

/** POST/PUT/DELETE on user data (60 req/min) */
export const mutation = createCategoryLimiter('mutation', 60_000, 60);

/** GET endpoints (120 req/min) */
export const readDefault = createCategoryLimiter('read-default', 60_000, 120);
