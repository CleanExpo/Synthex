/**
 * Message Queue Service Implementation
 * Provides async message processing with Redis-based queuing
 */

import {
  IMessageQueue,
  MessageHandler,
  MessageContext,
  MessageOptions,
  ListenOptions,
  QueueOptions,
  InfrastructureError,
  ILogger
} from '../../architecture/layer-interfaces';
import Redis from 'ioredis';

export interface QueueMessage {
  id: string;
  queue: string;
  data: any;
  options: MessageOptions;
  timestamp: Date;
  attempt: number;
  maxRetries: number;
}

export class QueueService implements IMessageQueue {
  private redis: Redis;
  private logger: ILogger;
  private handlers = new Map<string, { handler: MessageHandler; options: ListenOptions }>();
  private processingIntervals = new Map<string, NodeJS.Timeout>();
  private isProcessing = false;
  private readonly PROCESSING_INTERVAL = 1000; // 1 second
  private readonly MAX_CONCURRENT_JOBS = 10;
  private readonly DEFAULT_RETRY_DELAY = 5000; // 5 seconds

  constructor(redis: Redis, logger: ILogger) {
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * Send message to queue
   */
  async send(queue: string, message: any, options: MessageOptions = {}): Promise<void> {
    try {
      const queueMessage: QueueMessage = {
        id: this.generateMessageId(),
        queue,
        data: message,
        options: {
          delay: options.delay || 0,
          priority: options.priority || 0,
          retries: options.retries || 3,
          ttl: options.ttl || 3600000 // 1 hour default
        },
        timestamp: new Date(),
        attempt: 0,
        maxRetries: options.retries || 3
      };

      // Handle delayed messages
      if (options.delay && options.delay > 0) {
        await this.scheduleDelayedMessage(queueMessage);
      } else {
        await this.enqueueMessage(queueMessage);
      }

      this.logger.debug(`Message sent to queue: ${queue}`, {
        messageId: queueMessage.id,
        queue,
        delay: options.delay,
        priority: options.priority
      });

    } catch (error) {
      throw new InfrastructureError(
        `Failed to send message to queue: ${queue}`,
        'QUEUE_SEND_ERROR',
        500,
        { queue, message: this.sanitizeMessage(message) },
        error as Error
      );
    }
  }

  /**
   * Listen for messages on queue
   */
  async listen(queue: string, handler: MessageHandler, options: ListenOptions = {}): Promise<void> {
    try {
      // Store handler configuration
      this.handlers.set(queue, { handler, options });

      // Create queue if it doesn't exist
      await this.createQueue(queue, {
        durable: true,
        autoDelete: false
      });

      // Start processing for this queue
      await this.startQueueProcessing(queue);

      this.logger.info(`Started listening on queue: ${queue}`, {
        queue,
        concurrency: options.concurrency || 1,
        prefetch: options.prefetch || 1
      });

    } catch (error) {
      throw new InfrastructureError(
        `Failed to start listening on queue: ${queue}`,
        'QUEUE_LISTEN_ERROR',
        500,
        { queue },
        error as Error
      );
    }
  }

  /**
   * Create queue
   */
  async createQueue(name: string, options: QueueOptions = {}): Promise<void> {
    try {
      // Redis doesn't have explicit queue creation, but we can set up metadata
      const queueKey = this.getQueueKey(name);
      const metadataKey = this.getQueueMetadataKey(name);

      await this.redis.hset(metadataKey, {
        name,
        durable: options.durable ? '1' : '0',
        autoDelete: options.autoDelete ? '1' : '0',
        exclusive: options.exclusive ? '1' : '0',
        createdAt: new Date().toISOString()
      });

      this.logger.debug(`Queue created: ${name}`, { name, options });

    } catch (error) {
      throw new InfrastructureError(
        `Failed to create queue: ${name}`,
        'QUEUE_CREATE_ERROR',
        500,
        { name, options },
        error as Error
      );
    }
  }

  /**
   * Delete queue
   */
  async deleteQueue(name: string): Promise<void> {
    try {
      const queueKey = this.getQueueKey(name);
      const metadataKey = this.getQueueMetadataKey(name);
      const delayedKey = this.getDelayedQueueKey(name);
      const processingKey = this.getProcessingQueueKey(name);
      const deadLetterKey = this.getDeadLetterQueueKey(name);

      // Stop processing for this queue
      const interval = this.processingIntervals.get(name);
      if (interval) {
        clearInterval(interval);
        this.processingIntervals.delete(name);
      }

      // Remove handler
      this.handlers.delete(name);

      // Delete all queue-related keys
      await this.redis.del(queueKey, metadataKey, delayedKey, processingKey, deadLetterKey);

      this.logger.info(`Queue deleted: ${name}`);

    } catch (error) {
      throw new InfrastructureError(
        `Failed to delete queue: ${name}`,
        'QUEUE_DELETE_ERROR',
        500,
        { name },
        error as Error
      );
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(name: string): Promise<{
    waiting: number;
    processing: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const queueKey = this.getQueueKey(name);
      const processingKey = this.getProcessingQueueKey(name);
      const delayedKey = this.getDelayedQueueKey(name);
      const deadLetterKey = this.getDeadLetterQueueKey(name);
      const completedKey = this.getCompletedQueueKey(name);

      const [waiting, processing, delayed, failed, completed] = await Promise.all([
        this.redis.llen(queueKey),
        this.redis.llen(processingKey),
        this.redis.zcard(delayedKey),
        this.redis.llen(deadLetterKey),
        this.redis.llen(completedKey)
      ]);

      return {
        waiting,
        processing,
        delayed,
        failed,
        completed
      };

    } catch (error) {
      this.logger.error(`Failed to get queue stats for: ${name}`, error as Error);
      return { waiting: 0, processing: 0, delayed: 0, failed: 0, completed: 0 };
    }
  }

  /**
   * Purge all messages from queue
   */
  async purgeQueue(name: string): Promise<number> {
    try {
      const queueKey = this.getQueueKey(name);
      const processingKey = this.getProcessingQueueKey(name);
      const delayedKey = this.getDelayedQueueKey(name);

      const [waitingCount, processingCount, delayedCount] = await Promise.all([
        this.redis.llen(queueKey),
        this.redis.llen(processingKey),
        this.redis.zcard(delayedKey)
      ]);

      await Promise.all([
        this.redis.del(queueKey),
        this.redis.del(processingKey),
        this.redis.del(delayedKey)
      ]);

      const totalPurged = waitingCount + processingCount + delayedCount;

      this.logger.info(`Purged ${totalPurged} messages from queue: ${name}`);
      return totalPurged;

    } catch (error) {
      throw new InfrastructureError(
        `Failed to purge queue: ${name}`,
        'QUEUE_PURGE_ERROR',
        500,
        { name },
        error as Error
      );
    }
  }

  /**
   * Start processing messages for a specific queue
   */
  private async startQueueProcessing(queue: string): Promise<void> {
    if (this.processingIntervals.has(queue)) {
      return; // Already processing
    }

    const interval = setInterval(async () => {
      try {
        await this.processQueueMessages(queue);
      } catch (error) {
        this.logger.error(`Error processing queue ${queue}`, error as Error);
      }
    }, this.PROCESSING_INTERVAL);

    this.processingIntervals.set(queue, interval);
  }

  /**
   * Process messages from a specific queue
   */
  private async processQueueMessages(queue: string): Promise<void> {
    const handlerConfig = this.handlers.get(queue);
    if (!handlerConfig) {
      return;
    }

    const concurrency = handlerConfig.options.concurrency || 1;
    const processingKey = this.getProcessingQueueKey(queue);
    
    // Check how many messages are currently being processed
    const currentProcessing = await this.redis.llen(processingKey);
    if (currentProcessing >= concurrency) {
      return; // At capacity
    }

    // Process delayed messages first
    await this.processDelayedMessages(queue);

    // Process regular messages
    const messagesToProcess = Math.min(
      concurrency - currentProcessing,
      this.MAX_CONCURRENT_JOBS
    );

    const promises: Promise<void>[] = [];
    for (let i = 0; i < messagesToProcess; i++) {
      promises.push(this.processNextMessage(queue));
    }

    await Promise.all(promises);
  }

  /**
   * Process the next message from queue
   */
  private async processNextMessage(queue: string): Promise<void> {
    const queueKey = this.getQueueKey(queue);
    const processingKey = this.getProcessingQueueKey(queue);

    try {
      // Move message from queue to processing
      const messageData = await this.redis.brpoplpush(queueKey, processingKey, 1);
      if (!messageData) {
        return; // No messages
      }

      const message: QueueMessage = JSON.parse(messageData);
      
      // Create message context
      const context: MessageContext = {
        messageId: message.id,
        queue: message.queue,
        attempt: message.attempt + 1,
        timestamp: message.timestamp
      };

      const handlerConfig = this.handlers.get(queue);
      if (!handlerConfig) {
        throw new Error(`No handler found for queue: ${queue}`);
      }

      try {
        // Execute message handler
        await handlerConfig.handler(message.data, context);

        // Message processed successfully
        await this.completeMessage(message);

        this.logger.debug(`Message processed successfully`, {
          messageId: message.id,
          queue: message.queue,
          attempt: context.attempt
        });

      } catch (handlerError) {
        // Handler failed, handle retry logic
        await this.handleMessageFailure(message, handlerError as Error, handlerConfig.options);
      }

    } catch (error) {
      this.logger.error(`Error processing message from queue ${queue}`, error as Error);
    }
  }

  /**
   * Process delayed messages
   */
  private async processDelayedMessages(queue: string): Promise<void> {
    const delayedKey = this.getDelayedQueueKey(queue);
    const queueKey = this.getQueueKey(queue);
    const now = Date.now();

    try {
      // Get messages that should be processed now
      const delayedMessages = await this.redis.zrangebyscore(
        delayedKey,
        '-inf',
        now,
        'LIMIT',
        0,
        10 // Process up to 10 delayed messages at once
      );

      if (delayedMessages.length === 0) {
        return;
      }

      // Move messages from delayed set to main queue
      const pipeline = this.redis.pipeline();
      
      for (const messageData of delayedMessages) {
        pipeline.zrem(delayedKey, messageData);
        pipeline.lpush(queueKey, messageData);
      }

      await pipeline.exec();

      this.logger.debug(`Moved ${delayedMessages.length} delayed messages to queue: ${queue}`);

    } catch (error) {
      this.logger.error(`Error processing delayed messages for queue ${queue}`, error as Error);
    }
  }

  /**
   * Handle message processing failure
   */
  private async handleMessageFailure(
    message: QueueMessage,
    error: Error,
    options: ListenOptions
  ): Promise<void> {
    const processingKey = this.getProcessingQueueKey(message.queue);
    
    try {
      // Remove from processing queue
      await this.redis.lrem(processingKey, 1, JSON.stringify(message));

      // Check if we should retry
      if (message.attempt < message.maxRetries) {
        // Increment attempt count and retry with delay
        message.attempt++;
        
        const retryDelay = this.calculateRetryDelay(message.attempt);
        const delayedKey = this.getDelayedQueueKey(message.queue);
        const executeAt = Date.now() + retryDelay;

        await this.redis.zadd(delayedKey, executeAt, JSON.stringify(message));

        this.logger.warn(`Message retry scheduled`, {
          messageId: message.id,
          queue: message.queue,
          attempt: message.attempt,
          maxRetries: message.maxRetries,
          retryDelay,
          error: error.message
        });

      } else {
        // Max retries exceeded, move to dead letter queue
        await this.moveToDeadLetterQueue(message, error);

        this.logger.error(`Message moved to dead letter queue`, {
          messageId: message.id,
          queue: message.queue,
          attempts: message.attempt,
          error: error.message
        });
      }

    } catch (handlingError) {
      this.logger.error(`Error handling message failure`, handlingError as Error, {
        originalError: error.message,
        messageId: message.id,
        queue: message.queue
      });
    }
  }

  /**
   * Complete message processing
   */
  private async completeMessage(message: QueueMessage): Promise<void> {
    const processingKey = this.getProcessingQueueKey(message.queue);
    const completedKey = this.getCompletedQueueKey(message.queue);

    // Remove from processing queue
    await this.redis.lrem(processingKey, 1, JSON.stringify(message));

    // Add to completed queue (with TTL to prevent unlimited growth)
    const completedMessage = {
      ...message,
      completedAt: new Date().toISOString()
    };

    await this.redis.lpush(completedKey, JSON.stringify(completedMessage));
    await this.redis.expire(completedKey, 86400); // Keep completed messages for 24 hours
  }

  /**
   * Move message to dead letter queue
   */
  private async moveToDeadLetterQueue(message: QueueMessage, error: Error): Promise<void> {
    const deadLetterKey = this.getDeadLetterQueueKey(message.queue);

    const deadLetterMessage = {
      ...message,
      failedAt: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    };

    await this.redis.lpush(deadLetterKey, JSON.stringify(deadLetterMessage));
  }

  /**
   * Schedule delayed message
   */
  private async scheduleDelayedMessage(message: QueueMessage): Promise<void> {
    const delayedKey = this.getDelayedQueueKey(message.queue);
    const executeAt = Date.now() + (message.options.delay || 0);

    await this.redis.zadd(delayedKey, executeAt, JSON.stringify(message));
  }

  /**
   * Enqueue message immediately
   */
  private async enqueueMessage(message: QueueMessage): Promise<void> {
    const queueKey = this.getQueueKey(message.queue);

    // Use priority if specified
    if (message.options.priority && message.options.priority > 0) {
      // For simplicity, higher priority messages go to the front
      await this.redis.lpush(queueKey, JSON.stringify(message));
    } else {
      await this.redis.rpush(queueKey, JSON.stringify(message));
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    return Math.min(
      this.DEFAULT_RETRY_DELAY * Math.pow(2, attempt - 1),
      300000 // Max 5 minutes
    );
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize message for logging
   */
  private sanitizeMessage(message: any): any {
    if (typeof message === 'object' && message !== null) {
      const sanitized = { ...message };
      const sensitiveFields = ['password', 'token', 'secret', 'key'];
      
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });

      return sanitized;
    }
    
    return message;
  }

  /**
   * Key generation methods
   */
  private getQueueKey(name: string): string {
    return `queue:${name}`;
  }

  private getQueueMetadataKey(name: string): string {
    return `queue:${name}:metadata`;
  }

  private getProcessingQueueKey(name: string): string {
    return `queue:${name}:processing`;
  }

  private getDelayedQueueKey(name: string): string {
    return `queue:${name}:delayed`;
  }

  private getDeadLetterQueueKey(name: string): string {
    return `queue:${name}:dead-letter`;
  }

  private getCompletedQueueKey(name: string): string {
    return `queue:${name}:completed`;
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    try {
      // Stop all processing intervals
      for (const [queue, interval] of this.processingIntervals) {
        clearInterval(interval);
        this.logger.debug(`Stopped processing for queue: ${queue}`);
      }

      this.processingIntervals.clear();
      this.handlers.clear();
      this.isProcessing = false;

      this.logger.info('Queue service disposed');

    } catch (error) {
      this.logger.error('Error disposing queue service', error as Error);
    }
  }
}