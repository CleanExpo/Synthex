import { type User } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// Validation schemas
export const CreateAuditLogSchema = z.object({
  userId: z.string().optional(),
  action: z.string().min(1).max(100),
  resource: z.string().min(1).max(100),
  resourceId: z.string().optional(),
  details: z.any().optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().max(500).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  category: z.enum(['auth', 'data', 'system', 'security', 'compliance', 'api']).optional().default('system'),
  outcome: z.enum(['success', 'failure', 'warning']).optional().default('success')
});

export const AuditLogFiltersSchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  category: z.enum(['auth', 'data', 'system', 'security', 'compliance', 'api']).optional(),
  outcome: z.enum(['success', 'failure', 'warning']).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(1000).optional().default(50),
  sortBy: z.enum(['createdAt', 'action', 'severity', 'outcome']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

// Use the Prisma-generated type
export type { AuditLog } from '@prisma/client';

export interface AuditLogStats {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byOutcome: Record<string, number>;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
  topActions: Array<{
    action: string;
    count: number;
  }>;
}

export class AuditService {
  /**
   * Create an audit log entry
   */
  static async log(data: z.infer<typeof CreateAuditLogSchema>): Promise<AuditLog> {
    try {
      const validated = CreateAuditLogSchema.parse(data);
      
      return await prisma.auditLog.create({
        data: {
          userId: validated.userId,
          action: validated.action,
          resource: validated.resource,
          resourceId: validated.resourceId,
          details: validated.details || null,
          ipAddress: validated.ipAddress,
          userAgent: validated.userAgent,
          severity: validated.severity || 'medium',
          category: validated.category || 'system',
          outcome: validated.outcome || 'success'
        }
      });
    } catch (error) {
      // If audit logging fails, log to console but don't throw
      // We don't want audit failures to break the main application
      console.error('Failed to create audit log:', error);
      throw error;
    }
  }

  /**
   * Get audit logs with filtering
   */
  static async getLogs(
    filters?: z.infer<typeof AuditLogFiltersSchema>
  ): Promise<{ logs: AuditLog[]; total: number; stats: AuditLogStats }> {
    const validated = filters ? AuditLogFiltersSchema.parse(filters) : AuditLogFiltersSchema.parse({});
    
    const skip = (validated.page - 1) * validated.limit;
    
    const where: any = {};
    
    if (validated.userId) where.userId = validated.userId;
    if (validated.action) where.action = { contains: validated.action, mode: 'insensitive' };
    if (validated.resource) where.resource = validated.resource;
    if (validated.severity) where.severity = validated.severity;
    if (validated.category) where.category = validated.category;
    if (validated.outcome) where.outcome = validated.outcome;
    
    // Date range filtering
    if (validated.startDate || validated.endDate) {
      where.createdAt = {};
      if (validated.startDate) where.createdAt.gte = validated.startDate;
      if (validated.endDate) where.createdAt.lte = validated.endDate;
    }
    
    const [logs, total, stats] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: validated.limit,
        orderBy: { [validated.sortBy]: validated.sortOrder },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      }),
      prisma.auditLog.count({ where }),
      this.getStats(validated.startDate, validated.endDate)
    ]);
    
    return { logs, total, stats };
  }

  /**
   * Get audit log statistics
   */
  static async getStats(startDate?: Date, endDate?: Date): Promise<AuditLogStats> {
    const where: any = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    
    const logs = await prisma.auditLog.findMany({
      where,
      select: {
        category: true,
        severity: true,
        outcome: true,
        action: true,
        createdAt: true
      }
    });

    const total = logs.length;
    
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    
    logs.forEach(log => {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
      byOutcome[log.outcome] = (byOutcome[log.outcome] || 0) + 1;
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });
    
    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentLogs = logs.filter(log => log.createdAt > sevenDaysAgo);
    const recentActivity: Array<{ date: string; count: number }> = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = recentLogs.filter(log => 
        log.createdAt.toISOString().split('T')[0] === dateStr
      ).length;
      
      recentActivity.push({ date: dateStr, count });
    }
    
    // Top actions
    const topActions = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));
    
    return {
      total,
      byCategory,
      bySeverity,
      byOutcome,
      recentActivity,
      topActions
    };
  }

  /**
   * Get audit log by ID
   */
  static async getById(id: string): Promise<AuditLog | null> {
    return await prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
  }

  /**
   * Delete old audit logs (for compliance/storage management)
   */
  static async cleanup(olderThanDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        },
        // Keep critical and high severity logs longer
        severity: {
          in: ['low', 'medium']
        }
      }
    });
    
    // Log the cleanup action
    await this.log({
      action: 'audit_cleanup',
      resource: 'audit_logs',
      details: {
        deletedCount: result.count,
        cutoffDate,
        retentionDays: olderThanDays
      },
      severity: 'low',
      category: 'system',
      outcome: 'success'
    });
    
    return result.count;
  }

  // Predefined audit logging methods for common actions
  
  static async logUserLogin(userId: string, ipAddress?: string, userAgent?: string, success: boolean = true) {
    return this.log({
      userId,
      action: success ? 'user_login' : 'user_login_failed',
      resource: 'authentication',
      ipAddress,
      userAgent,
      severity: success ? 'low' : 'medium',
      category: 'auth',
      outcome: success ? 'success' : 'failure'
    });
  }
  
  static async logUserLogout(userId: string, ipAddress?: string) {
    return this.log({
      userId,
      action: 'user_logout',
      resource: 'authentication',
      ipAddress,
      severity: 'low',
      category: 'auth',
      outcome: 'success'
    });
  }
  
  static async logUserRegister(userId: string, ipAddress?: string, userAgent?: string) {
    return this.log({
      userId,
      action: 'user_register',
      resource: 'user',
      resourceId: userId,
      ipAddress,
      userAgent,
      severity: 'medium',
      category: 'auth',
      outcome: 'success'
    });
  }
  
  static async logPasswordChange(userId: string, ipAddress?: string) {
    return this.log({
      userId,
      action: 'password_change',
      resource: 'user',
      resourceId: userId,
      ipAddress,
      severity: 'medium',
      category: 'security',
      outcome: 'success'
    });
  }
  
  static async logApiKeyAction(userId: string, action: 'create' | 'update' | 'delete', platform: string) {
    return this.log({
      userId,
      action: `api_key_${action}`,
      resource: 'api_key',
      details: { platform },
      severity: 'high',
      category: 'security',
      outcome: 'success'
    });
  }
  
  static async logPostPublish(userId: string, postId: string, platform: string, success: boolean) {
    return this.log({
      userId,
      action: success ? 'post_publish' : 'post_publish_failed',
      resource: 'post',
      resourceId: postId,
      details: { platform },
      severity: 'medium',
      category: 'data',
      outcome: success ? 'success' : 'failure'
    });
  }
  
  static async logDataExport(userId: string, exportType: string, recordCount: number) {
    return this.log({
      userId,
      action: 'data_export',
      resource: 'analytics',
      details: { exportType, recordCount },
      severity: 'high',
      category: 'compliance',
      outcome: 'success'
    });
  }
  
  static async logSecurityEvent(userId: string | undefined, event: string, details: any, severity: 'low' | 'medium' | 'high' | 'critical' = 'high') {
    return this.log({
      userId,
      action: event,
      resource: 'security',
      details,
      severity,
      category: 'security',
      outcome: 'warning'
    });
  }
  
  static async logSystemError(error: string, details: any, severity: 'medium' | 'high' | 'critical' = 'high') {
    return this.log({
      action: 'system_error',
      resource: 'system',
      details: { error, ...details },
      severity,
      category: 'system',
      outcome: 'failure'
    });
  }
}

export default AuditService;
