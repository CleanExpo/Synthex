/**
 * Scalability Module
 * Production-ready utilities for scaling SYNTHEX
 *
 * @task UNI-435 - Scalability & Performance Epic
 *
 * This module provides:
 * - Query batching (DataLoader pattern)
 * - API response caching
 * - Distributed rate limiting
 *
 * @example
 * ```typescript
 * import {
 *   withCache,
 *   invalidateCache,
 *   getRateLimiter,
 *   createLoader,
 * } from '@/lib/scalability';
 * ```
 */

// Query batching
export {
  DataLoader,
  createLoader,
  LoaderContext,
  loaderFactories,
} from './query-batcher';

// API caching
export {
  withCache,
  invalidateCache,
  invalidateCacheKey,
  clearAllCache,
  getCacheStats,
  Cached,
  type CacheOptions,
} from './api-cache';

// Rate limiting
export {
  RedisRateLimiter,
  getRateLimiter,
  withRateLimit,
  checkRateLimit,
  rateLimiterConfigs,
  type RateLimitConfig,
  type RateLimitResult,
} from './redis-rate-limiter';
