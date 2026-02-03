/**
 * Cache Invalidation Strategy
 *
 * @description Provides intelligent cache invalidation patterns:
 * - Tag-based invalidation for related data
 * - Pattern-based invalidation with wildcards
 * - Event-driven invalidation hooks
 * - Time-based expiration policies
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: Redis connection string (SECRET)
 *
 * FAILURE MODE: Logs errors and continues without invalidation
 */

import { getCache, CacheManager } from './cache-manager';
import { getRedisClient } from '../redis-client';
import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export interface InvalidationRule {
  trigger: string;
  patterns: string[];
  tags?: string[];
  delay?: number;
}

export interface InvalidationEvent {
  type: string;
  entityId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export type InvalidationHandler = (event: InvalidationEvent) => Promise<void>;

// ============================================================================
// INVALIDATION RULES
// ============================================================================

/**
 * Pre-configured invalidation rules for common operations
 */
export const INVALIDATION_RULES: Record<string, InvalidationRule> = {
  // User updates invalidate user-related caches
  'user:update': {
    trigger: 'user:update',
    patterns: ['user:*', 'profile:*'],
    tags: ['user'],
  },

  // Post updates invalidate post and feed caches
  'post:create': {
    trigger: 'post:create',
    patterns: ['posts:*', 'feed:*'],
    tags: ['posts', 'feed'],
  },
  'post:update': {
    trigger: 'post:update',
    patterns: ['post:*', 'posts:*'],
    tags: ['posts'],
  },
  'post:delete': {
    trigger: 'post:delete',
    patterns: ['post:*', 'posts:*', 'feed:*'],
    tags: ['posts', 'feed'],
  },

  // Campaign updates
  'campaign:update': {
    trigger: 'campaign:update',
    patterns: ['campaign:*', 'campaigns:*'],
    tags: ['campaigns'],
  },

  // Analytics updates
  'analytics:refresh': {
    trigger: 'analytics:refresh',
    patterns: ['analytics:*', 'metrics:*', 'dashboard:*'],
    tags: ['analytics'],
    delay: 1000, // Debounce analytics updates
  },

  // Platform connection changes
  'platform:connect': {
    trigger: 'platform:connect',
    patterns: ['platforms:*', 'connections:*'],
    tags: ['platforms'],
  },
  'platform:disconnect': {
    trigger: 'platform:disconnect',
    patterns: ['platforms:*', 'connections:*', 'analytics:*'],
    tags: ['platforms', 'analytics'],
  },
};

// ============================================================================
// INVALIDATION STRATEGY
// ============================================================================

export class InvalidationStrategy {
  private static handlers: Map<string, InvalidationHandler[]> = new Map();
  private static pendingInvalidations: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Invalidate cache by pattern
   */
  static async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(`synthex:${pattern}`);

      if (keys.length === 0) return 0;

      await redis.del(keys);
      logger.debug('Cache invalidated by pattern', { pattern, count: keys.length });

      return keys.length;
    } catch (error) {
      logger.error('Pattern invalidation failed', { pattern, error });
      return 0;
    }
  }

  /**
   * Invalidate cache by tag
   */
  static async invalidateByTag(tag: string): Promise<number> {
    return getCache().invalidateByTag(tag);
  }

  /**
   * Invalidate cache for a specific entity
   */
  static async invalidateEntity(
    entityType: string,
    entityId: string
  ): Promise<void> {
    const patterns = [
      `${entityType}:${entityId}`,
      `${entityType}:${entityId}:*`,
      `${entityType}s:*`, // Invalidate list caches
    ];

    await Promise.all(patterns.map(p => this.invalidateByPattern(p)));
  }

  /**
   * Apply invalidation rule
   */
  static async applyRule(
    ruleName: string,
    event?: InvalidationEvent
  ): Promise<void> {
    const rule = INVALIDATION_RULES[ruleName];
    if (!rule) {
      logger.warn('Unknown invalidation rule', { ruleName });
      return;
    }

    // Handle debouncing if delay is specified
    if (rule.delay) {
      const pendingKey = `${ruleName}:${event?.entityId || 'all'}`;
      const pending = this.pendingInvalidations.get(pendingKey);

      if (pending) {
        clearTimeout(pending);
      }

      const timeout = setTimeout(async () => {
        await this.executeRule(rule, event);
        this.pendingInvalidations.delete(pendingKey);
      }, rule.delay);

      this.pendingInvalidations.set(pendingKey, timeout);
      return;
    }

    await this.executeRule(rule, event);
  }

  /**
   * Execute invalidation rule
   */
  private static async executeRule(
    rule: InvalidationRule,
    event?: InvalidationEvent
  ): Promise<void> {
    // Invalidate by patterns
    for (const pattern of rule.patterns) {
      // Replace placeholders with actual values
      let resolvedPattern = pattern;
      if (event?.entityId) {
        resolvedPattern = resolvedPattern.replace(':id', `:${event.entityId}`);
      }
      if (event?.userId) {
        resolvedPattern = resolvedPattern.replace(':userId', `:${event.userId}`);
      }

      await this.invalidateByPattern(resolvedPattern);
    }

    // Invalidate by tags
    if (rule.tags) {
      for (const tag of rule.tags) {
        await this.invalidateByTag(tag);
      }
    }

    // Notify handlers
    await this.notifyHandlers(rule.trigger, event);
  }

  /**
   * Register an invalidation handler
   */
  static onInvalidation(trigger: string, handler: InvalidationHandler): void {
    const handlers = this.handlers.get(trigger) || [];
    handlers.push(handler);
    this.handlers.set(trigger, handlers);
  }

  /**
   * Remove an invalidation handler
   */
  static offInvalidation(trigger: string, handler: InvalidationHandler): void {
    const handlers = this.handlers.get(trigger);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Notify all handlers for a trigger
   */
  private static async notifyHandlers(
    trigger: string,
    event?: InvalidationEvent
  ): Promise<void> {
    const handlers = this.handlers.get(trigger);
    if (!handlers || handlers.length === 0) return;

    const eventWithDefaults: InvalidationEvent = {
      type: trigger,
      timestamp: new Date(),
      ...event,
    };

    await Promise.all(
      handlers.map(async handler => {
        try {
          await handler(eventWithDefaults);
        } catch (error) {
          logger.error('Invalidation handler failed', { trigger, error });
        }
      })
    );
  }

  /**
   * Create a scoped invalidator for a specific user
   */
  static forUser(userId: string): UserInvalidator {
    return new UserInvalidator(userId);
  }
}

// ============================================================================
// USER INVALIDATOR
// ============================================================================

class UserInvalidator {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async invalidateAll(): Promise<void> {
    await InvalidationStrategy.invalidateByPattern(`user:${this.userId}:*`);
  }

  async invalidatePosts(): Promise<void> {
    await InvalidationStrategy.invalidateByPattern(`user:${this.userId}:posts:*`);
    await InvalidationStrategy.invalidateByTag(`user:${this.userId}:posts`);
  }

  async invalidateCampaigns(): Promise<void> {
    await InvalidationStrategy.invalidateByPattern(`user:${this.userId}:campaigns:*`);
    await InvalidationStrategy.invalidateByTag(`user:${this.userId}:campaigns`);
  }

  async invalidateAnalytics(): Promise<void> {
    await InvalidationStrategy.invalidateByPattern(`user:${this.userId}:analytics:*`);
    await InvalidationStrategy.invalidateByTag(`user:${this.userId}:analytics`);
  }

  async invalidateDashboard(): Promise<void> {
    await InvalidationStrategy.invalidateByPattern(`user:${this.userId}:dashboard:*`);
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Invalidate cache when data changes
 */
export async function invalidateOnChange(
  operation: 'create' | 'update' | 'delete',
  entityType: string,
  entityId?: string,
  userId?: string
): Promise<void> {
  const ruleName = `${entityType}:${operation}`;
  const event: InvalidationEvent = {
    type: ruleName,
    entityId,
    userId,
    timestamp: new Date(),
  };

  await InvalidationStrategy.applyRule(ruleName, event);
}

/**
 * Create cache key with automatic tagging
 */
export function createCacheKey(
  entityType: string,
  params: Record<string, unknown>,
  userId?: string
): { key: string; tags: string[] } {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${JSON.stringify(params[k])}`)
    .join('&');

  const key = userId
    ? `user:${userId}:${entityType}:${sortedParams}`
    : `${entityType}:${sortedParams}`;

  const tags = [entityType];
  if (userId) {
    tags.push(`user:${userId}`);
    tags.push(`user:${userId}:${entityType}`);
  }

  return { key, tags };
}

// Export default
export default InvalidationStrategy;
