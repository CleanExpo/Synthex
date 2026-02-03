/**
 * Webhooks Module
 *
 * @description Unified webhook handling exports
 */

// Types
export type {
  WebhookPlatform,
  WebhookEventType,
  WebhookEvent,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookConfig,
  WebhookVerificationResult,
  QueuedEvent,
} from './types';

export { DEFAULT_WEBHOOK_CONFIG } from './types';

// Core exports
export { WebhookHandler, webhookHandler } from './webhook-handler';
export { EventQueue, eventQueue } from './event-queue';
export { RetryManager, retryManager } from './retry-manager';
export { SignatureVerifier, signatureVerifier } from './signature-verifier';

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import { webhookHandler } from './webhook-handler';
import { eventQueue } from './event-queue';
import { retryManager } from './retry-manager';
import type { WebhookEventType, WebhookPlatform } from './types';

/**
 * Emit an internal webhook event
 */
export function emit(
  type: WebhookEventType,
  data: Record<string, unknown>,
  options?: {
    userId?: string;
    organizationId?: string;
    priority?: number;
    delay?: number;
  }
): Promise<string> {
  return webhookHandler.emit(type, data, options);
}

/**
 * Register a webhook event handler
 */
export function on(
  eventType: WebhookEventType,
  handler: (event: import('./types').WebhookEvent) => Promise<void>
): void {
  webhookHandler.on(eventType, handler);
}

/**
 * Start the webhook processing loop
 */
export function start(intervalMs?: number): void {
  webhookHandler.start(intervalMs);
}

/**
 * Stop the webhook processing loop
 */
export function stop(): void {
  webhookHandler.stop();
}

/**
 * Get webhook system statistics
 */
export async function getStats(): Promise<{
  queue: Awaited<ReturnType<typeof eventQueue.getStats>>;
  retries: Awaited<ReturnType<typeof retryManager.getStats>>;
}> {
  const [queueStats, retryStats] = await Promise.all([
    eventQueue.getStats(),
    retryManager.getStats(),
  ]);

  return {
    queue: queueStats,
    retries: retryStats,
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  handler: webhookHandler,
  queue: eventQueue,
  retries: retryManager,
  emit,
  on,
  start,
  stop,
  getStats,
};
