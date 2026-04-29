/**
 * GBP OAuth Bearer Refresh Cron — SYN-844
 *
 * POST /api/cron/dr-gbp-oauth-refresh
 * Runs every 50 minutes via Vercel Cron (DR_GBP_OAUTH_BEARER lasts 60).
 *
 * Workflow:
 *   1. Authenticate via verifyCronRequest (per-route CRON_SECRET scope)
 *   2. Read DR_GBP_OAUTH_REFRESH_TOKEN + client creds + Vercel API creds from env
 *   3. POST to Google OAuth token endpoint → access_token
 *   4. PATCH the Vercel env var DR_GBP_OAUTH_BEARER with the new value
 *   5. Return JSON summary (no plaintext bearer ever in response or logs)
 *
 * @module app/api/cron/dr-gbp-oauth-refresh/route
 * @see SYN-844 (parent: SYN-834 epic)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { refreshGbpBearer } from '@/lib/gbp/oauth-refresh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const REQUIRED_ENV = [
  'DR_GBP_OAUTH_CLIENT_ID',
  'DR_GBP_OAUTH_CLIENT_SECRET',
  'DR_GBP_OAUTH_REFRESH_TOKEN',
  'VERCEL_TOKEN',
  'VERCEL_PROJECT_ID',
] as const;

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'DR_GBP_OAUTH_REFRESH');
  if (!auth.ok) return auth.response;

  const sourceOfTruthJobId = `gbp-oauth-refresh-${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}`;

  // Validate required env upfront — fail loud, don't half-execute
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length > 0) {
    logger.error('[gbp.oauth-refresh.cron] missing required env', {
      sourceOfTruthJobId,
      missing,
    });
    return NextResponse.json(
      { ok: false, reason: `missing env: ${missing.join(', ')}` },
      { status: 500 }
    );
  }

  try {
    const result = await refreshGbpBearer({
      sourceOfTruthJobId,
      clientId: process.env.DR_GBP_OAUTH_CLIENT_ID!,
      clientSecret: process.env.DR_GBP_OAUTH_CLIENT_SECRET!,
      refreshToken: process.env.DR_GBP_OAUTH_REFRESH_TOKEN!,
      vercelToken: process.env.VERCEL_TOKEN!,
      vercelProjectId: process.env.VERCEL_PROJECT_ID!,
      vercelTeamId: process.env.VERCEL_TEAM_ID,
    });

    if (!result.ok) {
      logger.error('[gbp.oauth-refresh.cron] refresh failed', {
        sourceOfTruthJobId,
        reason: result.reason,
      });
      return NextResponse.json(
        {
          ok: false,
          sourceOfTruthJobId,
          reason: result.reason,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      sourceOfTruthJobId,
      bearerSummary: result.bearerSummary,
      expiresInSec: result.expiresInSec,
      vercelEnvId: result.vercelEnvId,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error('[gbp.oauth-refresh.cron] unexpected error', {
      sourceOfTruthJobId,
      reason,
    });
    return NextResponse.json(
      { ok: false, sourceOfTruthJobId, reason },
      { status: 500 }
    );
  }
}

// Allow GET for Vercel Cron's default verb. Same handler.
export const GET = POST;
