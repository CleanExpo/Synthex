/**
 * Webhook Signature Verifier
 *
 * @description Verifies webhook signatures from different platforms
 *
 * SECURITY: All webhook signatures must be verified before processing
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import type { WebhookPlatform, WebhookVerificationResult } from './types';

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

export class SignatureVerifier {
  private secrets: Map<WebhookPlatform, string>;

  constructor() {
    this.secrets = new Map();
    this.loadSecrets();
  }

  /**
   * Load secrets from environment variables
   */
  private loadSecrets(): void {
    const platformSecrets: [WebhookPlatform, string | undefined][] = [
      ['twitter', process.env.TWITTER_WEBHOOK_SECRET],
      ['facebook', process.env.META_WEBHOOK_SECRET],
      ['instagram', process.env.META_WEBHOOK_SECRET],
      ['tiktok', process.env.TIKTOK_WEBHOOK_SECRET],
      ['linkedin', process.env.LINKEDIN_WEBHOOK_SECRET],
      ['pinterest', process.env.PINTEREST_WEBHOOK_SECRET],
      ['youtube', process.env.GOOGLE_WEBHOOK_SECRET],
      ['threads', process.env.META_WEBHOOK_SECRET],
      ['reddit', process.env.REDDIT_WEBHOOK_SECRET],
      ['stripe', process.env.STRIPE_WEBHOOK_SECRET],
      ['internal', process.env.INTERNAL_WEBHOOK_SECRET],
    ];

    for (const [platform, secret] of platformSecrets) {
      if (secret) {
        this.secrets.set(platform, secret);
      }
    }
  }

  /**
   * Verify webhook signature
   */
  verify(
    platform: WebhookPlatform,
    payload: string | Buffer,
    signature: string,
    timestamp?: string
  ): WebhookVerificationResult {
    const secret = this.secrets.get(platform);

    if (!secret) {
      logger.warn('Webhook secret not configured', { platform });
      return {
        valid: false,
        error: `Webhook secret not configured for ${platform}`,
      };
    }

    try {
      switch (platform) {
        case 'twitter':
          return this.verifyTwitter(payload, signature, secret);
        case 'facebook':
        case 'instagram':
        case 'threads':
          return this.verifyMeta(payload, signature, secret);
        case 'tiktok':
          return this.verifyTikTok(payload, signature, secret, timestamp);
        case 'linkedin':
          return this.verifyLinkedIn(payload, signature, secret);
        case 'pinterest':
          return this.verifyPinterest(payload, signature, secret);
        case 'youtube':
          return this.verifyGoogle(payload, signature, secret);
        case 'reddit':
          return this.verifyReddit(payload, signature, secret);
        case 'stripe':
          return this.verifyStripe(payload, signature, secret, timestamp);
        case 'internal':
          return this.verifyInternal(payload, signature, secret, timestamp);
        default:
          return { valid: false, error: 'Unknown platform' };
      }
    } catch (error) {
      logger.error('Signature verification error', { platform, error });
      return { valid: false, error: 'Signature verification failed' };
    }
  }

  /**
   * Twitter signature verification (HMAC-SHA256)
   */
  private verifyTwitter(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): WebhookVerificationResult {
    const expectedSig = 'sha256=' + createHmac('sha256', secret)
      .update(payload)
      .digest('base64');

    const valid = this.safeCompare(signature, expectedSig);
    return { valid, platform: 'twitter' };
  }

  /**
   * Meta platforms signature verification (HMAC-SHA256)
   */
  private verifyMeta(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): WebhookVerificationResult {
    const expectedSig = 'sha256=' + createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const valid = this.safeCompare(signature, expectedSig);
    return { valid, platform: 'facebook' };
  }

  /**
   * TikTok signature verification
   */
  private verifyTikTok(
    payload: string | Buffer,
    signature: string,
    secret: string,
    timestamp?: string
  ): WebhookVerificationResult {
    if (!timestamp) {
      return { valid: false, error: 'Missing timestamp' };
    }

    // Check timestamp is within 5 minutes
    const ts = parseInt(timestamp, 10);
    if (Date.now() - ts * 1000 > 300000) {
      return { valid: false, error: 'Timestamp too old' };
    }

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSig = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const valid = this.safeCompare(signature, expectedSig);
    return { valid, platform: 'tiktok', timestamp: new Date(ts * 1000) };
  }

  /**
   * LinkedIn signature verification
   */
  private verifyLinkedIn(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): WebhookVerificationResult {
    const expectedSig = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const valid = this.safeCompare(signature, expectedSig);
    return { valid, platform: 'linkedin' };
  }

  /**
   * Pinterest signature verification
   */
  private verifyPinterest(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): WebhookVerificationResult {
    const expectedSig = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const valid = this.safeCompare(signature, expectedSig);
    return { valid, platform: 'pinterest' };
  }

  /**
   * Google/YouTube signature verification
   */
  private verifyGoogle(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): WebhookVerificationResult {
    const expectedSig = createHmac('sha256', secret)
      .update(payload)
      .digest('base64');

    const valid = this.safeCompare(signature, expectedSig);
    return { valid, platform: 'youtube' };
  }

  /**
   * Reddit signature verification
   */
  private verifyReddit(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): WebhookVerificationResult {
    const expectedSig = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const valid = this.safeCompare(signature, expectedSig);
    return { valid, platform: 'reddit' };
  }

  /**
   * Stripe signature verification
   */
  private verifyStripe(
    payload: string | Buffer,
    signature: string,
    secret: string,
    timestamp?: string
  ): WebhookVerificationResult {
    // Parse Stripe signature header
    const parts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      if (key && value) acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const ts = parts['t'];
    const v1 = parts['v1'];

    if (!ts || !v1) {
      return { valid: false, error: 'Invalid Stripe signature format' };
    }

    // Check timestamp is within 5 minutes
    const tsNum = parseInt(ts, 10);
    if (Date.now() - tsNum * 1000 > 300000) {
      return { valid: false, error: 'Timestamp too old' };
    }

    const signedPayload = `${ts}.${payload}`;
    const expectedSig = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const valid = this.safeCompare(v1, expectedSig);
    return { valid, platform: 'stripe', timestamp: new Date(tsNum * 1000) };
  }

  /**
   * Internal webhook signature verification
   */
  private verifyInternal(
    payload: string | Buffer,
    signature: string,
    secret: string,
    timestamp?: string
  ): WebhookVerificationResult {
    if (!timestamp) {
      return { valid: false, error: 'Missing timestamp' };
    }

    // Check timestamp is within 5 minutes
    const ts = parseInt(timestamp, 10);
    if (Date.now() - ts > 300000) {
      return { valid: false, error: 'Timestamp too old' };
    }

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSig = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const valid = this.safeCompare(signature, expectedSig);
    return { valid, platform: 'internal', timestamp: new Date(ts) };
  }

  /**
   * Generate signature for outgoing webhooks
   */
  generateSignature(
    payload: string,
    secret: string,
    timestamp?: number
  ): { signature: string; timestamp: number } {
    const ts = timestamp || Date.now();
    const signedPayload = `${ts}.${payload}`;
    const signature = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return { signature, timestamp: ts };
  }

  /**
   * Timing-safe string comparison
   */
  private safeCompare(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);

      if (bufA.length !== bufB.length) {
        return false;
      }

      return timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const signatureVerifier = new SignatureVerifier();
export default SignatureVerifier;
