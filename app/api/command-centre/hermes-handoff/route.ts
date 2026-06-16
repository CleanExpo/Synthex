/**
 * Command Centre — Hermes handoff readiness API (SYN-1034).
 *
 * GET /api/command-centre/hermes-handoff
 * Reports live Hermes runtime/channel readiness for the Command Centre so the
 * operator view reflects real state instead of hardcoded values.
 *
 * Only presence signals (booleans + env-var names) are read — no token, webhook
 * secret, or credential value is ever read, printed, or returned.
 *
 * @module app/api/command-centre/hermes-handoff/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { buildHermesHandoffReadiness } from '@/lib/unite-command-center';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const readiness = buildHermesHandoffReadiness(process.env);

  return NextResponse.json({
    ...readiness,
    checkedAt: new Date().toISOString(),
  });
}
