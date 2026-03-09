/**
 * Rate Limiting Type Definitions
 *
 * Shared types for the unified rate-limit module.
 */

import { NextRequest } from 'next/server';

/**
 * Configuration for creating a rate limiter instance.
 */
export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Custom identifier function (defaults to IP/auth-based) */
  identifier?: (req: NextRequest) => string;
}

/**
 * Subscription tier names for tier-based rate limiting.
 * New names: pro / growth / scale. Old names kept for backward compat.
 */
export type SubscriptionTier = 'free' | 'pro' | 'growth' | 'scale' | 'professional' | 'business' | 'custom';

/**
 * Rate limits per subscription tier.
 */
export type TierLimits = Record<SubscriptionTier, number>;

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in this window */
  remaining: number;
  /** Timestamp when the window resets */
  resetTime: number;
}

/**
 * Rate limit status for a user (used by admin utilities).
 */
export interface RateLimitStatus {
  limits: Record<string, number>;
  usage: Record<string, number>;
  resets: Record<string, string>;
}

/**
 * Category preset configuration.
 */
export interface CategoryPreset {
  /** Category identifier (used in cache keys) */
  category: string;
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
}

/**
 * Standard rate limit headers.
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
}
