/**
 * Webhook Retry Manager
 *
 * @description Manages webhook delivery retries with exponential backoff
 *
 * FAILURE MODE: After max retries, events are moved to dead letter queue
 */

import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis-client';
import type { WebhookEvent, WebhookConfig } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface RetryRecord {
  eventId: string;
  attempts: number;
  lastAttempt: Date;
  nextRetry?: Date;
  errors: string[];
}

interface DeadLetterEntry {
  event: WebhookEvent;
  error: string;
  attempts: number;
  errors: string[];
  failedAt: Date;
}

// ============================================================================
// RETRY MANAGER
// ============================================================================

export class RetryManager {
  private config: WebhookConfig;
  private retryRecords: Map<string, RetryRecord> = new Map();
  private deadLetterQueue: DeadLetterEntry[] = [];
  private readonly retryPrefix = 'webhook:retry:';
  private readonly deadLetterPrefix = 'webhook:deadletter:';

  constructor(config?: Partial<WebhookConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? 5,
      retryDelays: config?.retryDelays ?? [1000, 5000, 30000, 120000, 600000],
      timeout: config?.timeout ?? 30000,
      batchSize: config?.batchSize ?? 100,
      concurrency: config?.concurrency ?? 10,
    };
  }

  /**
   * Check if an event should be retried
   */
  shouldRetry(eventId: string): boolean {
    const record = this.retryRecords.get(eventId);
    return !record || record.attempts < this.config.maxRetries;
  }

  /**
   * Get the delay for the next retry attempt
   */
  getRetryDelay(eventId: string): number {
    const record = this.retryRecords.get(eventId);
    const attempts = record?.attempts || 0;

    // Use configured delays or calculate exponential backoff
    if (attempts < this.config.retryDelays.length) {
      return this.config.retryDelays[attempts];
    }

    // Exponential backoff with jitter for attempts beyond configured delays
    const lastDelay = this.config.retryDelays[this.config.retryDelays.length - 1];
    const exponentialDelay = lastDelay * Math.pow(2, attempts - this.config.retryDelays.length);
    const jitter = Math.random() * 1000;

    return Math.min(exponentialDelay + jitter, 3600000); // Max 1 hour
  }

  /**
   * Record a failed attempt
   */
  async recordFailure(eventId: string, error: string): Promise<RetryRecord> {
    let record = this.retryRecords.get(eventId);

    if (!record) {
      record = {
        eventId,
        attempts: 0,
        lastAttempt: new Date(),
        errors: [],
      };
    }

    record.attempts++;
    record.lastAttempt = new Date();
    record.errors.push(error);

    if (record.attempts < this.config.maxRetries) {
      const delay = this.getRetryDelay(eventId);
      record.nextRetry = new Date(Date.now() + delay);
    }

    this.retryRecords.set(eventId, record);

    // Persist to Redis
    try {
      const redis = getRedisClient();
      if (redis.isConnected) {
        await redis.set(`${this.retryPrefix}${eventId}`, JSON.stringify(record), 86400);
      }
    } catch (err) {
      logger.error('Failed to persist retry record', { error: err });
    }

    logger.warn('Webhook delivery failed', {
      eventId,
      attempts: record.attempts,
      maxRetries: this.config.maxRetries,
      nextRetry: record.nextRetry,
      error,
    });

    return record;
  }

  /**
   * Record a successful delivery
   */
  async recordSuccess(eventId: string): Promise<void> {
    this.retryRecords.delete(eventId);

    try {
      const redis = getRedisClient();
      if (redis.isConnected) {
        await redis.del(`${this.retryPrefix}${eventId}`);
      }
    } catch (error) {
      logger.error('Failed to clear retry record', { error });
    }

    logger.info('Webhook delivered successfully', { eventId });
  }

  /**
   * Move event to dead letter queue after max retries
   */
  async moveToDeadLetter(event: WebhookEvent, error: string): Promise<void> {
    const record = this.retryRecords.get(event.id);

    const deadLetterEntry: DeadLetterEntry = {
      event,
      error,
      attempts: record?.attempts || 0,
      errors: record?.errors || [error],
      failedAt: new Date(),
    };

    // Add to memory queue
    this.deadLetterQueue.push(deadLetterEntry);

    try {
      const redis = getRedisClient();
      if (redis.isConnected) {
        // Store with timestamp key for ordering
        const key = `${this.deadLetterPrefix}${Date.now()}:${event.id}`;
        await redis.set(key, JSON.stringify(deadLetterEntry), 604800); // 7 days TTL
        await redis.del(`${this.retryPrefix}${event.id}`);
      }
    } catch (err) {
      logger.error('Failed to move event to dead letter queue', { error: err });
    }

    this.retryRecords.delete(event.id);

    logger.error('Webhook moved to dead letter queue', {
      eventId: event.id,
      type: event.type,
      platform: event.platform,
      attempts: record?.attempts || 0,
      finalError: error,
    });
  }

  /**
   * Get dead letter queue items
   */
  async getDeadLetterItems(limit: number = 100): Promise<DeadLetterEntry[]> {
    try {
      const redis = getRedisClient();
      if (redis.isConnected) {
        const keys = await redis.keys(`${this.deadLetterPrefix}*`);
        if (keys.length === 0) {
          return this.deadLetterQueue.slice(0, limit);
        }

        // Sort by key (timestamp) and limit
        keys.sort().reverse();
        const limitedKeys = keys.slice(0, limit);

        const items: DeadLetterEntry[] = [];
        for (const key of limitedKeys) {
          const data = await redis.get(key);
          if (data) {
            items.push(JSON.parse(data));
          }
        }

        return items;
      }
    } catch (error) {
      logger.error('Failed to get dead letter items', { error });
    }

    return this.deadLetterQueue.slice(0, limit);
  }

  /**
   * Retry a dead letter item
   */
  async retryDeadLetterItem(eventId: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      if (!redis.isConnected) {
        // Memory queue fallback
        const index = this.deadLetterQueue.findIndex((item) => item.event.id === eventId);
        if (index !== -1) {
          this.deadLetterQueue.splice(index, 1);
          return true;
        }
        return false;
      }

      // Find and remove from Redis
      const keys = await redis.keys(`${this.deadLetterPrefix}*${eventId}`);
      if (keys.length === 0) return false;

      await redis.del(keys[0]);

      logger.info('Dead letter item queued for retry', { eventId });
      return true;
    } catch (error) {
      logger.error('Failed to retry dead letter item', { error });
      return false;
    }
  }

  /**
   * Get retry statistics
   */
  async getStats(): Promise<{
    pendingRetries: number;
    deadLetterCount: number;
    byAttempts: Record<number, number>;
  }> {
    const byAttempts: Record<number, number> = {};

    for (const record of this.retryRecords.values()) {
      byAttempts[record.attempts] = (byAttempts[record.attempts] || 0) + 1;
    }

    let deadLetterCount = this.deadLetterQueue.length;
    try {
      const redis = getRedisClient();
      if (redis.isConnected) {
        const keys = await redis.keys(`${this.deadLetterPrefix}*`);
        deadLetterCount = keys.length;
      }
    } catch (error) {
      logger.error('Failed to get dead letter count', { error });
    }

    return {
      pendingRetries: this.retryRecords.size,
      deadLetterCount,
      byAttempts,
    };
  }

  /**
   * Get retry record for an event
   */
  getRetryRecord(eventId: string): RetryRecord | undefined {
    return this.retryRecords.get(eventId);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WebhookConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const retryManager = new RetryManager();
export default RetryManager;
