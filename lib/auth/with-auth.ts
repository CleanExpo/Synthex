/**
 * withAuth() — Enhanced API route middleware for SYN-607
 *
 * Resolves a full AuthContext (userId, clientId, role) from the request
 * and injects it into the route handler. Replaces the ad-hoc `resolveOrg()`
 * helpers that were copy-pasted across advisor, team, and collaborator routes.
 *
 * Role resolution order (fail-closed / least-privilege):
 *   1. Look up the accepted TeamMember row for userId + organizationId.
 *   2. Explicit row:
 *        - role === 'owner'        → 'owner'
 *        - role === 'collaborator' → 'collaborator'
 *        - any other/unknown role  → 'collaborator' (DENY ELEVATION — fail closed).
 *   3. No row → 'owner'. This is the *direct org creator*: org creation links the
 *      user via User.organizationId without writing a TeamMember row (see
 *      app/api/organizations/route.ts), and only invited collaborators ever get a
 *      TeamMember row (always role:'collaborator', see app/api/invite/accept).
 *      Absence of a membership row is therefore a positive ownership signal, not
 *      an unresolved state.
 *
 * SECURITY (WS2): the previous implementation defaulted ANY non-'collaborator'
 * value — including unknown/corrupt role strings on an existing membership row —
 * to 'owner'. That was a privilege-escalation path: a row whose role could not be
 * resolved was treated as owner. Unknown roles now fail closed to the least
 * privileged role. Legitimate owners (no membership row) are unaffected.
 *
 * NOTE: The simple withAuth() in lib/auth/jwt-utils.ts only passes userId.
 * This version passes the full AuthContext — use this for new routes.
 *
 * @task SYN-607
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

/** Full auth context injected into every protected route handler. */
export interface AuthContext {
  /** Supabase / Prisma user ID */
  userId: string;
  /** Organisation ID — named clientId for API-layer consistency */
  clientId: string;
  /** 'owner' if the user created/directly owns the org; 'collaborator' if invited */
  role: 'owner' | 'collaborator';
}

type RouteHandler = (
  request: NextRequest,
  auth: AuthContext
) => Promise<NextResponse>;

/**
 * Resolve the effective role from an (optional) accepted TeamMember role string,
 * fail-closed.
 *
 *   - undefined / null (no membership row) → 'owner'  (direct org creator)
 *   - 'owner'                              → 'owner'
 *   - 'collaborator'                       → 'collaborator'
 *   - anything else (unknown / corrupt)    → 'collaborator'  (DENY ELEVATION)
 *
 * Exported for unit testing. The only path that yields 'owner' from a *present*
 * row is an explicit role:'owner'; every unrecognised value is forced down to the
 * least privilege rather than up to owner.
 */
export function resolveRole(
  membershipRole: string | null | undefined
): 'owner' | 'collaborator' {
  if (membershipRole === undefined || membershipRole === null) {
    // No membership row — the direct org owner (org creation never writes a row).
    return 'owner';
  }
  if (membershipRole === 'owner') return 'owner';
  // Explicit 'collaborator' AND any unknown/corrupt role → least privilege.
  return 'collaborator';
}

/**
 * Higher-order function that wraps an API route handler with full auth resolution.
 *
 * Returns 401 if no valid session exists.
 * Returns 403 if the authenticated user has no linked organisation.
 *
 * @example
 * export const GET = withAuth(async (request, { userId, clientId, role }) => {
 *   const data = await prisma.thing.findMany({ where: { organizationId: clientId } });
 *   return NextResponse.json({ data });
 * });
 */
export function withAuth(handler: RouteHandler) {
  return async function (request: NextRequest): Promise<NextResponse> {
    // 1. Authenticate — resolve userId from cookie or Authorization header
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Resolve org and team membership in one query
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationId: true,
        organization: { select: { status: true } },
        teamMemberships: {
          where: { acceptedAt: { not: null } },
          select: { role: true, organizationId: true },
        },
      },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'No organisation found' },
        { status: 403 }
      );
    }

    // 2b. Suspended-org refusal (Track B S6'(c) offboard chokepoint): an
    //     offboarded/deleted tenant is refused on the human session plane.
    //     Response shape matches the TENANT_SUSPENDED middleware contract
    //     (lib/multi-tenant/tenant-middleware.ts).
    const orgStatus = user.organization?.status;
    if (orgStatus === 'suspended' || orgStatus === 'deleted') {
      return NextResponse.json(
        {
          error: 'Tenant suspended',
          code: 'TENANT_SUSPENDED',
          message:
            'This organization has been suspended. Please contact support.',
        },
        { status: 403 }
      );
    }

    const clientId = user.organizationId;

    // 3. Resolve role — fail closed. An accepted membership row is authoritative
    //    via its EXPLICIT role; an unknown role string fails closed to the least
    //    privileged role instead of silently becoming owner. Absence of a row is
    //    the direct-creator (owner) signal — see the resolution notes above.
    const membership = user.teamMemberships.find(
      m => m.organizationId === clientId
    );
    const role: 'owner' | 'collaborator' = resolveRole(membership?.role);

    return handler(request, { userId, clientId, role });
  };
}
