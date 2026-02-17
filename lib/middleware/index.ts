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

// Rate Limiter (consolidated module)
export {
  RateLimiter,
  createRateLimiter,
  withRateLimit,
  UsageTracker,
  authStrict,
  authGeneral,
  admin,
  billing,
  aiGeneration,
  mutation,
  readDefault,
  PRESET_CONFIG,
  rateLimiters,
  getRateLimitStatus,
  resetRateLimits,
  getGlobalRateLimitStats,
  isRedisAvailable,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitHeaders,
  type RateLimitStatus,
  type SubscriptionTier,
  type TierLimits,
  type CategoryPreset,
} from '@/lib/rate-limit';

// Re-export stub types from api-middleware for backward compatibility
export { type RateLimitMiddlewareOptions } from './api-middleware';

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
