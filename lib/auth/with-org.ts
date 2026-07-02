/**
 * withOrg() — single fail-closed, org-scoped API route guard (WS2 foundation)
 *
 * The codebase currently has two auth helpers:
 *   - the legacy `getUserIdFromRequestOrCookies` (used directly by ~300 routes)
 *   - `withAuth` (used by ~70 routes), which resolves a full AuthContext.
 *
 * `withOrg` is the single org-scoped guard we are converging on. It returns an
 * explicit OrgContext — the authenticated user plus their *resolved active
 * organisation* — and FAILS CLOSED at every ambiguous step:
 *
 *   - no session                 → 401
 *   - no resolvable active org    → 403  (never a silent fall-through)
 *   - unknown / corrupt role      → 'collaborator' (least privilege, via resolveRole)
 *
 * It reuses the same authentication + role resolution as `withAuth` so the two
 * cannot drift; the difference is the ergonomics of the injected context
 * (`org` object + `actingAsOwner` boolean) and the explicit fail-closed contract
 * documented and tested here. This is the FOUNDATION only — routes are migrated
 * incrementally (see the reference migration in this PR), not en masse.
 *
 * @task WS2
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { resolveRole } from '@/lib/auth/with-auth';

/** Org-scoped context injected into every withOrg() route handler. */
export interface OrgContext {
  /** Supabase / Prisma user ID. */
  userId: string;
  /** Resolved active organisation. */
  org: {
    /** Organisation ID. */
    id: string;
  };
  /**
   * Resolved role, fail-closed. 'owner' only for the direct org creator or an
   * explicit owner membership row; everything ambiguous resolves to
   * 'collaborator'.
   */
  role: 'owner' | 'collaborator';
  /** Convenience flag — true iff role === 'owner'. */
  actingAsOwner: boolean;
}

type OrgRouteHandler = (
  request: NextRequest,
  ctx: OrgContext
) => Promise<NextResponse>;

/**
 * Wrap an API route handler with fail-closed, org-scoped auth.
 *
 * @example
 * export const GET = withOrg(async (request, { userId, org, role }) => {
 *   const data = await prisma.thing.findMany({ where: { organizationId: org.id } });
 *   return NextResponse.json({ data });
 * });
 */
export function withOrg(handler: OrgRouteHandler) {
  return async function (request: NextRequest): Promise<NextResponse> {
    // 1. Authenticate.
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Resolve the active org + accepted memberships in one query.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationId: true,
        teamMemberships: {
          where: { acceptedAt: { not: null } },
          select: { role: true, organizationId: true },
        },
      },
    });

    // FAIL CLOSED: no resolvable active org → deny. Never default to an org.
    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'No organisation found' },
        { status: 403 }
      );
    }

    const orgId = user.organizationId;

    // 3. Resolve role, fail-closed (shared with withAuth via resolveRole).
    const membership = user.teamMemberships.find(
      (m) => m.organizationId === orgId
    );
    const role = resolveRole(membership?.role);

    return handler(request, {
      userId,
      org: { id: orgId },
      role,
      actingAsOwner: role === 'owner',
    });
  };
}
