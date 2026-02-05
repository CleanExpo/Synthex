/**
 * Outgoing Webhook Sender
 *
 * Handles sending webhooks to subscriber endpoints with:
 * - Signature generation
 * - Retry logic with exponential backoff
 * - Delivery logging
 * - Dead letter queue support
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - WEBHOOK_SIGNING_SECRET (SECRET) - Default signing secret
 * - DATABASE_URL (CRITICAL) - For delivery logging
 *
 * @module lib/webhooks/sender
 */

import crypto from 'crypto';
import prisma from '@/lib/prisma';

// =============================================================================
// Types
// =============================================================================

export type WebhookEventType =
  // User events
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.login'
  | 'user.logout'
  // Content events
  | 'content.created'
  | 'content.updated'
  | 'content.published'
  | 'content.scheduled'
  | 'content.failed'
  | 'content.deleted'
  // Campaign events
  | 'campaign.created'
  | 'campaign.started'
  | 'campaign.completed'
  | 'campaign.paused'
  | 'campaign.deleted'
  // Team events
  | 'team.member.added'
  | 'team.member.removed'
  | 'team.role.changed'
  | 'team.settings.updated'
  // Subscription events
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled'
  | 'subscription.payment.succeeded'
  | 'subscription.payment.failed'
  // Integration events
  | 'integration.connected'
  | 'integration.disconnected'
  | 'integration.error'
  // Analytics events
  | 'analytics.report.ready'
  | 'analytics.alert.triggered'
  // System events
  | 'webhook.test'
  | 'webhook.ping';

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, any>;
  webhookId?: string;
  deliveryId?: string;
}

export interface DeliveryResult {
  success: boolean;
  deliveryId: string;
  statusCode?: number;
  responseTime?: number;
  error?: string;
  attempt: number;
  maxAttempts: number;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  active: boolean;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}

export interface SendWebhookOptions {
  url: string;
  event: WebhookEventType;
  data: Record<string, any>;
  secret?: string;
  webhookId?: string;
  maxRetries?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

// =============================================================================
// Signature Generation
// =============================================================================

/**
 * Generate webhook signature
 */
export function generateSignature(
  payload: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): string {
  return crypto
    .createHmac(algorithm, secret)
    .update(payload)
    .digest('hex');
}

/**
 * Generate timestamp-based signature (Stripe-style)
 */
export function generateTimestampSignature(
  payload: string,
  secret: string,
  timestamp: number
): string {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = generateSignature(signedPayload, secret);
  return `t=${timestamp},v1=${signature}`;
}

// =============================================================================
// Delivery Functions
// =============================================================================

/**
 * Send a single webhook with retry logic
 */
export async function sendWebhook(options: SendWebhookOptions): Promise<DeliveryResult> {
  const {
    url,
    event,
    data,
    secret = process.env.WEBHOOK_SIGNING_SECRET,
    webhookId,
    maxRetries = DEFAULT_MAX_RETRIES,
    timeout = DEFAULT_TIMEOUT,
    headers: customHeaders = {},
  } = options;

  const deliveryId = crypto.randomUUID();
  const timestamp = Date.now();

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
    webhookId,
    deliveryId,
  };

  const body = JSON.stringify(payload);

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Synthex-Webhook/1.0',
    'X-Webhook-Event': event,
    'X-Webhook-Delivery': deliveryId,
    'X-Webhook-Timestamp': timestamp.toString(),
    ...customHeaders,
  };

  // Add signature if secret provided
  if (secret) {
    const signature = generateSignature(body, secret);
    headers['X-Webhook-Signature'] = `sha256=${signature}`;

    // Also provide timestamp-based signature for extra security
    headers['X-Webhook-Signature-Timestamp'] = generateTimestampSignature(body, secret, timestamp);
  }

  let lastError: string | undefined;
  let lastStatusCode: number | undefined;
  let attempt = 0;

  for (attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      lastStatusCode = response.status;

      if (response.ok) {
        // Log successful delivery
        await logDelivery({
          deliveryId,
          webhookId,
          url,
          event,
          statusCode: response.status,
          responseTime,
          success: true,
          attempt,
        });

        return {
          success: true,
          deliveryId,
          statusCode: response.status,
          responseTime,
          attempt,
          maxAttempts: maxRetries,
        };
      }

      lastError = `HTTP ${response.status}: ${response.statusText}`;

      // Don't retry on 4xx errors (except 429 rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        break;
      }

    } catch (error) {
      lastError = (error as Error).name === 'AbortError'
        ? `Request timeout after ${timeout}ms`
        : error instanceof Error ? error.message : String(error);
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Log failed delivery
  await logDelivery({
    deliveryId,
    webhookId,
    url,
    event,
    statusCode: lastStatusCode,
    error: lastError,
    success: false,
    attempt,
  });

  return {
    success: false,
    deliveryId,
    statusCode: lastStatusCode,
    error: lastError,
    attempt,
    maxAttempts: maxRetries,
  };
}

/**
 * Send webhook to all subscribers of an event
 */
export async function broadcastWebhook(
  event: WebhookEventType,
  data: Record<string, any>,
  subscriptions: WebhookSubscription[]
): Promise<{ total: number; succeeded: number; failed: number; results: DeliveryResult[] }> {
  const activeSubscriptions = subscriptions.filter(
    (sub) => sub.active && sub.events.includes(event)
  );

  if (activeSubscriptions.length === 0) {
    return { total: 0, succeeded: 0, failed: 0, results: [] };
  }

  const results = await Promise.all(
    activeSubscriptions.map((sub) =>
      sendWebhook({
        url: sub.url,
        event,
        data,
        secret: sub.secret,
        webhookId: sub.id,
      })
    )
  );

  const succeeded = results.filter((r) => r.success).length;

  return {
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}

// =============================================================================
// Delivery Logging
// =============================================================================

interface LogDeliveryOptions {
  deliveryId: string;
  webhookId?: string;
  url: string;
  event: WebhookEventType;
  statusCode?: number;
  responseTime?: number;
  error?: string;
  success: boolean;
  attempt: number;
}

async function logDelivery(options: LogDeliveryOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: options.success ? 'webhook_delivered' : 'webhook_failed',
        resource: 'webhook',
        resourceId: options.webhookId || options.deliveryId,
        details: {
          deliveryId: options.deliveryId,
          url: options.url,
          event: options.event,
          statusCode: options.statusCode,
          responseTime: options.responseTime,
          error: options.error,
          attempt: options.attempt,
        },
        severity: options.success ? 'low' : 'medium',
        category: 'system',
        outcome: options.success ? 'success' : 'failure',
      },
    });
  } catch (error) {
    // Don't fail the webhook delivery if logging fails
    console.error('[webhooks] Failed to log delivery:', error);
  }
}

// =============================================================================
// Test Webhook
// =============================================================================

/**
 * Send a test webhook to verify endpoint is working
 */
export async function sendTestWebhook(
  url: string,
  secret?: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const result = await sendWebhook({
    url,
    event: 'webhook.test',
    data: {
      message: 'This is a test webhook from Synthex',
      timestamp: new Date().toISOString(),
    },
    secret,
    maxRetries: 1, // Only try once for test
    timeout: 5000, // 5 second timeout
  });

  return {
    success: result.success,
    statusCode: result.statusCode,
    error: result.error,
  };
}

/**
 * Send a ping to verify endpoint is reachable
 */
export async function pingWebhook(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok || response.status === 405; // 405 Method Not Allowed is OK
  } catch {
    return false;
  }
}

// =============================================================================
// Event Triggers (Convenience Functions)
// =============================================================================

/**
 * Trigger user event webhook
 */
export async function triggerUserEvent(
  userId: string,
  event: 'user.created' | 'user.updated' | 'user.deleted' | 'user.login' | 'user.logout',
  data: Record<string, any>,
  subscriptions: WebhookSubscription[]
): Promise<void> {
  await broadcastWebhook(event, { userId, ...data }, subscriptions);
}

/**
 * Trigger content event webhook
 */
export async function triggerContentEvent(
  contentId: string,
  event: 'content.created' | 'content.updated' | 'content.published' | 'content.scheduled' | 'content.failed' | 'content.deleted',
  data: Record<string, any>,
  subscriptions: WebhookSubscription[]
): Promise<void> {
  await broadcastWebhook(event, { contentId, ...data }, subscriptions);
}

/**
 * Trigger campaign event webhook
 */
export async function triggerCampaignEvent(
  campaignId: string,
  event: 'campaign.created' | 'campaign.started' | 'campaign.completed' | 'campaign.paused' | 'campaign.deleted',
  data: Record<string, any>,
  subscriptions: WebhookSubscription[]
): Promise<void> {
  await broadcastWebhook(event, { campaignId, ...data }, subscriptions);
}

export default {
  sendWebhook,
  broadcastWebhook,
  sendTestWebhook,
  pingWebhook,
  generateSignature,
  generateTimestampSignature,
  triggerUserEvent,
  triggerContentEvent,
  triggerCampaignEvent,
};
