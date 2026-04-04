/**
 * Notification Service
 *
 * Handles user notifications with support for scheduling, priorities, and platform events.
 * Uses the Prisma Notification model with extra data stored in the JSON `data` field.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 *
 * @module src/services/notification
 */

import { type Notification } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';

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

// Extended notification type with data fields
export interface NotificationData {
  priority?: 'low' | 'medium' | 'high' | 'critical';
  actionUrl?: string;
  actionText?: string;
  metadata?: Record<string, unknown>;
  scheduledFor?: string;
  expiresAt?: string;
  archived?: boolean;
  processed?: boolean;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  recent: number;
}

// Re-export the Prisma type
export type { Notification };

export class NotificationService {
  /**
   * Create a new notification
   */
  static async create(
    userId: string,
    input: z.infer<typeof CreateNotificationSchema>
  ): Promise<Notification> {
    const validated = CreateNotificationSchema.parse(input);

    const notificationData: NotificationData = {
      priority: validated.priority || 'medium',
      actionUrl: validated.actionUrl,
      actionText: validated.actionText,
      metadata: validated.metadata || null,
      scheduledFor: validated.scheduledFor?.toISOString(),
      expiresAt: validated.expiresAt?.toISOString(),
      archived: false
    };

    return await prisma.notification.create({
      data: {
        userId,
        title: validated.title,
        message: validated.message,
        type: validated.type,
        data: notificationData as any
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

    // Build where clause
    const where: any = { userId };
    if (validated.type) where.type = validated.type;
    if (validated.read !== undefined) where.read = validated.read;

    // Get all notifications first, then filter by data fields
    let notifications = await prisma.notification.findMany({
      where,
      orderBy: validated.sortBy === 'priority'
        ? { createdAt: validated.sortOrder } // Sort by createdAt as fallback
        : { [validated.sortBy]: validated.sortOrder }
    });

    const now = new Date();

    // Filter by scheduledFor and expiresAt from data field
    notifications = notifications.filter(n => {
      const data = n.data as NotificationData | null;

      // Filter out archived
      if (data?.archived) return false;

      // Filter by priority if specified
      if (validated.priority && data?.priority !== validated.priority) return false;

      // Filter by scheduledFor
      if (data?.scheduledFor && new Date(data.scheduledFor) > now) return false;

      // Filter out expired
      if (data?.expiresAt && new Date(data.expiresAt) < now) return false;

      return true;
    });

    // Sort by priority if requested
    if (validated.sortBy === 'priority') {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      notifications.sort((a, b) => {
        const aPriority = (a.data as NotificationData)?.priority || 'medium';
        const bPriority = (b.data as NotificationData)?.priority || 'medium';
        const diff = priorityOrder[bPriority] - priorityOrder[aPriority];
        return validated.sortOrder === 'desc' ? diff : -diff;
      });
    }

    const total = notifications.length;

    // Apply pagination
    const paginatedNotifications = notifications.slice(skip, skip + validated.limit);

    // Get stats
    const stats = await this.getStats(userId);

    return { notifications: paginatedNotifications, total, stats };
  }

  /**
   * Get notification statistics for a user
   */
  static async getStats(userId: string): Promise<NotificationStats> {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      select: {
        type: true,
        data: true,
        read: true,
        createdAt: true
      }
    });

    const now = new Date();

    // Filter valid notifications
    const validNotifications = notifications.filter(n => {
      const data = n.data as NotificationData | null;
      if (data?.archived) return false;
      if (data?.scheduledFor && new Date(data.scheduledFor) > now) return false;
      if (data?.expiresAt && new Date(data.expiresAt) < now) return false;
      return true;
    });

    const total = validNotifications.length;
    const unread = validNotifications.filter(n => !n.read).length;

    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    validNotifications.forEach(notification => {
      byType[notification.type] = (byType[notification.type] || 0) + 1;
      const priority = (notification.data as NotificationData)?.priority || 'medium';
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    });

    // Recent notifications (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recent = validNotifications.filter(n => n.createdAt > yesterday).length;

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
    return await prisma.notification.findFirst({
      where: { id, userId }
    });
  }

  /**
   * Update notification (mark as read, archive, etc.)
   */
  static async update(
    id: string,
    userId: string,
    input: z.infer<typeof UpdateNotificationSchema>
  ): Promise<Notification> {
    const validated = UpdateNotificationSchema.parse(input);

    // Verify ownership
    const existing = await prisma.notification.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      throw new Error('Notification not found');
    }

    const currentData = (existing.data as NotificationData) || {};
    const updatePayload: any = {};

    if (validated.read !== undefined) {
      updatePayload.read = validated.read;
    }

    if (validated.archived !== undefined) {
      updatePayload.data = {
        ...currentData,
        archived: validated.archived
      };
    }

    return await prisma.notification.update({
      where: { id },
      data: updatePayload
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
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
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
    const existing = await prisma.notification.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      throw new Error('Notification not found');
    }

    await prisma.notification.delete({
      where: { id }
    });
  }

  /**
   * Delete all archived notifications
   */
  static async deleteArchived(userId: string): Promise<number> {
    // Get all archived notifications first
    const notifications = await prisma.notification.findMany({
      where: { userId },
      select: { id: true, data: true }
    });

    const archivedIds = notifications
      .filter(n => (n.data as NotificationData)?.archived)
      .map(n => n.id);

    if (archivedIds.length === 0) return 0;

    const result = await prisma.notification.deleteMany({
      where: { id: { in: archivedIds } }
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
    details?: Record<string, unknown>
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
    } else {
      title = `${platform} ${action}`;
      message = success ? `${action} completed successfully` : `${action} failed`;
      type = success ? 'info' : 'error';
    }

    return this.create(userId, {
      title,
      message,
      type: 'platform',
      priority: type === 'error' ? 'high' : 'medium',
      metadata: {
        platform,
        action,
        success,
        ...details
      },
      actionUrl: success && details?.url ? String(details.url) : undefined,
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
    const now = new Date();
    const notifications = await prisma.notification.findMany({});

    return notifications.filter(n => {
      const data = n.data as NotificationData | null;
      if (!data?.scheduledFor) return false;
      if (data.processed) return false;
      return new Date(data.scheduledFor) <= now;
    });
  }

  /**
   * Mark notification as processed (for scheduled notifications)
   */
  static async markAsProcessed(id: string): Promise<Notification> {
    const existing = await prisma.notification.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new Error('Notification not found');
    }

    const currentData = (existing.data as NotificationData) || {};

    return await prisma.notification.update({
      where: { id },
      data: {
        data: JSON.parse(JSON.stringify({
          ...currentData,
          processed: true
        }))
      }
    });
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpired(): Promise<number> {
    const now = new Date();
    const notifications = await prisma.notification.findMany({
      select: { id: true, data: true }
    });

    const expiredIds = notifications
      .filter(n => {
        const data = n.data as NotificationData | null;
        return data?.expiresAt && new Date(data.expiresAt) < now;
      })
      .map(n => n.id);

    if (expiredIds.length === 0) return 0;

    const result = await prisma.notification.deleteMany({
      where: { id: { in: expiredIds } }
    });

    return result.count;
  }
}

export default NotificationService;
