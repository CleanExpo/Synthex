/**
 * Webhook Statistics Route
 *
 * @description Returns webhook system statistics
 *
 * SECURITY: Requires authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStats, retryManager } from '@/lib/webhooks';
import { logger } from '@/lib/logger';

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * GET - Get webhook system statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Basic auth check (implement proper auth)
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getStats();

    return NextResponse.json({
      success: true,
      stats: {
        queue: stats.queue,
        retries: stats.retries,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get webhook stats', { error });

    return NextResponse.json(
      { error: 'Failed to get statistics' },
      { status: 500 }
    );
  }
}

/**
 * POST - Dead letter queue operations
 */
export async function POST(request: NextRequest) {
  try {
    // Basic auth check
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (body.action === 'get_dead_letters') {
      const items = await retryManager.getDeadLetterItems(body.limit || 100);

      return NextResponse.json({
        success: true,
        items,
        count: items.length,
      });
    }

    if (body.action === 'retry_dead_letter' && body.eventId) {
      const result = await retryManager.retryDeadLetterItem(body.eventId);

      return NextResponse.json({
        success: result,
        message: result ? 'Event queued for retry' : 'Event not found',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('Dead letter operation failed', { error });

    return NextResponse.json(
      { error: 'Operation failed' },
      { status: 500 }
    );
  }
}
