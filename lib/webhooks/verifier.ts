/**
 * Webhook Signature Verification
 *
 * Centralized signature verification for incoming webhooks from
 * various platforms and services.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STRIPE_WEBHOOK_SECRET (SECRET) - Stripe signing secret
 * - TWITTER_WEBHOOK_SECRET (SECRET) - Twitter/X API secret
 * - LINKEDIN_WEBHOOK_SECRET (SECRET) - LinkedIn webhook secret
 * - FACEBOOK_WEBHOOK_SECRET (SECRET) - Facebook/Instagram secret
 * - INSTAGRAM_WEBHOOK_SECRET (SECRET) - Instagram specific secret
 * - TIKTOK_WEBHOOK_SECRET (SECRET) - TikTok webhook secret
 * - GITHUB_WEBHOOK_SECRET (SECRET) - GitHub webhook secret
 * - SLACK_SIGNING_SECRET (SECRET) - Slack signing secret
 *
 * @module lib/webhooks/verifier
 */

import crypto from 'crypto';

// =============================================================================
// Types
// =============================================================================

export type WebhookPlatform =
  | 'stripe'
  | 'twitter'
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'github'
  | 'slack'
  | 'custom';

export interface VerificationResult {
  valid: boolean;
  error?: string;
  platform: WebhookPlatform;
  timestamp?: number;
}

export interface WebhookConfig {
  secret: string;
  algorithm?: 'sha256' | 'sha1' | 'sha512';
  headerName?: string;
  signaturePrefix?: string;
  timestampHeader?: string;
  timestampTolerance?: number; // in seconds
}

// =============================================================================
// Webhook Secrets Configuration
// =============================================================================

const getWebhookSecret = (platform: WebhookPlatform): string | undefined => {
  const secrets: Record<WebhookPlatform, string | undefined> = {
    stripe: process.env.STRIPE_WEBHOOK_SECRET,
    twitter: process.env.TWITTER_WEBHOOK_SECRET,
    linkedin: process.env.LINKEDIN_WEBHOOK_SECRET,
    facebook: process.env.FACEBOOK_WEBHOOK_SECRET,
    instagram: process.env.INSTAGRAM_WEBHOOK_SECRET,
    tiktok: process.env.TIKTOK_WEBHOOK_SECRET,
    github: process.env.GITHUB_WEBHOOK_SECRET,
    slack: process.env.SLACK_SIGNING_SECRET,
    custom: process.env.WEBHOOK_SIGNING_SECRET,
  };
  return secrets[platform];
};

// Platform-specific configurations
const platformConfigs: Record<WebhookPlatform, Partial<WebhookConfig>> = {
  stripe: {
    algorithm: 'sha256',
    headerName: 'stripe-signature',
    timestampHeader: 't',
    timestampTolerance: 300, // 5 minutes
  },
  twitter: {
    algorithm: 'sha256',
    headerName: 'x-twitter-webhooks-signature',
    signaturePrefix: 'sha256=',
  },
  linkedin: {
    algorithm: 'sha256',
    headerName: 'x-linkedin-signature',
  },
  facebook: {
    algorithm: 'sha1',
    headerName: 'x-hub-signature',
    signaturePrefix: 'sha1=',
  },
  instagram: {
    algorithm: 'sha256',
    headerName: 'x-hub-signature-256',
    signaturePrefix: 'sha256=',
  },
  tiktok: {
    algorithm: 'sha256',
    headerName: 'x-tiktok-signature',
  },
  github: {
    algorithm: 'sha256',
    headerName: 'x-hub-signature-256',
    signaturePrefix: 'sha256=',
  },
  slack: {
    algorithm: 'sha256',
    headerName: 'x-slack-signature',
    signaturePrefix: 'v0=',
    timestampHeader: 'x-slack-request-timestamp',
    timestampTolerance: 300, // 5 minutes
  },
  custom: {
    algorithm: 'sha256',
    headerName: 'x-webhook-signature',
    signaturePrefix: 'sha256=',
  },
};

// =============================================================================
// Core Verification Functions
// =============================================================================

/**
 * Compute HMAC signature for a payload
 */
export function computeSignature(
  payload: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' | 'sha512' = 'sha256'
): string {
  return crypto.createHmac(algorithm, secret).update(payload).digest('hex');
}

/**
 * Compute HMAC signature and return as base64
 */
export function computeSignatureBase64(
  payload: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' | 'sha512' = 'sha256'
): string {
  return crypto.createHmac(algorithm, secret).update(payload).digest('base64');
}

/**
 * Timing-safe comparison of signatures
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Verify Stripe webhook signature
 * Stripe uses a special format: t=timestamp,v1=signature
 */
export function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
  tolerance: number = 300
): VerificationResult {
  try {
    const parts: Record<string, string> = {};
    signature.split(',').forEach((part) => {
      const [key, value] = part.split('=');
      if (key && value) {
        parts[key] = value;
      }
    });

    const timestamp = parseInt(parts['t'], 10);
    const v1Signature = parts['v1'];

    if (!timestamp || !v1Signature) {
      return {
        valid: false,
        error: 'Invalid Stripe signature format',
        platform: 'stripe',
      };
    }

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > tolerance) {
      return {
        valid: false,
        error: 'Webhook timestamp too old',
        platform: 'stripe',
        timestamp,
      };
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = computeSignature(signedPayload, secret, 'sha256');

    if (!safeCompare(v1Signature, expectedSignature)) {
      return {
        valid: false,
        error: 'Signature mismatch',
        platform: 'stripe',
        timestamp,
      };
    }

    return { valid: true, platform: 'stripe', timestamp };
  } catch (error: unknown) {
    return {
      valid: false,
      error: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
      platform: 'stripe',
    };
  }
}

/**
 * Verify Slack webhook signature
 * Slack uses: v0=HMAC(signing_secret, 'v0:timestamp:body')
 */
export function verifySlackSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string,
  tolerance: number = 300
): VerificationResult {
  try {
    const ts = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);

    if (Math.abs(now - ts) > tolerance) {
      return {
        valid: false,
        error: 'Request timestamp too old',
        platform: 'slack',
        timestamp: ts,
      };
    }

    const sigBasestring = `v0:${timestamp}:${payload}`;
    const expectedSignature = `v0=${computeSignature(sigBasestring, secret, 'sha256')}`;

    if (!safeCompare(signature, expectedSignature)) {
      return {
        valid: false,
        error: 'Signature mismatch',
        platform: 'slack',
        timestamp: ts,
      };
    }

    return { valid: true, platform: 'slack', timestamp: ts };
  } catch (error: unknown) {
    return {
      valid: false,
      error: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
      platform: 'slack',
    };
  }
}

/**
 * Generic webhook signature verification
 * Works for Twitter, LinkedIn, Facebook, Instagram, GitHub, etc.
 */
export function verifyGenericSignature(
  payload: string,
  signature: string,
  platform: WebhookPlatform
): VerificationResult {
  const secret = getWebhookSecret(platform);
  const config = platformConfigs[platform];

  if (!secret) {
    return {
      valid: false,
      error: `No webhook secret configured for ${platform}`,
      platform,
    };
  }

  try {
    const algorithm = config.algorithm || 'sha256';
    const prefix = config.signaturePrefix || '';

    // Remove prefix if present
    const receivedSignature = signature.startsWith(prefix)
      ? signature.slice(prefix.length)
      : signature;

    // Compute expected signature
    let expectedSignature: string;

    // Twitter uses base64 encoding
    if (platform === 'twitter') {
      expectedSignature = computeSignatureBase64(payload, secret, algorithm);
    } else {
      expectedSignature = computeSignature(payload, secret, algorithm);
    }

    if (!safeCompare(receivedSignature, expectedSignature)) {
      return {
        valid: false,
        error: 'Signature mismatch',
        platform,
      };
    }

    return { valid: true, platform };
  } catch (error: unknown) {
    return {
      valid: false,
      error: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
      platform,
    };
  }
}

// =============================================================================
// Main Verification Interface
// =============================================================================

export interface VerifyWebhookOptions {
  payload: string;
  signature: string;
  platform: WebhookPlatform;
  timestamp?: string;
  customSecret?: string;
}

/**
 * Main webhook verification function
 * Automatically handles platform-specific verification logic
 */
export function verifyWebhook(options: VerifyWebhookOptions): VerificationResult {
  const { payload, signature, platform, timestamp, customSecret } = options;

  // Skip verification in development if no secret configured
  if (process.env.NODE_ENV === 'development') {
    const secret = customSecret || getWebhookSecret(platform);
    if (!secret) {
      console.warn(`[webhooks] No secret configured for ${platform}, skipping verification in dev`);
      return { valid: true, platform };
    }
  }

  // Platform-specific verification
  switch (platform) {
    case 'stripe': {
      const secret = customSecret || getWebhookSecret('stripe');
      if (!secret) {
        return { valid: false, error: 'Stripe webhook secret not configured', platform };
      }
      return verifyStripeSignature(payload, signature, secret);
    }

    case 'slack': {
      const secret = customSecret || getWebhookSecret('slack');
      if (!secret) {
        return { valid: false, error: 'Slack signing secret not configured', platform };
      }
      if (!timestamp) {
        return { valid: false, error: 'Slack timestamp required', platform };
      }
      return verifySlackSignature(payload, signature, timestamp, secret);
    }

    default:
      return verifyGenericSignature(payload, signature, platform);
  }
}

// =============================================================================
// Helper for Next.js API Routes
// =============================================================================

export interface WebhookHeaders {
  get(name: string): string | null;
}

/**
 * Extract signature from headers based on platform
 */
export function extractSignature(
  headers: WebhookHeaders,
  platform: WebhookPlatform
): { signature: string | null; timestamp: string | null } {
  const config = platformConfigs[platform];

  // Try common header names
  const headerNames = [
    config.headerName,
    'x-hub-signature-256',
    'x-hub-signature',
    'x-webhook-signature',
    'stripe-signature',
  ].filter(Boolean) as string[];

  let signature: string | null = null;
  for (const name of headerNames) {
    signature = headers.get(name);
    if (signature) break;
  }

  // Get timestamp if platform uses it
  let timestamp: string | null = null;
  if (config.timestampHeader) {
    timestamp = headers.get(config.timestampHeader);
  }

  return { signature, timestamp };
}

/**
 * Verify webhook from Next.js request
 * Convenience wrapper for API routes
 */
export async function verifyWebhookRequest(
  request: Request,
  platform: WebhookPlatform
): Promise<{ valid: boolean; payload: string; error?: string }> {
  try {
    const payload = await request.text();
    const { signature, timestamp } = extractSignature(request.headers, platform);

    if (!signature) {
      return {
        valid: false,
        payload,
        error: 'No webhook signature found in headers',
      };
    }

    const result = verifyWebhook({
      payload,
      signature,
      platform,
      timestamp: timestamp || undefined,
    });

    return {
      valid: result.valid,
      payload,
      error: result.error,
    };
  } catch (error: unknown) {
    return {
      valid: false,
      payload: '',
      error: `Failed to verify webhook: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export default {
  verifyWebhook,
  verifyWebhookRequest,
  computeSignature,
  computeSignatureBase64,
  safeCompare,
  extractSignature,
};
