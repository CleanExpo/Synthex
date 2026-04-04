/**
 * Webhook Event Queue
 *
 * @description In-memory event queue with Redis persistence for simple operations
 *
 * FAILURE MODE: Falls back to in-memory queue if Redis unavailable
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis-client';
import type {
  WebhookEvent,
  WebhookEventType,
  WebhookPlatform,
  QueuedEvent,
} from './types';

// ============================================================================
// EVENT QUEUE
// ============================================================================

export class EventQueue {
  private memoryQueue: QueuedEvent[] = [];
  private processingSet: Set<string> = new Set();
  private readonly queuePrefix = 'webhook:queue:';
  private readonly indexKey = 'webhook:queue:index';

  /**
   * Enqueue a webhook event
   */
  async enqueue(
    type: WebhookEventType,
    platform: WebhookPlatform,
    data: Record<string, unknown>,
    options?: {
      userId?: string;
      organizationId?: string;
      priority?: number;
      delay?: number;
      correlationId?: string;
    }
  ): Promise<string> {
    const eventId = uuidv4();

    const event: WebhookEvent = {
      id: eventId,
      type,
      platform,
      timestamp: new Date(),
      userId: options?.userId,
      organizationId: options?.organizationId,
      data,
      metadata: {
        version: '1.0',
        source: 'synthex',
        correlationId: options?.correlationId || eventId,
        retryCount: 0,
      },
    };

    const queuedEvent: QueuedEvent = {
      event,
      priority: options?.priority || 0,
      queuedAt: new Date(),
      processAfter: options?.delay ? new Date(Date.now() + options.delay) : undefined,
    };

    try {
      const redis = getRedisClient();

      if (redis.isConnected) {
        // Store event with timestamp-based key for ordering
        const score = -queuedEvent.priority * 1000000000000 + (queuedEvent.processAfter?.getTime() || Date.now());
        const key = `${this.queuePrefix}${score}:${eventId}`;
        await redis.set(key, JSON.stringify(queuedEvent), 86400); // 24h TTL
      } else {
        // Fallback to memory queue
        this.memoryQueue.push(queuedEvent);
        this.sortMemoryQueue();
      }

      logger.info('Event enqueued', {
        eventId,
        type,
        platform,
        priority: options?.priority,
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to enqueue event', { error, eventId });

      // Fallback to memory queue
      this.memoryQueue.push(queuedEvent);
      this.sortMemoryQueue();

      return eventId;
    }
  }

  /**
   * Dequeue events for processing
   */
  async dequeue(count: number = 10): Promise<QueuedEvent[]> {
    try {
      const redis = getRedisClient();
      const now = Date.now();

      if (redis.isConnected) {
        // Get all queue keys
        const keys = await redis.keys(`${this.queuePrefix}*`);

        if (keys.length === 0) {
          return this.dequeueFromMemory(count, now);
        }

        // Sort keys and get first N
        keys.sort();
        const toProcess = keys.slice(0, count);

        const events: QueuedEvent[] = [];

        for (const key of toProcess) {
          const data = await redis.get(key);
          if (data) {
            const queuedEvent = JSON.parse(data) as QueuedEvent;

            // Check if ready for processing
            const processAfter = queuedEvent.processAfter ? new Date(queuedEvent.processAfter).getTime() : 0;
            if (processAfter <= now) {
              // Move to processing (delete from queue)
              await redis.del(key);
              this.processingSet.add(queuedEvent.event.id);
              events.push(queuedEvent);
            }
          }
        }

        return events;
      } else {
        return this.dequeueFromMemory(count, now);
      }
    } catch (error) {
      logger.error('Failed to dequeue events', { error });
      return this.dequeueFromMemory(count, Date.now());
    }
  }

  /**
   * Dequeue from memory queue
   */
  private dequeueFromMemory(count: number, now: number): QueuedEvent[] {
    const ready = this.memoryQueue.filter(
      (e) => !e.processAfter || new Date(e.processAfter).getTime() <= now
    );
    const toProcess = ready.slice(0, count);

    // Remove from queue
    this.memoryQueue = this.memoryQueue.filter(
      (e) => !toProcess.includes(e)
    );

    return toProcess;
  }

  /**
   * Mark event as processed
   */
  async acknowledge(event: QueuedEvent): Promise<void> {
    this.processingSet.delete(event.event.id);
    logger.debug('Event acknowledged', { eventId: event.event.id });
  }

  /**
   * Return event to queue for retry
   */
  async requeue(event: QueuedEvent, delay: number): Promise<void> {
    const retryCount = (event.event.metadata?.retryCount || 0) + 1;

    const requeuedEvent: QueuedEvent = {
      ...event,
      event: {
        ...event.event,
        metadata: {
          ...event.event.metadata,
          retryCount,
        },
      },
      processAfter: new Date(Date.now() + delay),
    };

    // Remove from processing
    this.processingSet.delete(event.event.id);

    try {
      const redis = getRedisClient();

      if (redis.isConnected && requeuedEvent.processAfter) {
        const score = -requeuedEvent.priority * 1000000000000 + requeuedEvent.processAfter.getTime();
        const key = `${this.queuePrefix}${score}:${event.event.id}`;
        await redis.set(key, JSON.stringify(requeuedEvent), 86400);
      } else {
        this.memoryQueue.push(requeuedEvent);
        this.sortMemoryQueue();
      }

      logger.info('Event requeued', {
        eventId: event.event.id,
        retryCount,
        delay,
      });
    } catch (error) {
      logger.error('Failed to requeue event', { error, eventId: event.event.id });
      this.memoryQueue.push(requeuedEvent);
      this.sortMemoryQueue();
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    memoryQueueSize: number;
  }> {
    try {
      const redis = getRedisClient();

      if (redis.isConnected) {
        const keys = await redis.keys(`${this.queuePrefix}*`);
        return {
          pending: keys.length,
          processing: this.processingSet.size,
          memoryQueueSize: this.memoryQueue.length,
        };
      }
    } catch (error) {
      logger.error('Failed to get queue stats', { error });
    }

    return {
      pending: this.memoryQueue.length,
      processing: this.processingSet.size,
      memoryQueueSize: this.memoryQueue.length,
    };
  }

  /**
   * Clear all events (use with caution)
   */
  async clear(): Promise<void> {
    try {
      const redis = getRedisClient();

      if (redis.isConnected) {
        const keys = await redis.keys(`${this.queuePrefix}*`);
        if (keys.length > 0) {
          await redis.del(keys);
        }
      }

      this.memoryQueue = [];
      this.processingSet.clear();

      logger.warn('Event queue cleared');
    } catch (error) {
      logger.error('Failed to clear queue', { error });
    }
  }

  /**
   * Sort memory queue by priority and processAfter time
   */
  private sortMemoryQueue(): void {
    this.memoryQueue.sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Earlier processAfter first
      const aTime = a.processAfter ? new Date(a.processAfter).getTime() : 0;
      const bTime = b.processAfter ? new Date(b.processAfter).getTime() : 0;
      return aTime - bTime;
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const eventQueue = new EventQueue();
export default EventQueue;
