import { type User } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// Validation schemas
export const CreateNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z.enum(['info', 'success', 'warning', 'error', 'platform', 'system']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  actionUrl: z.string().url().optional(),
  actionText: z.string().max(50).optional(),
  metadata: z.any().optional(),
  scheduledFor: z.date().optional(),
  expiresAt: z.date().optional()
});

export const UpdateNotificationSchema = z.object({
  read: z.boolean().optional(),
  archived: z.boolean().optional()
});

export const NotificationFiltersSchema = z.object({
  type: z.enum(['info', 'success', 'warning', 'error', 'platform', 'system']).optional(),
  read: z.boolean().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
  sortBy: z.enum(['createdAt', 'priority', 'type']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'platform' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  read: boolean;
  archived: boolean;
  actionUrl?: string;
  actionText?: string;
  metadata?: any;
  scheduledFor?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  recent: number;
}

export class NotificationService {
  /**
   * Create a new notification
   */
  static async create(
    userId: string, 
    data: z.infer<typeof CreateNotificationSchema>
  ): Promise<Notification> {
    const validated = CreateNotificationSchema.parse(data);
    
    return await prisma.notification.create({
      data: {
        userId,
        title: validated.title,
        message: validated.message,
        type: validated.type,
        priority: validated.priority || 'medium',
        read: false,
        archived: false,
        actionUrl: validated.actionUrl,
        actionText: validated.actionText,
        metadata: validated.metadata || null,
        scheduledFor: validated.scheduledFor,
        expiresAt: validated.expiresAt
      }
    });
  }

  /**
   * Get notifications for a user with filtering
   */
  static async getUserNotifications(
    userId: string, 
    filters?: z.infer<typeof NotificationFiltersSchema>
  ): Promise<{ notifications: Notification[]; total: number; stats: NotificationStats }> {
    const validated = filters ? NotificationFiltersSchema.parse(filters) : NotificationFiltersSchema.parse({});
    
    const skip = (validated.page - 1) * validated.limit;
    
    const where: any = {
      userId,
      // Only show notifications that are scheduled for now or in the past
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: new Date() } }
      ],
      // Exclude expired notifications
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      ]
    };
    
    if (validated.type) where.type = validated.type;
    if (validated.read !== undefined) where.read = validated.read;
    if (validated.priority) where.priority = validated.priority;
    
    const [notifications, total, stats] = await Promise.all([
      (prisma as any).notification.findMany({
        where,
        skip,
        take: validated.limit,
        orderBy: { [validated.sortBy]: validated.sortOrder }
      }),
      (prisma as any).notification.count({ where }),
      this.getStats(userId)
    ]);
    
    return { notifications, total, stats };
  }

  /**
   * Get notification statistics for a user
   */
  static async getStats(userId: string): Promise<NotificationStats> {
    const notifications = await (prisma as any).notification.findMany({
      where: {
        userId,
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: new Date() } }
        ],
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          }
        ]
      },
      select: {
        type: true,
        priority: true,
        read: true,
        createdAt: true
      }
    });

    const total = notifications.length;
    const unread = notifications.filter(n => !n.read).length;
    
    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    
    notifications.forEach(notification => {
      byType[notification.type] = (byType[notification.type] || 0) + 1;
      byPriority[notification.priority] = (byPriority[notification.priority] || 0) + 1;
    });
    
    // Recent notifications (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recent = notifications.filter(n => n.createdAt > yesterday).length;
    
    return {
      total,
      unread,
      byType,
      byPriority,
      recent
    };
  }

  /**
   * Get a single notification
   */
  static async getById(id: string, userId: string): Promise<Notification | null> {
    return await (prisma as any).notification.findFirst({
      where: { id, userId }
    });
  }

  /**
   * Update notification (mark as read, archive, etc.)
   */
  static async update(
    id: string,
    userId: string,
    data: z.infer<typeof UpdateNotificationSchema>
  ): Promise<Notification> {
    const validated = UpdateNotificationSchema.parse(data);
    
    // Verify ownership
    const existing = await (prisma as any).notification.findFirst({
      where: { id, userId }
    });
    
    if (!existing) {
      throw new Error('Notification not found');
    }
    
    return await (prisma as any).notification.update({
      where: { id },
      data: {
        ...validated,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(id: string, userId: string): Promise<Notification> {
    return this.update(id, userId, { read: true });
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string): Promise<number> {
    const result = await (prisma as any).notification.updateMany({
      where: { userId, read: false },
      data: { read: true, updatedAt: new Date() }
    });
    
    return result.count;
  }

  /**
   * Archive notification
   */
  static async archive(id: string, userId: string): Promise<Notification> {
    return this.update(id, userId, { archived: true });
  }

  /**
   * Delete notification
   */
  static async delete(id: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await (prisma as any).notification.findFirst({
      where: { id, userId }
    });
    
    if (!existing) {
      throw new Error('Notification not found');
    }
    
    await (prisma as any).notification.delete({
      where: { id }
    });
  }

  /**
   * Delete all archived notifications
   */
  static async deleteArchived(userId: string): Promise<number> {
    const result = await (prisma as any).notification.deleteMany({
      where: { userId, archived: true }
    });
    
    return result.count;
  }

  /**
   * Create platform-specific notifications
   */
  static async createPlatformNotification(
    userId: string,
    platform: string,
    action: string,
    success: boolean,
    details?: any
  ): Promise<Notification> {
    let title: string;
    let message: string;
    let type: 'success' | 'error' | 'info' | 'warning' = 'info';
    
    if (action === 'publish') {
      if (success) {
        title = `${platform} Post Published`;
        message = `Your post was successfully published to ${platform}`;
        type = 'success';
      } else {
        title = `${platform} Publish Failed`;
        message = `Failed to publish post to ${platform}${details?.error ? `: ${details.error}` : ''}`;
        type = 'error';
      }
    } else if (action === 'sync_analytics') {
      if (success) {
        title = `${platform} Analytics Synced`;
        message = `Analytics data updated from ${platform}`;
        type = 'success';
      } else {
        title = `${platform} Sync Failed`;
        message = `Failed to sync analytics from ${platform}`;
        type = 'warning';
      }
    } else if (action === 'configure') {
      if (success) {
        title = `${platform} Connected`;
        message = `Successfully connected your ${platform} account`;
        type = 'success';
      } else {
        title = `${platform} Connection Failed`;
        message = `Failed to connect ${platform} account${details?.error ? `: ${details.error}` : ''}`;
        type = 'error';
      }
    }
    
    return this.create(userId, {
      title: title!,
      message: message!,
      type: 'platform',
      priority: type === 'error' ? 'high' : 'medium',
      metadata: {
        platform,
        action,
        success,
        ...details
      },
      actionUrl: success && details?.url ? details.url : undefined,
      actionText: success && details?.url ? 'View Post' : undefined
    });
  }

  /**
   * Create system notification
   */
  static async createSystemNotification(
    userId: string,
    title: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<Notification> {
    return this.create(userId, {
      title,
      message,
      type: 'system',
      priority
    });
  }

  /**
   * Schedule a notification
   */
  static async scheduleNotification(
    userId: string,
    data: z.infer<typeof CreateNotificationSchema>,
    scheduledFor: Date
  ): Promise<Notification> {
    return this.create(userId, {
      ...data,
      scheduledFor
    });
  }

  /**
   * Get pending scheduled notifications
   */
  static async getPendingScheduled(): Promise<Notification[]> {
    return await (prisma as any).notification.findMany({
      where: {
        scheduledFor: {
          lte: new Date()
        },
        // Add a flag to prevent re-processing
        metadata: {
          not: {
            path: ['processed'],
            equals: true
          }
        }
      }
    });
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpired(): Promise<number> {
    const result = await (prisma as any).notification.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    return result.count;
  }
}

export default NotificationService;
