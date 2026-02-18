/**
 * Zapier Integration Service
 *
 * @description Manages Zapier webhook subscriptions.
 * Zapier works via webhook subscriptions - user provides their Zapier webhook URL,
 * and this service manages which Synthex events are forwarded to Zapier.
 *
 * Uses fetch() directly - no SDKs.
 */

import type { IntegrationCredentials, ZapierHook, ZapierTestResult } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Synthex events that can be forwarded to Zapier */
export const ZAPIER_SUPPORTED_EVENTS = [
  'post.created',
  'post.published',
  'post.updated',
  'post.deleted',
  'engagement.like',
  'engagement.comment',
  'engagement.share',
  'analytics.report_ready',
  'analytics.threshold_alert',
  'account.connected',
  'account.disconnected',
] as const;

export type ZapierEvent = (typeof ZAPIER_SUPPORTED_EVENTS)[number];

// ============================================================================
// SERVICE
// ============================================================================

export class ZapierService {
  private credentials: IntegrationCredentials;
  private hooks: Map<string, ZapierHook>;

  constructor(credentials: IntegrationCredentials) {
    this.credentials = credentials;
    this.hooks = new Map();

    // Restore hooks from metadata if available
    if (credentials.metadata?.hooks) {
      const storedHooks = credentials.metadata.hooks as Record<string, ZapierHook>;
      for (const [id, hook] of Object.entries(storedHooks)) {
        this.hooks.set(id, hook);
      }
    }
  }

  /**
   * Validate that the provided webhook URL is reachable
   */
  async validateWebhookUrl(url: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const parsed = new URL(url);

      // Must be HTTPS
      if (parsed.protocol !== 'https:') {
        return { valid: false, error: 'Webhook URL must use HTTPS' };
      }

      // Must be a Zapier domain
      if (
        !parsed.hostname.endsWith('zapier.com') &&
        !parsed.hostname.endsWith('hooks.zapier.com')
      ) {
        return { valid: false, error: 'Webhook URL must be a Zapier domain' };
      }

      // Try a HEAD request to verify reachability
      const response = await fetch(url, {
        method: 'HEAD',
      });

      // Zapier endpoints may return various 2xx or 4xx codes for HEAD
      // A 200 or 410 (gone) are expected, but network errors indicate unreachable
      if (response.ok || response.status === 410) {
        return { valid: true };
      }

      return { valid: true }; // Most Zapier endpoints return non-200 for HEAD but are still valid
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to validate webhook URL',
      };
    }
  }

  /**
   * Register a new webhook subscription for specified events
   */
  async registerHook(
    events: string[],
    url: string
  ): Promise<ZapierHook> {
    // Validate URL
    const validation = await this.validateWebhookUrl(url);
    if (!validation.valid) {
      throw new Error(`Invalid webhook URL: ${validation.error}`);
    }

    // Validate events
    const validEvents = events.filter((e) =>
      ZAPIER_SUPPORTED_EVENTS.includes(e as ZapierEvent)
    );

    if (validEvents.length === 0) {
      throw new Error('No valid events provided');
    }

    const hookId = crypto.randomUUID();
    const hook: ZapierHook = {
      id: hookId,
      url,
      events: validEvents,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.hooks.set(hookId, hook);

    return hook;
  }

  /**
   * Unregister a webhook subscription
   */
  async unregisterHook(hookId: string): Promise<void> {
    if (!this.hooks.has(hookId)) {
      throw new Error(`Hook not found: ${hookId}`);
    }

    this.hooks.delete(hookId);
  }

  /**
   * List all registered webhook subscriptions
   */
  async listHooks(): Promise<ZapierHook[]> {
    return Array.from(this.hooks.values());
  }

  /**
   * Test a webhook by sending a sample payload
   */
  async testHook(hookId: string): Promise<ZapierTestResult> {
    const hook = this.hooks.get(hookId);

    if (!hook) {
      return { hookId, success: false, error: 'Hook not found' };
    }

    if (!hook.isActive) {
      return { hookId, success: false, error: 'Hook is not active' };
    }

    try {
      const testPayload = {
        event: 'system.health_check',
        source: 'synthex',
        test: true,
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from Synthex',
          hookId,
        },
      };

      const response = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Synthex-Event': 'system.health_check',
          'X-Synthex-Hook-Id': hookId,
        },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        // Update last triggered
        hook.lastTriggeredAt = new Date().toISOString();
        this.hooks.set(hookId, hook);

        return { hookId, success: true, statusCode: response.status };
      }

      return {
        hookId,
        success: false,
        statusCode: response.status,
        error: `Zapier returned status ${response.status}`,
      };
    } catch (error) {
      return {
        hookId,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test webhook',
      };
    }
  }

  /**
   * Get the current hooks as a serializable object for metadata storage
   */
  getHooksForStorage(): Record<string, ZapierHook> {
    const result: Record<string, ZapierHook> = {};
    for (const [id, hook] of this.hooks.entries()) {
      result[id] = hook;
    }
    return result;
  }
}
