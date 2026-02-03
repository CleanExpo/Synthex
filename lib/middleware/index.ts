/**
 * Middleware Module
 *
 * @description Unified exports for all middleware:
 * - Rate limiting (v2 with sliding window)
 * - API middleware (auth, CORS, logging)
 * - Request context management
 *
 * USAGE:
 * ```typescript
 * import {
 *   withRateLimit,
 *   withAuthenticatedAPI,
 *   withAIAPI,
 * } from '@/lib/middleware';
 *
 * // Simple rate limiting
 * export const GET = withRateLimit(handler, { type: 'minute' });
 *
 * // Full API middleware
 * export const POST = withAuthenticatedAPI(async (req, ctx, reqCtx) => {
 *   console.log(reqCtx.userId); // Available from middleware
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */

// Rate Limiter v2
export {
  withRateLimit,
  checkRateLimits,
  checkBurstLimit,
  getIdentifier,
  getTenantPlan,
  addRateLimitHeaders,
  createRateLimitResponse,
  SlidingWindowRateLimiter,
  rateLimiter,
  RATE_LIMIT_TIERS,
  type RateLimitConfig,
  type RateLimitResult,
  type TieredLimits,
  type RateLimitTier,
  type RateLimitMiddlewareOptions,
} from './rate-limiter-v2';

// API Middleware
export {
  withAPIMiddleware,
  withPublicAPI,
  withAuthenticatedAPI,
  withAIAPI,
  withExportAPI,
  withAdminAPI,
  generateRequestId,
  extractUserId,
  addCORSHeaders,
  createErrorResponse,
  type APIMiddlewareOptions,
  type ValidationResult,
  type CORSOptions,
  type RequestContext,
  type RouteHandler,
  type ContextualRouteHandler,
} from './api-middleware';
