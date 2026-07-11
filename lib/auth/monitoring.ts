/**
 * Authentication Monitoring & Alerting
 * Tracks all auth events and sends alerts on failures
 */

import { createHash } from 'crypto';
import { logger } from '@/lib/logger';
import { auditLogger, type AuditEvent } from '@/lib/security/audit-logger';

// NOTE: Sentry removed (2026-03-12, Phase 114-02).
// require('@sentry/nextjs') at module level registers OTel hooks that hang
// ALL Lambda cold starts for 10+ seconds. Using permanent no-op stub.
const Sentry = {
  init: (..._args: any[]) => {},
  captureException: (..._args: any[]) => {},
  captureMessage: (..._args: any[]) => {},
  addBreadcrumb: (..._args: any[]) => {},
  setUser: (..._args: any[]) => {},
  setTag: (..._args: any[]) => {},
  setContext: (..._args: any[]) => {},
};

export interface AuthEvent {
  type: 'attempt' | 'success' | 'failure' | 'error' | 'logout';
  method: 'email' | 'oauth' | 'demo';
  provider?: 'google' | 'github';
  email?: string;
  error?: string;
  timestamp: Date;
  environment: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Event input for tracking - accepts any string for flexibility with various use cases */
interface TrackEventInput {
  type?: string;
  method?: string;
  timestamp?: Date | number;
  metadata?: Record<string, unknown>;
}

/** Alert data structure */
interface AlertData {
  type: string;
  email?: string;
  failures?: number;
  timestamp?: Date;
  provider?: string;
  error?: string;
}

/**
 * The genuine authentication event types. Callers also funnel non-auth events
 * (e.g. content_generation) through authMonitor.trackEvent by coercing the
 * loose type string; those are NOT persisted to the immutable auth ledger.
 */
const AUTH_EVENT_TYPES: ReadonlySet<AuthEvent['type']> = new Set([
  'attempt',
  'success',
  'failure',
  'error',
  'logout',
]);

/** Truncate an IP to /24 (IPv4) or /48 (IPv6); undefined for absent/malformed. */
function truncateIp(ip?: string): string | undefined {
  if (!ip) return undefined;
  const v4 = ip.split('.');
  if (v4.length === 4 && v4.every(o => /^\d{1,3}$/.test(o))) {
    return `${v4[0]}.${v4[1]}.${v4[2]}.0`;
  }
  if (ip.includes(':')) {
    return `${ip.split(':').slice(0, 3).join(':')}::`;
  }
  return undefined;
}

/** sha256 hex of the normalized (lower/trim) email, or undefined. */
function hashEmail(email?: string): string | undefined {
  if (!email) return undefined;
  return createHash('sha256')
    .update(email.trim().toLowerCase(), 'utf8')
    .digest('hex');
}

/**
 * PII minimization for an auth event before it reaches the immutable ledger:
 * email → sha256 hash, IP → /24 (or /48), user_agent dropped entirely.
 * Pure + synchronous — unit-tested directly.
 */
export function sanitizeAuthEventPii(event: AuthEvent): {
  emailHash?: string;
  ipAddress?: string;
} {
  return {
    emailHash: hashEmail(event.email),
    ipAddress: truncateIp(event.ipAddress),
  };
}

/**
 * Map a genuine AuthEvent onto the canonical audit_events_immutable AuditEvent
 * (category 'auth' routes it to the append-only immutable ledger via
 * auditLogger). Returns null for non-auth events that piggyback on trackEvent —
 * they are kept in-memory only, exactly as before this consolidation.
 * Pure + synchronous — unit-tested directly.
 */
export function toImmutableAuditEvent(event: AuthEvent): AuditEvent | null {
  if (!AUTH_EVENT_TYPES.has(event.type)) return null;
  const { emailHash, ipAddress } = sanitizeAuthEventPii(event);
  const isFail = event.type === 'failure' || event.type === 'error';
  const details: Record<string, unknown> = {};
  if (event.method) details.method = event.method;
  if (event.provider) details.provider = event.provider;
  if (emailHash) details.emailHash = emailHash;
  if (event.sessionId) details.sessionId = event.sessionId;
  if (event.environment) details.environment = event.environment;
  if (event.error) details.error = event.error;
  if (event.timestamp) details.eventTimestamp = event.timestamp.toISOString();
  return {
    action: `auth_monitor.${event.type}`,
    resource: 'authentication',
    category: 'auth',
    severity: isFail ? 'medium' : 'low',
    outcome: isFail ? 'failure' : 'success',
    details,
    ipAddress,
    // userAgent intentionally omitted — PII minimization drops user_agent.
  };
}

export class AuthMonitor {
  private static instance: AuthMonitor;
  private events: AuthEvent[] = [];
  private failureThreshold = 5; // Alert after 5 failures
  private recentFailures = new Map<string, number>();

  private constructor() {
    // NOTE: Sentry.init() removed — server-side Sentry is disabled (Phase 114-02).
  }

  static getInstance(): AuthMonitor {
    if (!AuthMonitor.instance) {
      AuthMonitor.instance = new AuthMonitor();
    }
    return AuthMonitor.instance;
  }

  /**
   * Track authentication event (simplified version of logEvent)
   */
  trackEvent(event: TrackEventInput): void {
    const metadata = event.metadata || {};
    this.logEvent({
      type: (event.type as AuthEvent['type']) || 'attempt',
      method: (event.method as AuthEvent['method']) || 'email',
      provider: metadata.provider as AuthEvent['provider'],
      email: metadata.email as string | undefined,
      error: metadata.error as string | undefined,
      sessionId: metadata.sessionId as string | undefined,
      ipAddress: metadata.ipAddress as string | undefined,
      userAgent: metadata.userAgent as string | undefined,
    });
  }

  /**
   * Log authentication event
   */
  async logEvent(
    event: Omit<AuthEvent, 'timestamp' | 'environment'>
  ): Promise<void> {
    const fullEvent: AuthEvent = {
      ...event,
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
    };

    // Store event
    this.events.push(fullEvent);

    // Keep only last 1000 events in memory
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
    }

    // Send to monitoring service
    await this.sendToMonitoring(fullEvent);

    // Check for anomalies
    await this.checkForAnomalies(fullEvent);

    // Store in database for audit trail
    await this.storeInDatabase(fullEvent);
  }

  /**
   * Send event to monitoring service
   */
  private async sendToMonitoring(event: AuthEvent): Promise<void> {
    // Send to Sentry
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      if (event.type === 'error') {
        Sentry.captureException(
          new Error(event.error || 'Unknown auth error'),
          {
            tags: {
              auth_method: event.method,
              auth_provider: event.provider,
            },
            extra: event,
          }
        );
      } else if (event.type === 'failure') {
        Sentry.captureMessage(`Auth failure: ${event.method}`, {
          level: 'warning',
          tags: {
            auth_method: event.method,
            auth_provider: event.provider,
          },
          extra: event,
        });
      }
    }

    // Send to custom webhook if configured
    if (process.env.AUTH_MONITORING_WEBHOOK) {
      try {
        await fetch(process.env.AUTH_MONITORING_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
      } catch (error) {
        logger.error('Failed to send to monitoring webhook', error);
      }
    }
  }

  /**
   * Check for anomalies and send alerts
   */
  private async checkForAnomalies(event: AuthEvent): Promise<void> {
    if (event.type === 'failure' && event.email) {
      // Track failures per email
      const failures = this.recentFailures.get(event.email) || 0;
      this.recentFailures.set(event.email, failures + 1);

      // Alert if threshold exceeded
      if (failures + 1 >= this.failureThreshold) {
        await this.sendAlert({
          type: 'BRUTE_FORCE_ATTEMPT',
          email: event.email,
          failures: failures + 1,
          timestamp: event.timestamp,
        });

        // Reset counter
        this.recentFailures.delete(event.email);
      }

      // Clean up old entries (older than 1 hour)
      setTimeout(
        () => {
          this.recentFailures.delete(event.email!);
        },
        60 * 60 * 1000
      );
    }

    // Check for OAuth provider failures
    if (event.type === 'error' && event.provider) {
      await this.sendAlert({
        type: 'OAUTH_PROVIDER_ERROR',
        provider: event.provider,
        error: event.error,
        timestamp: event.timestamp,
      });
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlert(alert: AlertData): Promise<void> {
    logger.warn('[AUTH_ALERT]', alert as unknown as Record<string, unknown>);

    // Send to Sentry as critical
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureMessage(`Auth Alert: ${alert.type}`, {
        level: 'error',
        extra: alert,
      });
    }

    // Send to Slack/Discord webhook if configured
    if (process.env.ALERT_WEBHOOK_URL) {
      try {
        await fetch(process.env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Authentication Alert: ${alert.type}`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Alert Type:* ${alert.type}\n*Details:* ${JSON.stringify(alert, null, 2)}`,
                },
              },
            ],
          }),
        });
      } catch (error) {
        logger.error('Failed to send alert', error);
      }
    }
  }

  /**
   * Store event in database for audit trail
   */
  private async storeInDatabase(event: AuthEvent): Promise<void> {
    // Skip in development unless explicitly enabled (avoids requiring the
    // service-role key + noisy immutable-write errors in local dev).
    if (
      process.env.NODE_ENV === 'development' &&
      !process.env.ENABLE_AUTH_AUDIT
    ) {
      return;
    }

    // Consolidated (spec P2/C6): genuine auth events persist to the append-only
    // audit_events_immutable ledger through the canonical service-role audit
    // path (auditLogger), PII-minimized. This replaces the old anon-key insert
    // into auth_events, which the table's deny-all RLS silently rejected
    // (returned {error} was never checked) so nothing ever persisted. auth_events
    // is retired — no code writes it now; its DROP is founder-gated (F1).
    // Non-auth events that piggyback on trackEvent map to null and stay
    // in-memory only, exactly as before.
    const auditEvent = toImmutableAuditEvent(event);
    if (!auditEvent) return;

    try {
      await auditLogger.log(auditEvent);
    } catch (error) {
      logger.error('Failed to persist auth event to immutable audit log', {
        error,
        type: event.type,
      });
      // Don't throw — logging must not break the auth flow.
    }
  }

  /**
   * Get recent events for debugging
   */
  getRecentEvents(count: number = 10): AuthEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Get failure rate statistics
   */
  getStats(): {
    totalEvents: number;
    failures: number;
    successRate: number;
    recentFailures: Map<string, number>;
  } {
    const failures = this.events.filter(e => e.type === 'failure').length;
    const successes = this.events.filter(e => e.type === 'success').length;
    const total = failures + successes;

    return {
      totalEvents: this.events.length,
      failures,
      successRate: total > 0 ? (successes / total) * 100 : 0,
      recentFailures: this.recentFailures,
    };
  }

  /**
   * Clear old events (for memory management)
   */
  clearOldEvents(olderThan: Date): void {
    this.events = this.events.filter(e => e.timestamp > olderThan);
  }
}

// Export singleton instance
export const authMonitor = AuthMonitor.getInstance();
