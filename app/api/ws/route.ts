/**
 * @internal Server-only endpoint — not called directly by frontend UI.
 * Used by: WebSocket notification infrastructure; the frontend uses SSE via /api/notifications/stream instead.
 */

/**
 * WebSocket/Notification API Route
 *
 * @description Handles notification delivery and WebSocket info
 * - GET: Returns WebSocket connection info and server status
 * - POST: Sends notifications to users/channels
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 * - WS_URL: WebSocket server URL (PUBLIC)
 * - REDIS_URL: For notification storage (SECRET)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import {
  NotificationChannel,
  sendNotification,
  sendEngagementNotification,
  sendSystemNotification,
} from '@/lib/websocket/notification-channel';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';

// Zod schemas for validation
const NotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  actionUrl: z.string().url().optional(),
  actionText: z.string().max(50).optional(),
  persistent: z.boolean().default(false),
});

const SendNotificationSchema = z.object({
  type: z.literal('notification'),
  target: z.object({
    userId: z.string().optional(),
    channel: z.string().optional(),
    broadcast: z.boolean().optional(),
  }),
  notification: NotificationSchema,
});

const EngagementNotificationSchema = z.object({
  type: z.literal('engagement'),
  userId: z.string(),
  platform: z.string(),
  metric: z.string(),
  count: z.number().int().positive(),
});

const SystemNotificationSchema = z.object({
  type: z.literal('system'),
  target: z.object({
    userId: z.string().optional(),
    userIds: z.array(z.string()).optional(),
    broadcast: z.boolean().optional(),
  }),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

const RequestBodySchema = z.discriminatedUnion('type', [
  SendNotificationSchema,
  EngagementNotificationSchema,
  SystemNotificationSchema,
]);

/**
 * GET /api/ws
 * Returns WebSocket connection info and server status
 */
export async function GET(request: NextRequest) {
  const connectionCount = NotificationChannel.getConnectionCount();

  return NextResponse.json({
    message: 'Real-time notification service',
    status: 'operational',
    connections: {
      active: connectionCount,
    },
    endpoints: {
      websocket: {
        development: 'ws://localhost:3001/ws',
        production: process.env.NEXT_PUBLIC_WS_URL || 'wss://ws.synthex.social/ws',
      },
      sse: '/api/notifications/stream',
    },
    documentation: {
      websocket: {
        description: 'Native WebSocket for persistent connections',
        usage: 'Best for dedicated WebSocket server environments',
        client: 'useWebSocket hook from @/hooks/useWebSocket',
      },
      sse: {
        description: 'Server-Sent Events fallback for serverless',
        usage: 'Best for Vercel/serverless deployments',
        client: 'useNotifications hook from @/hooks/useNotifications',
      },
    },
    messageTypes: {
      notification: 'User-facing notifications (toast/alert)',
      update: 'Data updates for real-time sync',
      subscribe: 'Subscribe to a channel',
      unsubscribe: 'Unsubscribe from a channel',
      ping: 'Keep-alive ping',
      pong: 'Keep-alive response',
    },
  });
}

/**
 * POST /api/ws
 * Send notifications to users or channels
 */
export async function POST(request: NextRequest) {
  try {
    // Security check - require authentication for sending notifications
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get sender user ID from centralised auth
    const senderId = await getUserIdFromRequestOrCookies(request) || undefined;

    // Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const parseResult = RequestBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    let deliveryResults: Map<string, any> | { delivered: boolean; method: string } | null = null;

    switch (data.type) {
      case 'notification': {
        const { target, notification } = data;

        if (target.broadcast) {
          // Broadcast to all connected users is a privileged operation
          // For now, just send to the requesting user
          if (senderId) {
            deliveryResults = await sendNotification(
              senderId,
              notification.title,
              notification.message,
              {
                type: notification.type,
                actionUrl: notification.actionUrl,
              }
            );
          }
        } else if (target.userId) {
          deliveryResults = await sendNotification(
            target.userId,
            notification.title,
            notification.message,
            {
              type: notification.type,
              actionUrl: notification.actionUrl,
            }
          );
        } else if (target.channel) {
          // Channel-based notification would go through WebSocket server
          // For SSE, we store it for channel subscribers to poll
          logger.info('Channel notification requested', {
            channel: target.channel,
            notification: notification.title,
          });
        }
        break;
      }

      case 'engagement': {
        deliveryResults = await sendEngagementNotification(
          data.userId,
          data.platform,
          data.metric,
          data.count
        );
        break;
      }

      case 'system': {
        const { target, title, message, priority } = data;

        if (target.broadcast) {
          // System-wide broadcast (admin only in production)
          logger.warn('System broadcast requested', { title, senderId });
        } else if (target.userIds && target.userIds.length > 0) {
          deliveryResults = await NotificationChannel.broadcast(target.userIds, {
            type: 'system',
            title,
            message,
            priority,
          });
        } else if (target.userId) {
          deliveryResults = await sendSystemNotification(
            target.userId,
            title,
            message,
            priority
          );
        }
        break;
      }
    }

    // Audit log the notification send
    if (senderId) {
      await auditLogger.log({
        userId: senderId,
        action: 'notification.sent',
        resource: 'notification',
        resourceId: `notif-${Date.now()}`,
        category: 'system',
        severity: 'low',
        outcome: 'success',
        details: {
          type: data.type,
          targetType: 'type' in data && 'target' in data ? Object.keys((data as Record<string, unknown>).target as Record<string, unknown>)[0] : 'unknown',
        },
      });
    }

    logger.info('Notification sent', {
      type: data.type,
      senderId,
      delivered: deliveryResults ? true : false,
    });

    return NextResponse.json({
      success: true,
      message: 'Notification delivered',
      delivery: deliveryResults instanceof Map
        ? Object.fromEntries(deliveryResults)
        : deliveryResults,
    });
  } catch (error) {
    logger.error('Notification send error', { error });
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/ws
 * CORS preflight handler
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Node.js runtime required
export const runtime = 'nodejs';
