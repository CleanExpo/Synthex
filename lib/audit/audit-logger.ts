/**
 * Audit Logging Foundation — SYN-440
 *
 * Centralised audit event logger backed by the `AuditLog` Prisma model.
 * No schema migration required — the model already exists.
 *
 * Design principles:
 * - Never throws: audit failure must never break the calling request
 * - Structured events: typed enum keeps the event vocabulary consistent
 * - Maps cleanly to AuditLog fields: action, resource, category, severity, outcome
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Event catalogue
// ---------------------------------------------------------------------------

export type AuditEvent =
  | 'user.login'
  | 'user.login_failed'
  | 'user.logout'
  | 'user.password_change'
  | 'billing.subscription_created'
  | 'billing.subscription_cancelled'
  | 'billing.subscription_upgraded'
  | 'account.deletion_requested'
  | 'account.data_exported'
  | 'admin.user_suspended'
  | 'api.rate_limit_exceeded'
  | 'security.cron_unauthorised';

// ---------------------------------------------------------------------------
// Severity + category inference
// ---------------------------------------------------------------------------

const EVENT_SEVERITY: Record<
  AuditEvent,
  'low' | 'medium' | 'high' | 'critical'
> = {
  'user.login': 'low',
  'user.login_failed': 'medium',
  'user.logout': 'low',
  'user.password_change': 'medium',
  'billing.subscription_created': 'low',
  'billing.subscription_cancelled': 'medium',
  'billing.subscription_upgraded': 'low',
  'account.deletion_requested': 'high',
  'account.data_exported': 'medium',
  'admin.user_suspended': 'high',
  'api.rate_limit_exceeded': 'medium',
  'security.cron_unauthorised': 'critical',
};

const EVENT_CATEGORY: Record<AuditEvent, string> = {
  'user.login': 'auth',
  'user.login_failed': 'auth',
  'user.logout': 'auth',
  'user.password_change': 'security',
  'billing.subscription_created': 'data',
  'billing.subscription_cancelled': 'data',
  'billing.subscription_upgraded': 'data',
  'account.deletion_requested': 'compliance',
  'account.data_exported': 'compliance',
  'admin.user_suspended': 'security',
  'api.rate_limit_exceeded': 'api',
  'security.cron_unauthorised': 'security',
};

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  event: AuditEvent;
  /** Prisma User.id — nullable for unauthenticated events */
  userId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  /** Override default outcome; defaults to 'success' */
  outcome?: 'success' | 'failure' | 'warning';
}

/**
 * Log an audit event to the database.
 *
 * This function is intentionally fire-and-forget safe — it swallows all
 * errors so that a DB hiccup never disrupts the caller's request flow.
 * Errors are still logged to stderr for monitoring.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const {
    event,
    userId,
    metadata,
    ipAddress,
    userAgent,
    outcome = 'success',
  } = entry;

  try {
    await prisma.auditLog.create({
      data: {
        action: event,
        resource: event.split('.')[0] ?? 'system',
        resourceId: userId,
        category: EVENT_CATEGORY[event] ?? 'system',
        severity: EVENT_SEVERITY[event] ?? 'medium',
        outcome,
        details: (metadata ?? {}) as unknown as Prisma.InputJsonValue,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        userId: userId ?? null,
      },
    });
  } catch (error) {
    // Never re-throw — audit failure must be invisible to the caller
    console.error('[audit] Failed to log event:', event, error);
  }
}
