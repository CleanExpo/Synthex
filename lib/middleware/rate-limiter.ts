/**
 * Rate Limiting Middleware for API Protection
 *
 * @deprecated Import from '@/lib/rate-limit' instead.
 * This file re-exports from the consolidated rate-limit module for backward compatibility.
 *
 * Usage:
 *   import { RateLimiter, withRateLimit } from '@/lib/rate-limit';
 */

export {
  RateLimiter,
  createRateLimiter,
  withRateLimit,
  UsageTracker,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitHeaders,
} from '@/lib/rate-limit';
