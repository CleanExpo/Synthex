/**
 * Rate Limiting Utilities
 *
 * Administrative functions for managing rate limits.
 */

import { logger } from '@/lib/logger';
import type { RateLimitStatus } from './types';

// ---------------------------------------------------------------------------
// Redis client for admin operations
// ---------------------------------------------------------------------------

const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN;

async function redisCommand(command: string[]): Promise<unknown> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    logger.warn('Redis not configured for rate limit utilities');
    return null;
  }

  try {
    const res = await fetch(`${UPSTASH_URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!res.ok) {
      logger.warn('Redis command failed', { status: res.status, command: command[0] });
      return null;
    }

    const data = await res.json();
    return data.result;
  } catch (error) {
    logger.error('Redis command error', { error, command: command[0] });
    return null;
  }
}

async function redisScan(pattern: string): Promise<string[]> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return [];

  const keys: string[] = [];
  let cursor = '0';

  try {
    do {
      const res = await fetch(`${UPSTASH_URL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['SCAN', cursor, 'MATCH', pattern, 'COUNT', '100']),
      });

      if (!res.ok) break;

      const data = await res.json();
      cursor = data.result[0];
      keys.push(...data.result[1]);
    } while (cursor !== '0');
  } catch (error) {
    logger.error('Redis SCAN error', { error, pattern });
  }

  return keys;
}

// ---------------------------------------------------------------------------
// Admin utilities
// ---------------------------------------------------------------------------

/**
 * Get rate limit status for a user across all windows.
 */
export async function getRateLimitStatus(userId: string): Promise<RateLimitStatus> {
  const now = Date.now();
  const windows = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
  };

  const limits: Record<string, number> = {
    minute: 100,
    hour: 6000,
    day: 144000,
  };

  const usage: Record<string, number> = {};
  const resets: Record<string, string> = {};

  for (const [period, windowMs] of Object.entries(windows)) {
    const window = Math.floor(now / windowMs);
    const resetTime = (window + 1) * windowMs;

    // Try to get count from Redis
    const key = `rl:user:${userId}:${period}:${window}`;
    const count = await redisCommand(['GET', key]);

    usage[period] = typeof count === 'string' ? parseInt(count, 10) : 0;
    resets[period] = new Date(resetTime).toISOString();
  }

  return { limits, usage, resets };
}

/**
 * Reset rate limits for a user (admin only).
 * Deletes all rate limit keys for the specified user.
 */
export async function resetRateLimits(userId: string): Promise<boolean> {
  const patterns = [
    `rl:user:${userId}:*`,
    `rl:ip:*`, // Note: IP-based limits can't be reset per-user
  ];

  let deleted = 0;

  for (const pattern of patterns) {
    if (pattern.includes(userId)) {
      const keys = await redisScan(pattern);
      for (const key of keys) {
        await redisCommand(['DEL', key]);
        deleted++;
      }
    }
  }

  logger.info(`Reset rate limits for user ${userId}`, { keysDeleted: deleted });
  return deleted > 0;
}

/**
 * Get current rate limit usage across all users (admin dashboard).
 */
export async function getGlobalRateLimitStats(): Promise<{
  totalKeys: number;
  topUsers: Array<{ userId: string; count: number }>;
}> {
  const keys = await redisScan('rl:user:*');
  const userCounts = new Map<string, number>();

  for (const key of keys) {
    // Parse user ID from key: rl:user:{userId}:{period}:{window}
    const match = key.match(/^rl:user:([^:]+):/);
    if (match) {
      const userId = match[1];
      const count = await redisCommand(['GET', key]);
      const current = userCounts.get(userId) || 0;
      userCounts.set(userId, current + (typeof count === 'string' ? parseInt(count, 10) : 0));
    }
  }

  const topUsers = Array.from(userCounts.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalKeys: keys.length,
    topUsers,
  };
}

/**
 * Check if Redis is available for rate limiting.
 */
export async function isRedisAvailable(): Promise<boolean> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return false;

  try {
    const result = await redisCommand(['PING']);
    return result === 'PONG';
  } catch {
    return false;
  }
}
