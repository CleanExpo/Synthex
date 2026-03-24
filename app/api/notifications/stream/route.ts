/**
 * DEPRECATED: SSE Notification Stream
 *
 * This endpoint has been retired. The in-memory connection management it relied
 * on was broken in serverless environments (each Vercel Lambda invocation has
 * isolated memory, so connections registered in one instance were invisible to
 * notifications sent from another).
 *
 * Clients should poll GET /api/notifications at 5-second intervals instead.
 * The useNotifications hook already does this automatically.
 */

import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json(
    {
      error:
        'This SSE endpoint is retired. Use GET /api/notifications with polling.',
      pollingEndpoint: '/api/notifications',
    },
    { status: 410 }
  );
}

export const runtime = 'nodejs';
