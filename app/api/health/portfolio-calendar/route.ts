/**
 * Portfolio calendar health
 *
 * GET /api/health/portfolio-calendar — public, read-only. Pass/fail of each
 * portfolio setup check (brand orgs, brand DNA, 10 draft short-form slots a
 * week, held brands empty, every org still in shadow mode). Returns labels and
 * booleans only, never post content.
 *
 * 200 when every check passes, 503 otherwise.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';
import { verifyPortfolioSetup } from '@/lib/marketing-calendar/portfolio-seed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.PUBLIC_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  try {
    const { ok, checks } = await verifyPortfolioSetup();
    return NextResponse.json(
      { ok, checkedAt: new Date().toISOString(), checks },
      { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    logger.error('[health/portfolio-calendar] check failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    // A failed read is not a pass.
    return NextResponse.json(
      { ok: false, error: 'Portfolio calendar check could not run' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
