/**
 * withAuth() — Enhanced API route middleware for SYN-607
 *
 * Resolves a full AuthContext (userId, clientId, role) from the request
 * and injects it into the route handler. Replaces the ad-hoc `resolveOrg()`
 * helpers that were copy-pasted across advisor, team, and collaborator routes.
 *
 * Role resolution order:
 *   1. Look up the TeamMember row for userId + organizationId
 *   2. If found → use TeamMember.role ('owner' | 'collaborator')
 *   3. If not found → default to 'owner' (user directly created the org)
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

    const clientId = user.organizationId;

    // 3. Resolve role — check for an accepted TeamMember row for this org.
    //    No row = direct org owner (the user who created the organisation).
    const membership = user.teamMemberships.find(
      (m) => m.organizationId === clientId
    );
    const role: 'owner' | 'collaborator' =
      membership?.role === 'collaborator' ? 'collaborator' : 'owner';

    return handler(request, { userId, clientId, role });
  };
}
