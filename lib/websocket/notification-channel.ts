/**
 * Notification Channel
 *
 * @description Manages notification delivery via Redis-backed storage.
 * Clients poll /api/notifications at regular intervals to receive notifications.
 * This is reliable in serverless environments (Vercel Lambda) — the previous
 * in-memory connection Map was silently broken because each Lambda invocation
 * has its own isolated memory.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: For notification storage (SECRET)
 *
 * FAILURE MODE: Falls back to graceful no-op with error logging
 */

import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis-client';

// ============================================================================
// TYPES
// ============================================================================

export interface Notification {
  id: string;
  type:
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
    | 'mention'
    | 'engagement'
    | 'system';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: Date;
  expiresAt?: Date;
  read: boolean;
  actionUrl?: string;
}

export interface DeliveryStatus {
  delivered: boolean;
  method: 'websocket' | 'sse' | 'stored' | 'failed';
  timestamp: Date;
  error?: string;
}

export interface SubscriptionOptions {
  types?: Notification['type'][];
  minPriority?: Notification['priority'];
}

// ============================================================================
// NOTIFICATION CHANNEL
// ============================================================================

export class NotificationChannel {
  /**
   * Send a notification to a user.
   * Always stores in Redis for client polling — no in-memory delivery attempt.
   */
  static async notify(
    userId: string,
    notification: Omit<Notification, 'id' | 'createdAt' | 'read'>
  ): Promise<DeliveryStatus> {
    const fullNotification: Notification = {
      ...notification,
      id: `notif-${crypto.randomUUID()}`,
      createdAt: new Date(),
      read: false,
    };

    await this.storeNotification(userId, fullNotification);

    return {
      delivered: true,
      method: 'stored',
      timestamp: new Date(),
    };
  }

  /**
   * Send notification to multiple users
   */
  static async broadcast(
    userIds: string[],
    notification: Omit<Notification, 'id' | 'createdAt' | 'read'>
  ): Promise<Map<string, DeliveryStatus>> {
    const results = new Map<string, DeliveryStatus>();

    await Promise.all(
      userIds.map(async userId => {
        const status = await this.notify(userId, notification);
        results.set(userId, status);
      })
    );

    return results;
  }

  /**
   * Store notification in Redis for client polling retrieval
   */
  private static async storeNotification(
    userId: string,
    notification: Notification
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = `notifications:${userId}`;

      // Add to list
      const existing = await redis.get(key);
      const notifications: Notification[] = existing
        ? JSON.parse(existing)
        : [];

      notifications.unshift(notification);

      // Keep only last 100 notifications
      if (notifications.length > 100) {
        notifications.length = 100;
      }

      await redis.set(key, JSON.stringify(notifications), 86400 * 7); // 7 days TTL

      logger.debug('Notification stored', {
        userId,
        notificationId: notification.id,
      });
    } catch (error) {
      logger.error('Failed to store notification', { userId, error });
    }
  }

  /**
   * Get stored notifications for a user
   */
  static async getNotifications(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number } = {}
  ): Promise<Notification[]> {
    try {
      const redis = getRedisClient();
      const key = `notifications:${userId}`;

      const data = await redis.get(key);
      if (!data) return [];

      let notifications: Notification[] = JSON.parse(data);

      if (options.unreadOnly) {
        notifications = notifications.filter(n => !n.read);
      }

      if (options.limit) {
        notifications = notifications.slice(0, options.limit);
      }

      return notifications;
    } catch (error) {
      logger.error('Failed to get notifications', { userId, error });
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(
    userId: string,
    notificationId: string | 'all'
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = `notifications:${userId}`;

      const data = await redis.get(key);
      if (!data) return;

      const notifications: Notification[] = JSON.parse(data);

      if (notificationId === 'all') {
        for (const n of notifications) {
          n.read = true;
        }
      } else {
        const notification = notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.read = true;
        }
      }

      await redis.set(key, JSON.stringify(notifications), 86400 * 7);
    } catch (error) {
      logger.error('Failed to mark notification as read', {
        userId,
        notificationId,
        error,
      });
    }
  }

  /**
   * Get unread count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.getNotifications(userId, {
      unreadOnly: true,
    });
    return notifications.length;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Send a simple notification
 */
export async function sendNotification(
  userId: string,
  title: string,
  message: string,
  options?: Partial<
    Omit<Notification, 'id' | 'createdAt' | 'read' | 'title' | 'message'>
  >
): Promise<DeliveryStatus> {
  return NotificationChannel.notify(userId, {
    type: options?.type || 'info',
    title,
    message,
    priority: options?.priority || 'normal',
    ...options,
  });
}

/**
 * Send an engagement notification
 */
export async function sendEngagementNotification(
  userId: string,
  platform: string,
  metric: string,
  count: number
): Promise<DeliveryStatus> {
  return NotificationChannel.notify(userId, {
    type: 'engagement',
    title: `New ${metric} on ${platform}`,
    message: `You received ${count} new ${metric.toLowerCase()}`,
    priority: 'normal',
    data: { platform, metric, count },
  });
}

/**
 * Send a system notification
 */
export async function sendSystemNotification(
  userId: string,
  title: string,
  message: string,
  priority: Notification['priority'] = 'normal'
): Promise<DeliveryStatus> {
  return NotificationChannel.notify(userId, {
    type: 'system',
    title,
    message,
    priority,
  });
}

// Export default
export default NotificationChannel;
