/**
 * GET /api/og/effect-report?period=Q1+2026
 *
 * Generates a 1200×1200px PNG shareable card for the Effect Report for the
 * authenticated user's organisation.
 *
 * Card content: business name, headline metric, quarter label,
 * "Powered by Synthex" watermark.
 *
 * SECURITY (2026-05-16, service-role-leak triage refactor 1/N):
 *   Previously accepted `?client_id=<uuid>` and passed it straight into
 *   `.eq('client_id', clientId)` over a service-role Supabase client. That
 *   bypassed RLS and let any UNAUTHENTICATED requester fetch any tenant's
 *   Effect Report — business name, GEO score, attribution figures, reach.
 *
 *   The route now:
 *   1. Requires an authenticated session (cookie or Authorization header).
 *   2. Derives `clientId` from the authenticated user's `organizationId`
 *      via Prisma. The `client_id` query param is ignored.
 *   3. Returns 401 if no session, 403 if no org membership.
 *
 *   Runtime switched from `edge` → `nodejs` because Prisma is not edge-
 *   compatible. ImageResponse from next/og is supported on both runtimes.
 *
 *   The card data lived in the Supabase `effect_reports` table, which has no
 *   model in prisma/schema.prisma. After auth and tenant resolution the route
 *   returns 501 FEATURE_NOT_PROVISIONED instead of rendering a placeholder
 *   card that looks like a real report.
 *
 * SYN-674
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export const runtime = 'nodejs';

/**
 * Resolve the authenticated user's tenant.
 *
 * Returns `{ clientId }` on success or a `NextResponse` error (401/403) that
 * the caller must return as-is.
 */
async function resolveTenant(
  req: NextRequest
): Promise<{ clientId: string } | NextResponse> {
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );
  }
  return { clientId: user.organizationId };
}

export async function GET(req: NextRequest): Promise<Response> {
  const tenant = await resolveTenant(req);
  if (tenant instanceof NextResponse) return tenant;

  // SECURITY: clientId comes from resolveTenant() — never from the query
  // string. Any `?client_id=` param is ignored.
  return NextResponse.json(
    {
      error: 'FEATURE_NOT_PROVISIONED',
      message:
        'Effect Report cards are not available: table `effect_reports` is not provisioned.',
    },
    { status: 501 }
  );
}
