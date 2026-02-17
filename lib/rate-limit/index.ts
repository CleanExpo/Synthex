/**
 * Unified Rate Limiting Module
 *
 * Consolidated rate limiting with Upstash Redis + in-memory fallback.
 *
 * Usage:
 *
 *   // Category-based presets (recommended for most routes)
 *   import { authStrict, readDefault } from '@/lib/rate-limit';
 *
 *   export async function POST(req: NextRequest) {
 *     return authStrict(req, async () => {
 *       // handler logic
 *     });
 *   }
 *
 *   // Tier-based rate limiting (for endpoints with subscription tiers)
 *   import { withRateLimit } from '@/lib/rate-limit';
 *
 *   export async function POST(req: NextRequest) {
 *     return withRateLimit(req, async () => {
 *       // handler logic - rate limit based on user's subscription tier
 *     });
 *   }
 *
 *   // Custom rate limiter
 *   import { RateLimiter } from '@/lib/rate-limit';
 *
 *   const limiter = new RateLimiter({
 *     windowMs: 60_000,
 *     maxRequests: 10,
 *   });
 *
 * Category Presets:
 *   - authStrict: 5 req/min (login, signup, password reset)
 *   - authGeneral: 15 req/min (token refresh, verify)
 *   - admin: 30 req/min (admin operations)
 *   - billing: 20 req/min (checkout, subscription changes)
 *   - aiGeneration: 20 req/min (AI endpoints without tier logic)
 *   - mutation: 60 req/min (POST/PUT/DELETE on user data)
 *   - readDefault: 120 req/min (GET endpoints)
 */

// Core rate limiter
export {
  RateLimiter,
  createRateLimiter,
  withRateLimit,
} from './rate-limiter';

// Category presets
export {
  authStrict,
  authGeneral,
  admin,
  billing,
  aiGeneration,
  mutation,
  readDefault,
  PRESET_CONFIG,
} from './presets';

// Admin utilities
export {
  getRateLimitStatus,
  resetRateLimits,
  getGlobalRateLimitStats,
  isRedisAvailable,
} from './utils';

// Types
export type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitHeaders,
  RateLimitStatus,
  SubscriptionTier,
  TierLimits,
  CategoryPreset,
} from './types';
