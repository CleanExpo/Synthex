/**
 * Webhook Types
 *
 * @description Shared types for webhook handling
 */

export type WebhookPlatform =
  | 'twitter'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'pinterest'
  | 'youtube'
  | 'threads'
  | 'reddit'
  | 'stripe'
  | 'internal';

export type WebhookEventType =
  // Content events
  | 'post.created'
  | 'post.published'
  | 'post.updated'
  | 'post.deleted'
  | 'post.failed'
  // Engagement events
  | 'engagement.like'
  | 'engagement.comment'
  | 'engagement.share'
  | 'engagement.save'
  | 'engagement.reaction'
  // Follower events
  | 'follower.gained'
  | 'follower.lost'
  | 'follower.milestone'
  // Analytics events
  | 'analytics.metrics_updated'
  | 'analytics.report_ready'
  | 'analytics.threshold_alert'
  // Account events
  | 'account.connected'
  | 'account.disconnected'
  | 'account.token_refreshed'
  | 'account.token_expired'
  // Billing events
  | 'billing.subscription_created'
  | 'billing.subscription_updated'
  | 'billing.subscription_cancelled'
  | 'billing.payment_succeeded'
  | 'billing.payment_failed'
  | 'billing.checkout_completed'
  // System events
  | 'system.health_check'
  | 'system.error'
  | 'system.maintenance';

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  platform: WebhookPlatform;
  timestamp: Date;
  userId?: string;
  organizationId?: string;
  data: Record<string, unknown>;
  metadata?: {
    version?: string;
    source?: string;
    correlationId?: string;
    retryCount?: number;
  };
}

export interface WebhookDelivery {
  id: string;
  eventId: string;
  endpoint: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  response?: {
    statusCode: number;
    body?: string;
    headers?: Record<string, string>;
  };
  error?: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  isActive: boolean;
  userId?: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface WebhookConfig {
  maxRetries: number;
  retryDelays: number[]; // milliseconds
  timeout: number; // milliseconds
  batchSize: number;
  concurrency: number;
}

export const DEFAULT_WEBHOOK_CONFIG: WebhookConfig = {
  maxRetries: 5,
  retryDelays: [1000, 5000, 30000, 120000, 600000], // 1s, 5s, 30s, 2m, 10m
  timeout: 30000, // 30 seconds
  batchSize: 100,
  concurrency: 10,
};

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
  platform?: WebhookPlatform;
  timestamp?: Date;
}

export interface QueuedEvent {
  event: WebhookEvent;
  priority: number;
  queuedAt: Date;
  processAfter?: Date;
}
