/**
 * Credential coverage API (SYN-1023) — per-client, read-only, secret-free.
 *
 * GET /api/credential-coverage
 *   Returns this org's credential-reference coverage: each mapped account is
 *   connected_oauth | reference_only | missing, plus totals. Scoped to the
 *   caller's effective organization, so a client only ever sees its own
 *   accounts. Reads platform names + vault slugs only — never a secret value.
 *
 * AUTH: cookie-based JWT (getUserIdFromRequestOrCookies); org-scoped via
 * getEffectiveOrganizationId. Mirrors app/api/integrations/route.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { coverageForOrg } from '@/lib/credential-intake/credential-coverage';
import { logger } from '@/lib/logger';

const EMPTY_REPORT = {
  rows: [],
  totals: { connected_oauth: 0, reference_only: 0, missing: 0 },
};

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No active organization' },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });
    // An org with no slug has no inventory mapping — return an empty report
    // rather than erroring, so the UI shows "no mapped accounts" cleanly.
    if (!org?.slug) {
      return NextResponse.json({ report: EMPTY_REPORT });
    }

    const [connections, secrets] = await Promise.all([
      prisma.platformConnection.findMany({
        where: { organizationId, isActive: true, deletedAt: null },
        select: { platform: true },
      }),
      prisma.vaultSecret.findMany({
        where: { organizationId, isActive: true },
        select: { slug: true },
      }),
    ]);

    const report = coverageForOrg(
      org.slug,
      connections.map(c => c.platform),
      secrets.map(s => s.slug)
    );

    return NextResponse.json({ report });
  } catch (err) {
    logger.error('credential coverage failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
