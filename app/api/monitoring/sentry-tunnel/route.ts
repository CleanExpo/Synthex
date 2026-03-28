/**
 * Sentry Tunnel Route — SYN-489
 *
 * Proxies Sentry client events through our own domain.
 * This avoids ad-blockers that block requests to sentry.io
 * and avoids needing the @sentry/nextjs webpack plugin.
 *
 * Reference: https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
 */
import { NextRequest, NextResponse } from 'next/server';

const SENTRY_HOST = 'o4509143228317696.ingest.us.sentry.io';
const SENTRY_PROJECT_IDS = [process.env.SENTRY_PROJECT_ID || '4509143230742528'];

export async function POST(request: NextRequest) {
  try {
    const envelope = await request.text();
    const piece = envelope.split('\n')[0];
    const header = JSON.parse(piece);
    
    const dsn = new URL(header.dsn);
    const projectId = dsn.pathname.replace('/', '');
    
    if (dsn.hostname !== SENTRY_HOST) {
      return NextResponse.json(
        { error: 'Invalid Sentry host' },
        { status: 400 }
      );
    }
    
    if (!SENTRY_PROJECT_IDS.includes(projectId)) {
      return NextResponse.json(
        { error: 'Invalid Sentry project' },
        { status: 400 }
      );
    }
    
    const sentryUrl = `https://${SENTRY_HOST}/api/${projectId}/envelope/`;
    
    const response = await fetch(sentryUrl, {
      method: 'POST',
      body: envelope,
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
      },
    });
    
    return NextResponse.json(
      { status: 'ok' },
      { status: response.ok ? 200 : 500 }
    );
  } catch (error) {
    console.error('[Sentry Tunnel] Error proxying envelope:', error);
    return NextResponse.json(
      { error: 'Tunnel error' },
      { status: 500 }
    );
  }
}
