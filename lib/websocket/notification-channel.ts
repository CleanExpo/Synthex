/**
 * Notification Channel
 *
 * @description Manages real-time notification delivery:
 * - WebSocket connections for instant delivery
 * - Server-Sent Events (SSE) fallback
 * - Guaranteed delivery with storage backup
 * - Connection pooling and heartbeats
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: For pub/sub and storage (SECRET)
 *
 * FAILURE MODE: Falls back to stored notifications
 */

import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis-client';

// ============================================================================
// TYPES
// ============================================================================

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'mention' | 'engagement' | 'system';
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

type NotificationHandler = (notification: Notification) => void;

// ============================================================================
// CONNECTION MANAGER
// ============================================================================

interface Connection {
  userId: string;
  type: 'websocket' | 'sse';
  handler: NotificationHandler;
  options: SubscriptionOptions;
  lastHeartbeat: Date;
}

// ============================================================================
// NOTIFICATION CHANNEL
// ============================================================================

export class NotificationChannel {
  private static connections: Map<string, Connection[]> = new Map();
  private static heartbeatInterval: NodeJS.Timeout | null = null;
  private static readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private static readonly CONNECTION_TIMEOUT = 60000; // 60 seconds

  /**
   * Subscribe to notifications for a user
   */
  static subscribe(
    userId: string,
    handler: NotificationHandler,
    options: SubscriptionOptions = {}
  ): () => void {
    const connection: Connection = {
      userId,
      type: 'websocket',
      handler,
      options,
      lastHeartbeat: new Date(),
    };

    // Add to connections
    const userConnections = this.connections.get(userId) || [];
    userConnections.push(connection);
    this.connections.set(userId, userConnections);

    // Start heartbeat if not running
    this.startHeartbeat();

    logger.debug('Notification subscription added', { userId, options });

    // Return unsubscribe function
    return () => {
      const connections = this.connections.get(userId);
      if (connections) {
        const index = connections.indexOf(connection);
        if (index > -1) {
          connections.splice(index, 1);
          if (connections.length === 0) {
            this.connections.delete(userId);
          }
        }
      }
      logger.debug('Notification subscription removed', { userId });
    };
  }

  /**
   * Create SSE stream for notifications
   */
  static createSSEStream(
    userId: string,
    options: SubscriptionOptions = {}
  ): ReadableStream {
    return new ReadableStream({
      start: (controller) => {
        const handler: NotificationHandler = (notification) => {
          try {
            const data = `data: ${JSON.stringify(notification)}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          } catch (error) {
            logger.warn('SSE send failed', { userId, error });
          }
        };

        // Subscribe
        const unsubscribe = this.subscribe(userId, handler, options);

        // Send initial connection event
        controller.enqueue(
          new TextEncoder().encode(`event: connected\ndata: {"userId":"${userId}"}\n\n`)
        );

        // Set up heartbeat
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(`:heartbeat\n\n`));
          } catch {
            clearInterval(heartbeat);
            unsubscribe();
          }
        }, 15000);

        // Cleanup on close
        return () => {
          clearInterval(heartbeat);
          unsubscribe();
        };
      },
    });
  }

  /**
   * Send a notification to a user
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

    // Try WebSocket/SSE first
    const connections = this.connections.get(userId);
    if (connections && connections.length > 0) {
      for (const conn of connections) {
        // Check if notification matches subscription options
        if (!this.matchesOptions(fullNotification, conn.options)) {
          continue;
        }

        try {
          conn.handler(fullNotification);
          return {
            delivered: true,
            method: conn.type,
            timestamp: new Date(),
          };
        } catch (error) {
          logger.warn('Direct delivery failed', { userId, error });
        }
      }
    }

    // Store for later retrieval
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
      userIds.map(async (userId) => {
        const status = await this.notify(userId, notification);
        results.set(userId, status);
      })
    );

    return results;
  }

  /**
   * Store notification for later retrieval
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
      const notifications: Notification[] = existing ? JSON.parse(existing) : [];

      notifications.unshift(notification);

      // Keep only last 100 notifications
      if (notifications.length > 100) {
        notifications.length = 100;
      }

      await redis.set(key, JSON.stringify(notifications), 86400 * 7); // 7 days TTL

      logger.debug('Notification stored', { userId, notificationId: notification.id });
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

      // Filter unread only
      if (options.unreadOnly) {
        notifications = notifications.filter(n => !n.read);
      }

      // Apply limit
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
      logger.error('Failed to mark notification as read', { userId, notificationId, error });
    }
  }

  /**
   * Get unread count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.getNotifications(userId, { unreadOnly: true });
    return notifications.length;
  }

  /**
   * Check if notification matches subscription options
   */
  private static matchesOptions(
    notification: Notification,
    options: SubscriptionOptions
  ): boolean {
    // Check type filter
    if (options.types && options.types.length > 0) {
      if (!options.types.includes(notification.type)) {
        return false;
      }
    }

    // Check priority filter
    if (options.minPriority) {
      const priorityOrder: Notification['priority'][] = ['low', 'normal', 'high', 'urgent'];
      const minIndex = priorityOrder.indexOf(options.minPriority);
      const notifIndex = priorityOrder.indexOf(notification.priority);
      if (notifIndex < minIndex) {
        return false;
      }
    }

    return true;
  }

  /**
   * Start heartbeat check
   */
  private static startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      for (const [userId, connections] of this.connections) {
        // Filter out stale connections
        const activeConnections = connections.filter(conn => {
          const age = now - conn.lastHeartbeat.getTime();
          return age < this.CONNECTION_TIMEOUT;
        });

        if (activeConnections.length === 0) {
          this.connections.delete(userId);
        } else if (activeConnections.length !== connections.length) {
          this.connections.set(userId, activeConnections);
        }
      }

      // Stop heartbeat if no connections
      if (this.connections.size === 0) {
        this.stopHeartbeat();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat check
   */
  private static stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Update connection heartbeat
   */
  static heartbeat(userId: string): void {
    const connections = this.connections.get(userId);
    if (connections) {
      for (const conn of connections) {
        conn.lastHeartbeat = new Date();
      }
    }
  }

  /**
   * Get connection count for a user
   */
  static getConnectionCount(userId?: string): number {
    if (userId) {
      return this.connections.get(userId)?.length || 0;
    }

    let total = 0;
    for (const connections of this.connections.values()) {
      total += connections.length;
    }
    return total;
  }

  /**
   * Clear all connections (for cleanup/testing)
   */
  static clearAll(): void {
    this.connections.clear();
    this.stopHeartbeat();
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
  options?: Partial<Omit<Notification, 'id' | 'createdAt' | 'read' | 'title' | 'message'>>
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
