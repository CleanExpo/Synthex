/**
 * Webhook Module Exports
 *
 * Centralized webhook utilities for:
 * - Incoming webhook signature verification
 * - Outgoing webhook delivery with retries
 * - Event triggers and broadcasting
 *
 * @module lib/webhooks
 */

// Verifier exports
export {
  verifyWebhook,
  verifyWebhookRequest,
  verifyStripeSignature,
  verifySlackSignature,
  verifyGenericSignature,
  computeSignature,
  computeSignatureBase64,
  safeCompare,
  extractSignature,
  type WebhookPlatform,
  type VerificationResult,
  type WebhookConfig,
  type VerifyWebhookOptions,
  type WebhookHeaders,
} from './verifier';

// Sender exports
export {
  sendWebhook,
  broadcastWebhook,
  sendTestWebhook,
  pingWebhook,
  generateSignature,
  generateTimestampSignature,
  triggerUserEvent,
  triggerContentEvent,
  triggerCampaignEvent,
  type WebhookEventType,
  type WebhookPayload,
  type DeliveryResult,
  type WebhookSubscription,
  type SendWebhookOptions,
} from './sender';

// Default export combining both modules
import verifier from './verifier';
import sender from './sender';

export default {
  ...verifier,
  ...sender,
};
