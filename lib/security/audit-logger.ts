/**
 * Persistent Audit Logger
 *
 * @description Database-backed audit logging for security events:
 * - Authentication events (login, logout, failed attempts)
 * - Authorization events (access granted/denied)
 * - Data modifications (CRUD operations)
 * - Security events (rate limiting, suspicious activity)
 * - Compliance events (data access, exports)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - AUDIT_LOG_RETENTION_DAYS: Days to retain logs (default: 90)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export type AuditCategory =
  | 'auth'
  | 'data'
  | 'security'
  | 'api'
  | 'system'
  | 'compliance';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AuditOutcome = 'success' | 'failure' | 'warning';

export interface AuditEvent {
  /** Action performed (e.g., 'user_login', 'post_create') */
  action: string;
  /** Resource type (e.g., 'user', 'post', 'campaign') */
  resource: string;
  /** Resource ID if applicable */
  resourceId?: string;
  /** User who performed the action */
  userId?: string;
  /** Category for filtering */
  category: AuditCategory;
  /** Severity level */
  severity: AuditSeverity;
  /** Outcome of the action */
  outcome: AuditOutcome;
  /** Additional details */
  details?: Record<string, unknown>;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Request ID for correlation */
  requestId?: string;
}

export interface AuditQuery {
  userId?: string;
  action?: string;
  resource?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  outcome?: AuditOutcome;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const RETENTION_DAYS = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10);
const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 5000; // 5 seconds

// ============================================================================
// AUDIT LOGGER CLASS
// ============================================================================

class AuditLogger {
  private buffer: AuditEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    // Start periodic flush
    this.startFlushTimer();
  }

  /**
   * Log an audit event
   */
  async log(event: AuditEvent): Promise<void> {
    // Add to buffer
    this.buffer.push(event);

    // Flush if buffer is full
    if (this.buffer.length >= BATCH_SIZE) {
      await this.flush();
    }

    // Log to console for immediate visibility
    const logLevel = this.getLogLevel(event.severity);
    logger[logLevel]('Audit event', {
      action: event.action,
      resource: event.resource,
      outcome: event.outcome,
      userId: event.userId,
    });
  }

  /**
   * Log authentication event
   */
  async logAuth(
    action: 'login' | 'logout' | 'login_failed' | 'password_change' | 'password_reset' | 'mfa_enabled' | 'mfa_disabled' | 'session_expired',
    userId: string | undefined,
    outcome: AuditOutcome,
    details?: Record<string, unknown>,
    request?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      action: `auth.${action}`,
      resource: 'authentication',
      resourceId: userId,
      userId,
      category: 'auth',
      severity: outcome === 'failure' ? 'medium' : 'low',
      outcome,
      details,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
    });
  }

  /**
   * Log data access/modification event
   */
  async logData(
    action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'import',
    resource: string,
    resourceId: string | undefined,
    userId: string | undefined,
    outcome: AuditOutcome,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      action: `data.${action}`,
      resource,
      resourceId,
      userId,
      category: 'data',
      severity: action === 'delete' ? 'medium' : 'low',
      outcome,
      details,
    });
  }

  /**
   * Log security event
   */
  async logSecurity(
    action: 'rate_limited' | 'blocked' | 'suspicious_activity' | 'unauthorized_access' | 'csrf_attempt' | 'injection_attempt',
    details: Record<string, unknown>,
    request?: { ip?: string; userAgent?: string; userId?: string }
  ): Promise<void> {
    await this.log({
      action: `security.${action}`,
      resource: 'security',
      userId: request?.userId,
      category: 'security',
      severity: action === 'injection_attempt' ? 'critical' : 'high',
      outcome: 'failure',
      details,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
    });
  }

  /**
   * Log API access event
   */
  async logApi(
    endpoint: string,
    method: string,
    statusCode: number,
    userId: string | undefined,
    duration: number,
    request?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    const outcome: AuditOutcome = statusCode < 400 ? 'success' : statusCode < 500 ? 'warning' : 'failure';

    await this.log({
      action: `api.${method.toLowerCase()}`,
      resource: endpoint,
      userId,
      category: 'api',
      severity: 'low',
      outcome,
      details: {
        method,
        statusCode,
        duration,
      },
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
    });
  }

  /**
   * Log compliance event
   */
  async logCompliance(
    action: 'data_access' | 'data_export' | 'data_deletion' | 'consent_given' | 'consent_withdrawn' | 'gdpr_request',
    resource: string,
    resourceId: string | undefined,
    userId: string | undefined,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      action: `compliance.${action}`,
      resource,
      resourceId,
      userId,
      category: 'compliance',
      severity: 'high',
      outcome: 'success',
      details,
    });
  }

  /**
   * Query audit logs
   */
  async query(query: AuditQuery): Promise<{ logs: unknown[]; total: number }> {
    try {
      const where: Record<string, unknown> = {};

      if (query.userId) where.userId = query.userId;
      if (query.action) where.action = { contains: query.action };
      if (query.resource) where.resource = query.resource;
      if (query.category) where.category = query.category;
      if (query.severity) where.severity = query.severity;
      if (query.outcome) where.outcome = query.outcome;

      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) (where.createdAt as Record<string, Date>).gte = query.startDate;
        if (query.endDate) (where.createdAt as Record<string, Date>).lte = query.endDate;
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: query.limit || 100,
          skip: query.offset || 0,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return { logs, total };
    } catch (error) {
      logger.error('Failed to query audit logs', { error, query });
      return { logs: [], total: 0 };
    }
  }

  /**
   * Flush buffered events to database
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      await prisma.auditLog.createMany({
        data: events.map((event) => ({
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId,
          userId: event.userId,
          category: event.category,
          severity: event.severity,
          outcome: event.outcome,
          details: event.details as object,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
        })),
        skipDuplicates: true,
      });

      logger.debug('Flushed audit logs', { count: events.length });
    } catch (error) {
      logger.error('Failed to flush audit logs', { error, count: events.length });
      // Re-add to buffer on failure
      this.buffer.unshift(...events);
    }
  }

  /**
   * Cleanup old audit logs
   */
  async cleanup(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      logger.info('Cleaned up old audit logs', {
        deleted: result.count,
        retentionDays: RETENTION_DAYS,
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup audit logs', { error });
      return 0;
    }
  }

  /**
   * Get audit statistics
   */
  async getStats(days: number = 7): Promise<Record<string, unknown>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [
        totalLogs,
        byCategory,
        bySeverity,
        byOutcome,
        topActions,
      ] = await Promise.all([
        prisma.auditLog.count({
          where: { createdAt: { gte: startDate } },
        }),
        prisma.auditLog.groupBy({
          by: ['category'],
          where: { createdAt: { gte: startDate } },
          _count: true,
        }),
        prisma.auditLog.groupBy({
          by: ['severity'],
          where: { createdAt: { gte: startDate } },
          _count: true,
        }),
        prisma.auditLog.groupBy({
          by: ['outcome'],
          where: { createdAt: { gte: startDate } },
          _count: true,
        }),
        prisma.auditLog.groupBy({
          by: ['action'],
          where: { createdAt: { gte: startDate } },
          _count: true,
          orderBy: { _count: { action: 'desc' } },
          take: 10,
        }),
      ]);

      return {
        totalLogs,
        byCategory: Object.fromEntries(byCategory.map((c) => [c.category, c._count])),
        bySeverity: Object.fromEntries(bySeverity.map((s) => [s.severity, s._count])),
        byOutcome: Object.fromEntries(byOutcome.map((o) => [o.outcome, o._count])),
        topActions: topActions.map((a) => ({ action: a.action, count: a._count })),
        period: { days, startDate },
      };
    } catch (error) {
      logger.error('Failed to get audit stats', { error });
      return {};
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private startFlushTimer(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.flush();
      }
    }, FLUSH_INTERVAL);
  }

  private getLogLevel(severity: AuditSeverity): 'debug' | 'info' | 'warn' | 'error' {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warn';
      case 'medium':
        return 'info';
      default:
        return 'debug';
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
    logger.info('Audit logger shut down');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const auditLogger = new AuditLogger();
export default auditLogger;
