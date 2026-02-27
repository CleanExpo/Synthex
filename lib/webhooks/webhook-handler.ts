/**
 * Webhook Handler
 *
 * @description Central webhook processing and delivery system
 *
 * ARCHITECTURE NOTE (2026-02-28):
 * This handler supports two processing modes:
 *
 * 1. **Synchronous (serverless)**: `receiveAndProcess()` — verifies the
 *    signature, parses the event, and runs all registered handlers inline
 *    within the HTTP request.  This is the REQUIRED mode for Vercel / any
 *    serverless runtime because there is no long-lived process to poll a
 *    queue.
 *
 * 2. **Async queue (long-lived process)**: `receive()` + `start()` — enqueues
 *    events and processes them via a polling interval.  Only suitable for
 *    traditional servers or background workers.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - Platform-specific webhook secrets for signature verification
 * - INTERNAL_WEBHOOK_SECRET: For internal system webhooks
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { eventQueue } from './event-queue';
import { retryManager } from './retry-manager';
import { signatureVerifier } from './signature-verifier';
import type {
  WebhookEvent,
  WebhookEventType,
  WebhookPlatform,
  WebhookEndpoint,
  WebhookDelivery,
  WebhookConfig,
  DEFAULT_WEBHOOK_CONFIG,
} from './types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

type EventHandler = (event: WebhookEvent) => Promise<void>;

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

export class WebhookHandler {
  private handlers: Map<WebhookEventType, EventHandler[]> = new Map();
  private processing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private config: WebhookConfig;

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
   * Register an event handler
   */
  on(eventType: WebhookEventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);

    logger.debug('Event handler registered', { eventType });
  }

  /**
   * Remove an event handler
   */
  off(eventType: WebhookEventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
      this.handlers.set(eventType, handlers);
    }
  }

  /**
   * Receive, verify, and immediately process a webhook event (synchronous mode).
   *
   * This is the preferred method for serverless environments (Vercel).
   * It does NOT use the event queue — handlers run inline within the request.
   */
  async receiveAndProcess(
    platform: WebhookPlatform,
    payload: string | Buffer,
    headers: Record<string, string>
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    // Get signature from headers (varies by platform)
    const signature = this.extractSignature(platform, headers);
    const timestamp = this.extractTimestamp(platform, headers);

    if (!signature) {
      logger.warn('Missing webhook signature', { platform });
      return { success: false, error: 'Missing signature' };
    }

    // Verify signature
    const verification = signatureVerifier.verify(platform, payload, signature, timestamp);

    if (!verification.valid) {
      logger.warn('Invalid webhook signature', { platform, error: verification.error });
      return { success: false, error: verification.error || 'Invalid signature' };
    }

    // Parse payload
    let data: Record<string, unknown>;
    try {
      data = typeof payload === 'string' ? JSON.parse(payload) : JSON.parse(payload.toString());
    } catch {
      logger.error('Invalid webhook payload', { platform });
      return { success: false, error: 'Invalid JSON payload' };
    }

    // Determine event type from payload
    const eventType = this.parseEventType(platform, data);

    if (!eventType) {
      logger.warn('Unknown webhook event type', { platform, data });
      return { success: false, error: 'Unknown event type' };
    }

    // Build the event object
    const eventId = uuidv4();
    const event: WebhookEvent = {
      id: eventId,
      type: eventType,
      platform,
      timestamp: new Date(),
      userId: this.extractUserId(platform, data),
      organizationId: this.extractOrganizationId(platform, data),
      data,
      metadata: {
        version: '1.0',
        source: 'synthex',
        correlationId: eventId,
        retryCount: 0,
      },
    };

    // Log receipt
    await this.logEvent(eventId, eventType, platform, data);

    // Execute handlers inline (synchronous within request)
    try {
      await this.processEvent(event);
    } catch (error) {
      logger.error('Webhook handler execution failed', {
        eventId,
        eventType,
        platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Return success to Stripe so it does not retry endlessly; we log the
      // failure for investigation.  Stripe recommends returning 2xx quickly.
      // The error is already logged above.
    }

    return { success: true, eventId };
  }

  /**
   * Receive and enqueue a webhook for async processing (queue mode).
   *
   * WARNING: This only works if `start()` has been called to poll the queue.
   * In serverless environments (Vercel), use `receiveAndProcess()` instead.
   */
  async receive(
    platform: WebhookPlatform,
    payload: string | Buffer,
    headers: Record<string, string>
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    // Get signature from headers (varies by platform)
    const signature = this.extractSignature(platform, headers);
    const timestamp = this.extractTimestamp(platform, headers);

    if (!signature) {
      logger.warn('Missing webhook signature', { platform });
      return { success: false, error: 'Missing signature' };
    }

    // Verify signature
    const verification = signatureVerifier.verify(platform, payload, signature, timestamp);

    if (!verification.valid) {
      logger.warn('Invalid webhook signature', { platform, error: verification.error });
      return { success: false, error: verification.error || 'Invalid signature' };
    }

    // Parse payload
    let data: Record<string, unknown>;
    try {
      data = typeof payload === 'string' ? JSON.parse(payload) : JSON.parse(payload.toString());
    } catch {
      logger.error('Invalid webhook payload', { platform });
      return { success: false, error: 'Invalid JSON payload' };
    }

    // Determine event type from payload
    const eventType = this.parseEventType(platform, data);

    if (!eventType) {
      logger.warn('Unknown webhook event type', { platform, data });
      return { success: false, error: 'Unknown event type' };
    }

    // Enqueue the event for processing
    const eventId = await eventQueue.enqueue(eventType, platform, data, {
      userId: this.extractUserId(platform, data),
      organizationId: this.extractOrganizationId(platform, data),
    });

    // Log the event
    await this.logEvent(eventId, eventType, platform, data);

    return { success: true, eventId };
  }

  /**
   * Emit an internal event
   */
  async emit(
    type: WebhookEventType,
    data: Record<string, unknown>,
    options?: {
      userId?: string;
      organizationId?: string;
      priority?: number;
      delay?: number;
    }
  ): Promise<string> {
    return eventQueue.enqueue(type, 'internal', data, options);
  }

  /**
   * Start processing events (queue mode — only for long-lived processes)
   */
  start(intervalMs: number = 1000): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(() => {
      this.processEvents();
    }, intervalMs);

    logger.info('Webhook handler started', { intervalMs });
  }

  /**
   * Stop processing events
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    logger.info('Webhook handler stopped');
  }

  /**
   * Process queued events
   */
  private async processEvents(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      const events = await eventQueue.dequeue(this.config.batchSize);

      if (events.length === 0) {
        return;
      }

      logger.debug('Processing webhook events', { count: events.length });

      // Process events with concurrency limit
      const chunks = this.chunk(events, this.config.concurrency);

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (queuedEvent) => {
            try {
              await this.processEvent(queuedEvent.event);
              await eventQueue.acknowledge(queuedEvent);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';

              if (retryManager.shouldRetry(queuedEvent.event.id)) {
                const delay = retryManager.getRetryDelay(queuedEvent.event.id);
                await retryManager.recordFailure(queuedEvent.event.id, errorMessage);
                await eventQueue.requeue(queuedEvent, delay);
              } else {
                await retryManager.moveToDeadLetter(queuedEvent.event, errorMessage);
                await eventQueue.acknowledge(queuedEvent);
              }
            }
          })
        );
      }
    } catch (error) {
      logger.error('Error processing webhook events', { error });
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single event — runs all registered handlers for the event type
   */
  private async processEvent(event: WebhookEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];

    if (handlers.length === 0) {
      logger.debug('No handlers for event type', { type: event.type });
      return;
    }

    logger.info('Processing webhook event', {
      eventId: event.id,
      type: event.type,
      platform: event.platform,
    });

    // Run all handlers
    const results = await Promise.allSettled(
      handlers.map((handler) => handler(event))
    );

    // Check for failures
    const failures = results.filter((r) => r.status === 'rejected');

    if (failures.length > 0) {
      const errors = failures.map((f) => (f as PromiseRejectedResult).reason);
      logger.error('Some handlers failed', { eventId: event.id, errors });
      throw new Error(`${failures.length} handlers failed`);
    }

    await retryManager.recordSuccess(event.id);
  }

  /**
   * Log event to database
   */
  private async logEvent(
    eventId: string,
    type: WebhookEventType,
    platform: WebhookPlatform,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      // Log to audit table or dedicated webhook logs
      // This is a placeholder - implement based on your schema
      logger.info('Webhook event received', {
        eventId,
        type,
        platform,
        dataKeys: Object.keys(data),
      });
    } catch (error) {
      logger.error('Failed to log webhook event', { error, eventId });
    }
  }

  /**
   * Extract signature from headers based on platform
   */
  private extractSignature(
    platform: WebhookPlatform,
    headers: Record<string, string>
  ): string | undefined {
    const headerMap: Record<WebhookPlatform, string[]> = {
      twitter: ['x-twitter-webhooks-signature'],
      facebook: ['x-hub-signature-256', 'x-hub-signature'],
      instagram: ['x-hub-signature-256', 'x-hub-signature'],
      tiktok: ['x-tiktok-signature'],
      linkedin: ['x-li-signature'],
      pinterest: ['x-pinterest-signature'],
      youtube: ['x-goog-signature'],
      threads: ['x-hub-signature-256', 'x-hub-signature'],
      reddit: ['x-reddit-signature'],
      stripe: ['stripe-signature'],
      internal: ['x-synthex-signature'],
    };

    const possibleHeaders = headerMap[platform] || [];

    for (const header of possibleHeaders) {
      const value = headers[header] || headers[header.toLowerCase()];
      if (value) return value;
    }

    return undefined;
  }

  /**
   * Extract timestamp from headers based on platform
   */
  private extractTimestamp(
    platform: WebhookPlatform,
    headers: Record<string, string>
  ): string | undefined {
    const headerMap: Record<string, string[]> = {
      tiktok: ['x-tiktok-timestamp'],
      stripe: ['stripe-signature'], // Timestamp is embedded in signature
      internal: ['x-synthex-timestamp'],
    };

    const possibleHeaders = headerMap[platform] || [];

    for (const header of possibleHeaders) {
      const value = headers[header] || headers[header.toLowerCase()];
      if (value) return value;
    }

    return undefined;
  }

  /**
   * Parse event type from platform-specific payload
   */
  private parseEventType(
    platform: WebhookPlatform,
    data: Record<string, unknown>
  ): WebhookEventType | null {
    switch (platform) {
      case 'twitter':
        return this.parseTwitterEventType(data);
      case 'facebook':
      case 'instagram':
      case 'threads':
        return this.parseMetaEventType(data);
      case 'tiktok':
        return this.parseTikTokEventType(data);
      case 'stripe':
        return this.parseStripeEventType(data);
      case 'internal':
        return data.type as WebhookEventType || null;
      default:
        return null;
    }
  }

  private parseTwitterEventType(data: Record<string, unknown>): WebhookEventType | null {
    if (data.tweet_create_events) return 'post.created';
    if (data.favorite_events) return 'engagement.like';
    if (data.follow_events) return 'follower.gained';
    return null;
  }

  private parseMetaEventType(data: Record<string, unknown>): WebhookEventType | null {
    const entry = (data.entry as Array<{ changes?: Array<{ field: string }> }>)?.[0];
    const change = entry?.changes?.[0];

    if (!change) return null;

    switch (change.field) {
      case 'feed':
        return 'post.created';
      case 'comments':
        return 'engagement.comment';
      case 'reactions':
        return 'engagement.reaction';
      default:
        return null;
    }
  }

  private parseTikTokEventType(data: Record<string, unknown>): WebhookEventType | null {
    const eventType = data.event as string;

    switch (eventType) {
      case 'video.publish':
        return 'post.published';
      case 'video.create':
        return 'post.created';
      default:
        return null;
    }
  }

  private parseStripeEventType(data: Record<string, unknown>): WebhookEventType | null {
    const type = data.type as string;

    if (type?.startsWith('customer.subscription')) {
      if (type.includes('created')) return 'billing.subscription_created';
      if (type.includes('updated')) return 'billing.subscription_updated';
      if (type.includes('deleted')) return 'billing.subscription_cancelled';
    }

    if (type?.startsWith('invoice')) {
      if (type.includes('paid')) return 'billing.payment_succeeded';
      if (type.includes('failed')) return 'billing.payment_failed';
    }

    if (type === 'checkout.session.completed') {
      return 'billing.checkout_completed';
    }

    return null;
  }

  /**
   * Extract user ID from platform-specific payload
   */
  private extractUserId(
    platform: WebhookPlatform,
    data: Record<string, unknown>
  ): string | undefined {
    // Platform-specific user ID extraction
    switch (platform) {
      case 'internal':
        return data.userId as string | undefined;
      case 'stripe':
        return (data.data as { object?: { customer?: string } })?.object?.customer;
      default:
        return undefined;
    }
  }

  /**
   * Extract organization ID from platform-specific payload
   */
  private extractOrganizationId(
    platform: WebhookPlatform,
    data: Record<string, unknown>
  ): string | undefined {
    if (platform === 'internal') {
      return data.organizationId as string | undefined;
    }
    return undefined;
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const webhookHandler = new WebhookHandler();
export default WebhookHandler;
