/**
 * Client CRM rollup (backlog #3, Unify CRM primitives) — read-only.
 *
 *   GET /api/clients/[clientId]/crm
 *     → the caller-org's CRM footprint for one soft client id, unified from the
 *       existing primitive tables:
 *         { clientId, contacts, leads, healthScore, recentEngagement }
 *
 * `clientId` is the SOFT reference to a Supabase `clients.id` carried by each
 * primitive (the same id `/api/clients` manages). This is the "unified detail
 * from existing tables" half of #3 — it reads, it never writes, and it adds no
 * schema; the underlying rows already exist.
 *
 * ORG ISOLATION (the whole point of this route):
 *   - Contact / Lead / ClientHealthScore are filtered by `organizationId` AND the
 *     soft `clientId`, so a client id from another org returns empty — no leak.
 *   - ClientEngagementEvent is the odd one out: its own `clientId` column is the
 *     Organization.id (not a clients.id), and the CRM link lives in `crmClientId`.
 *     So it is scoped by `clientId = <caller org>` AND `crmClientId = <param>`.
 *   - DealDeliverable is intentionally excluded: it has no `organizationId` (it is
 *     scoped only through its parent SponsorDeal), so org-safe inclusion needs a
 *     join — deferred to a follow-up slice rather than risk a cross-org read.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/** Resolve the caller's organisation, or the HTTP response to return. */
async function resolveOrg(
  request: NextRequest
): Promise<{ organizationId: string } | { error: NextResponse }> {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return {
      error: NextResponse.json(
        { error: 'No organisation found' },
        { status: 403 }
      ),
    };
  }

  return { organizationId: user.organizationId };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const auth = await resolveOrg(request);
    if ('error' in auth) return auth.error;
    const { organizationId } = auth;
    const { clientId } = await params;

    const [contacts, leads, healthScore, recentEngagement] = await Promise.all([
      prisma.contact.findMany({
        where: { organizationId, clientId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          createdAt: true,
        },
      }),
      prisma.lead.findMany({
        where: { organizationId, clientId },
        orderBy: { occurredAt: 'desc' },
        take: 50,
        select: {
          id: true,
          stage: true,
          source: true,
          medium: true,
          occurredAt: true,
          revenueEstimateAud: true,
          verifiedRevenueAud: true,
          createdAt: true,
        },
      }),
      prisma.clientHealthScore.findFirst({
        where: { organizationId, clientId },
        orderBy: { weekStart: 'desc' },
        select: {
          id: true,
          weekStart: true,
          overallScore: true,
          scoreDelta: true,
          riskLevel: true,
        },
      }),
      // crmClientId is the clients.id link; clientId is the Organization.id.
      prisma.clientEngagementEvent.findMany({
        where: { clientId: organizationId, crmClientId: clientId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          eventType: true,
          pagePath: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      clientId,
      contacts,
      leads,
      healthScore,
      recentEngagement,
    });
  } catch (error) {
    logger.error('clients: crm rollup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
