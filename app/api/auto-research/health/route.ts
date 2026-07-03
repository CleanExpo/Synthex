/**
 * Auto-Research Loop Health API (SYN-1025)
 *
 * GET /api/auto-research/health           — ok/warn/fail snapshot of the loop
 * GET /api/auto-research/health?dryRun=true — also runs an Obsidian writeback
 *                                             round-trip for the caller's org
 *
 * Auth-gated and org-scoped. Returns no secret values — only presence/status.
 *
 * @module app/api/auto-research/health/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import {
  getResearchLoopHealth,
  verifyObsidianWriteback,
  type HealthCheckResult,
} from '@/lib/auto-research/health';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const orgId = (await getEffectiveOrganizationId(userId)) ?? undefined;
    const health = await getResearchLoopHealth(orgId);

    let writeback: HealthCheckResult | undefined;
    if (request.nextUrl.searchParams.get('dryRun') === 'true') {
      writeback = await verifyObsidianWriteback(orgId ?? '');
    }

    return NextResponse.json({
      ...health,
      ...(writeback ? { writeback } : {}),
    });
  } catch (error) {
    logger.error(
      '[auto-research/health] check failed',
      error instanceof Error ? error : undefined
    );
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
