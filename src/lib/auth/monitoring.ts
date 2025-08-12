/**
 * Authentication Monitoring & Alerting
 * Tracks all auth events and sends alerts on failures
 */

import * as Sentry from '@sentry/nextjs';

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

export class AuthMonitor {
  private static instance: AuthMonitor;
  private events: AuthEvent[] = [];
  private failureThreshold = 5; // Alert after 5 failures
  private recentFailures = new Map<string, number>();
  
  private constructor() {
    // Initialize Sentry if configured
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 1.0,
      });
    }
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
  trackEvent(event: any): void {
    this.logEvent({
      type: event.type || 'attempt',
      method: event.method || 'email',
      provider: event.metadata?.provider,
      email: event.metadata?.email,
      error: event.metadata?.error,
      sessionId: event.metadata?.sessionId,
      ipAddress: event.metadata?.ipAddress,
      userAgent: event.metadata?.userAgent
    });
  }

  /**
   * Log authentication event
   */
  async logEvent(event: Omit<AuthEvent, 'timestamp' | 'environment'>): Promise<void> {
    const fullEvent: AuthEvent = {
      ...event,
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development'
    };

    // Store event
    this.events.push(fullEvent);
    
    // Keep only last 1000 events in memory
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUTH_MONITOR]', fullEvent);
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
        Sentry.captureException(new Error(event.error || 'Unknown auth error'), {
          tags: {
            auth_method: event.method,
            auth_provider: event.provider,
          },
          extra: event
        });
      } else if (event.type === 'failure') {
        Sentry.captureMessage(`Auth failure: ${event.method}`, {
          level: 'warning',
          tags: {
            auth_method: event.method,
            auth_provider: event.provider,
          },
          extra: event
        });
      }
    }

    // Send to custom webhook if configured
    if (process.env.AUTH_MONITORING_WEBHOOK) {
      try {
        await fetch(process.env.AUTH_MONITORING_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        });
      } catch (error) {
        console.error('Failed to send to monitoring webhook:', error);
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
          timestamp: event.timestamp
        });
        
        // Reset counter
        this.recentFailures.delete(event.email);
      }

      // Clean up old entries (older than 1 hour)
      setTimeout(() => {
        this.recentFailures.delete(event.email!);
      }, 60 * 60 * 1000);
    }

    // Check for OAuth provider failures
    if (event.type === 'error' && event.provider) {
      await this.sendAlert({
        type: 'OAUTH_PROVIDER_ERROR',
        provider: event.provider,
        error: event.error,
        timestamp: event.timestamp
      });
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlert(alert: any): Promise<void> {
    console.error('[AUTH_ALERT]', alert);

    // Send to Sentry as critical
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureMessage(`Auth Alert: ${alert.type}`, {
        level: 'error',
        extra: alert
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
                  text: `*Alert Type:* ${alert.type}\n*Details:* ${JSON.stringify(alert, null, 2)}`
                }
              }
            ]
          })
        });
      } catch (error) {
        console.error('Failed to send alert:', error);
      }
    }
  }

  /**
   * Store event in database for audit trail
   */
  private async storeInDatabase(event: AuthEvent): Promise<void> {
    // Skip in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.ENABLE_AUTH_AUDIT) {
      return;
    }

    try {
      // Store in Supabase if configured
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && 
          process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co') {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        await supabase.from('auth_events').insert({
          type: event.type,
          method: event.method,
          provider: event.provider,
          email: event.email,
          error: event.error,
          timestamp: event.timestamp.toISOString(),
          environment: event.environment,
          session_id: event.sessionId,
          ip_address: event.ipAddress,
          user_agent: event.userAgent
        });
      }
    } catch (error) {
      console.error('Failed to store auth event:', error);
      // Don't throw - logging should not break auth flow
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
      recentFailures: this.recentFailures
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