/**
 * Server-Sent Events (SSE) Notification Stream
 *
 * @description Real-time notification delivery for serverless environments
 * This endpoint provides SSE-based notifications as a fallback when
 * WebSocket connections are not available (e.g., Vercel deployment)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 * - REDIS_URL: For notification storage (SECRET)
 *
 * FAILURE MODE: Returns error response, client should retry
 */

import { NextRequest, NextResponse } from 'next/server';
import { NotificationChannel } from '@/lib/websocket/notification-channel';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

/**
 * GET /api/notifications/stream
 * Establishes an SSE connection for real-time notifications
 */
export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get user ID from centralised auth
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse subscription options from query params
    const { searchParams } = new URL(request.url);
    const typesParam = searchParams.get('types');
    const minPriority = searchParams.get('minPriority') as
      | 'low'
      | 'normal'
      | 'high'
      | 'urgent'
      | null;

    const subscriptionOptions = {
      types: typesParam
        ? (typesParam.split(',') as Array<
            'info' | 'success' | 'warning' | 'error' | 'mention' | 'engagement' | 'system'
          >)
        : undefined,
      minPriority: minPriority || undefined,
    };

    logger.info('SSE stream opened', { userId, options: subscriptionOptions });

    // Create SSE stream using NotificationChannel
    const stream = NotificationChannel.createSSEStream(userId, subscriptionOptions);

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    logger.error('SSE stream error', { error });
    return NextResponse.json(
      { error: 'Failed to establish notification stream' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for streaming
export const runtime = 'nodejs';

// Disable body parsing for streaming
export const dynamic = 'force-dynamic';
