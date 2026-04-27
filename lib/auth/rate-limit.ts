/**
 * Rate-limit wrapper for public HMAC-signed routes.
 *
 * Applies fixed-window counters against two keys — per-organisation and
 * per-IP — so a single signer cannot flood the endpoint and a single IP
 * cannot be abused even when rotating organisations.
 *
 * Backend preference:
 *   1. Upstash Redis (shared across serverless instances) when
 *      UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or REDIS_URL +
 *      REDIS_TOKEN) are configured.
 *   2. In-memory fallback (per-instance; resets on deploy / cold start).
 *      Documented stop-gap for local dev and Redis outages.
 *
 * Scope: SYN-799 — applied only to POST /api/leads. Other public signed
 * routes will be retrofitted in follow-up tickets.
 *
 * @module lib/auth/rate-limit
 * @task SYN-799
 */

import { isIP } from 'net';
import type { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface RateLimitBucketConfig {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitLimits {
  /** Per-organisation bucket — defaults to 60 req/min. */
  org?: RateLimitBucketConfig;
  /** Per-IP bucket — defaults to 120 req/min. */
  ip?: RateLimitBucketConfig;
}

export interface RateLimitOptions {
  /** Unique identifier for the caller's organisation. */
  orgKey: string;
  /** Unique identifier for the caller's source IP. */
  ipKey: string;
  /** Namespace prefix — keeps this route's counters separate from others. */
  namespace: string;
  /** Per-bucket limits. Omitted buckets use their default. */
  limits?: RateLimitLimits;
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the breached window resets. Present when ok === false. */
  retryAfterSeconds?: number;
  /** Which bucket tripped the limit (diagnostic only). */
  breachedBucket?: 'org' | 'ip';
}

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_ORG_LIMIT: RateLimitBucketConfig = {
  limit: 60,
  windowSeconds: 60,
};
const DEFAULT_IP_LIMIT: RateLimitBucketConfig = {
  limit: 120,
  windowSeconds: 60,
};

// ============================================================================
// Backend: Upstash Redis (shared) or in-memory (fallback)
// ============================================================================

let redisClient: Redis | null = null;
let redisInitAttempted = false;

function getRedis(): Redis | null {
  if (redisInitAttempted) return redisClient;
  redisInitAttempted = true;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL || '';
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN || '';

  if (!url || !token) {
    redisClient = null;
    return null;
  }

  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (err) {
    logger.warn('[rate-limit] Upstash client init failed — using in-memory', {
      error: err instanceof Error ? err.message : String(err),
    });
    redisClient = null;
    return null;
  }
}

/** Test-only hook — allows tests to reset the backend between cases. */
export function __resetRateLimitBackendForTests(): void {
  redisClient = null;
  redisInitAttempted = false;
  memoryStore.clear();
}

// ---- In-memory fallback ------------------------------------------------------

interface MemoryBucket {
  count: number;
  /** Absolute ms timestamp when the current window resets. */
  resetAt: number;
}

const memoryStore = new Map<string, MemoryBucket>();

function memoryIncrement(
  key: string,
  windowSeconds: number
): { count: number; resetAt: number } {
  const now = Date.now();
  const existing = memoryStore.get(key);
  if (!existing || now >= existing.resetAt) {
    const fresh: MemoryBucket = {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    };
    memoryStore.set(key, fresh);
    return { count: fresh.count, resetAt: fresh.resetAt };
  }
  existing.count += 1;
  return { count: existing.count, resetAt: existing.resetAt };
}

// ---- Redis increment ---------------------------------------------------------

async function redisIncrement(
  key: string,
  windowSeconds: number
): Promise<{ count: number; resetAt: number } | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    // Fixed-window: key includes the window index, so TTL and bucket align.
    const windowIndex = Math.floor(Date.now() / (windowSeconds * 1000));
    const windowedKey = `${key}:${windowIndex}`;
    const resetAt = (windowIndex + 1) * windowSeconds * 1000;

    const count = await redis.incr(windowedKey);
    if (count === 1) {
      await redis.expire(windowedKey, windowSeconds);
    }
    return { count, resetAt };
  } catch (err) {
    logger.warn('[rate-limit] Redis incr failed — falling back to memory', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check both the per-org and per-IP buckets. Returns `ok: false` with a
 * positive `retryAfterSeconds` the moment either bucket breaches its limit.
 * Never silent-passes a breach.
 */
export async function checkRateLimit(
  _req: NextRequest | null,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const orgCfg = options.limits?.org ?? DEFAULT_ORG_LIMIT;
  const ipCfg = options.limits?.ip ?? DEFAULT_IP_LIMIT;
  const ns = options.namespace;

  const orgBucketKey = `rl:${ns}:org:${options.orgKey}`;
  const ipBucketKey = `rl:${ns}:ip:${options.ipKey}`;

  const orgState =
    (await redisIncrement(orgBucketKey, orgCfg.windowSeconds)) ??
    memoryIncrement(`${orgBucketKey}:mem`, orgCfg.windowSeconds);

  if (orgState.count > orgCfg.limit) {
    return {
      ok: false,
      breachedBucket: 'org',
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((orgState.resetAt - Date.now()) / 1000)
      ),
    };
  }

  const ipState =
    (await redisIncrement(ipBucketKey, ipCfg.windowSeconds)) ??
    memoryIncrement(`${ipBucketKey}:mem`, ipCfg.windowSeconds);

  if (ipState.count > ipCfg.limit) {
    return {
      ok: false,
      breachedBucket: 'ip',
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((ipState.resetAt - Date.now()) / 1000)
      ),
    };
  }

  return { ok: true };
}

// ============================================================================
// Helpers — client IP extraction
// ============================================================================

/**
 * Extract the originating client IP from the request. Walks the usual CDN /
 * proxy headers in order and validates the result with Node's `isIP` so an
 * attacker cannot poison the bucket key by injecting arbitrary strings.
 *
 * Returns `'unknown'` when no valid IP can be found.
 */
export function extractClientIp(req: NextRequest): string {
  const candidates: string[] = [];

  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    // "client, proxy1, proxy2" — take the first entry.
    candidates.push(xff.split(',')[0]?.trim() ?? '');
  }

  for (const header of [
    'x-vercel-forwarded-for',
    'cf-connecting-ip',
    'x-real-ip',
  ]) {
    const value = req.headers.get(header);
    if (value) candidates.push(value.trim());
  }

  for (const raw of candidates) {
    if (!raw) continue;
    // Strip an IPv6 zone identifier (`fe80::1%eth0`) before validation.
    const cleaned = raw.replace(/%.*$/, '');
    if (isIP(cleaned) !== 0) return cleaned;
  }

  return 'unknown';
}
