/**
 * Unite-Hub Connection Status API
 *
 * GET  /api/unite-hub/status — owner-only: configuration state + live reachability ping
 * POST /api/unite-hub/status — owner-only: fire a test event and return latency
 *
 * Used by UniteHubWidget and the integrations settings tab to show the real-time
 * health of the Unite-Group Nexus connection.
 *
 * ENVIRONMENT VARIABLES:
 * - UNITE_HUB_API_URL: Base URL of the Unite-Group Nexus API (OPTIONAL)
 * - UNITE_HUB_API_KEY: API key for authenticating events (OPTIONAL)
 *
 * Auth: Owner-only (isOwnerEmail check) — requires DB user lookup for email.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
  forbiddenResponse,
  isOwnerEmail,
} from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Constants ─────────────────────────────────────────────────────────────────

const UNITE_HUB_URL = process.env.UNITE_HUB_API_URL;
const UNITE_HUB_KEY = process.env.UNITE_HUB_API_KEY;

/** All event types Synthex pushes to Unite-Group (sourced from UniteHubEvent union). */
const EVENT_TYPES = [
  'user.signup',
  'user.upgrade',
  'user.churn',
  'payment.received',
  'content.published',
  'campaign.started',
  'campaign.completed',
  'revenue.daily',
] as const;

// ── Auth helper ───────────────────────────────────────────────────────────────

/**
 * Verify the caller is an authenticated platform owner.
 * getUserIdFromRequestOrCookies returns userId only — we must look up the email.
 */
async function verifyOwner(request: NextRequest): Promise<
  { userId: string } | NextResponse
> {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!isOwnerEmail(user?.email)) return forbiddenResponse();

  return { userId };
}

// ── GET /api/unite-hub/status ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authResult = await verifyOwner(request);
  if (authResult instanceof NextResponse) return authResult;

  const configured = Boolean(UNITE_HUB_URL && UNITE_HUB_KEY);

  // Derive display-safe domain (no credentials)
  let domain: string | null = null;
  if (UNITE_HUB_URL) {
    try {
      domain = new URL(UNITE_HUB_URL).hostname;
    } catch {
      domain = null;
    }
  }

  // Derive the pull endpoint URL (for Unite-Group to configure)
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') ||
    'synthex.social';
  const pullEndpoint = `https://${host}/api/unite-hub`;

  // Live reachability ping (3 s timeout)
  let reachable = false;
  if (configured && UNITE_HUB_URL && UNITE_HUB_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3_000);
      try {
        const res = await fetch(`${UNITE_HUB_URL}/api/events`, {
          method: 'HEAD',
          headers: { 'x-api-key': UNITE_HUB_KEY },
          signal: controller.signal,
        });
        // Any HTTP response means the server is reachable (even 4xx)
        reachable = res.status > 0;
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Network error or timeout — not reachable
      reachable = false;
    }
  }

  return NextResponse.json({
    configured,
    reachable,
    domain,
    pullEndpoint,
    eventTypes: [...EVENT_TYPES],
  });
}

// ── POST /api/unite-hub/status ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authResult = await verifyOwner(request);
  if (authResult instanceof NextResponse) return authResult;

  if (!UNITE_HUB_URL || !UNITE_HUB_KEY) {
    return NextResponse.json(
      { success: false, error: 'Unite-Hub is not configured' },
      { status: 400 }
    );
  }

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    let statusCode: number | undefined;
    try {
      const res = await fetch(`${UNITE_HUB_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': UNITE_HUB_KEY,
        },
        body: JSON.stringify({
          type: 'synthex.ping',
          source: 'synthex',
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });
      statusCode = res.status;
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - startTime;
    const success = statusCode !== undefined && statusCode < 500;

    return NextResponse.json({ success, latencyMs, statusCode });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const message = isTimeout ? 'Connection timed out after 5s' :
      err instanceof Error ? err.message : 'Network error';

    logger.warn('[unite-hub/status] Ping failed', { error: message });

    return NextResponse.json({ success: false, latencyMs, error: message });
  }
}
