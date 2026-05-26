/**
 * Agency API access — auth + optional RBAC (SYN-971)
 *
 * Pattern: JWT/session via getUserIdFromRequestOrCookies, org via business-scope.
 * When the user has org roles assigned, PermissionEngine gates apply.
 * When no roles exist (legacy orgs), org membership alone is sufficient.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserIdFromRequestOrCookies,
  isOwnerEmail,
} from '@/lib/auth/jwt-utils';
import {
  PermissionEngine,
  type ActionType,
  type ResourceType,
} from '@/lib/auth/rbac/permission-engine';
import {
  getEffectiveQueryFilter,
  getEffectiveOrganizationId,
} from '@/lib/multi-business/business-scope';
import prisma from '@/lib/prisma';

export type AgencyPermissionCheck = {
  resource: ResourceType;
  action: ActionType;
};

/** CEO batched-review queue — view workflows awaiting approval */
export const AGENCY_CEO_QUEUE_READ: AgencyPermissionCheck[] = [
  { resource: 'posts', action: 'approve' },
  { resource: 'campaigns', action: 'manage' },
];

/** Tier-1 weekly snapshot — read latest report */
export const AGENCY_TIER1_READ: AgencyPermissionCheck = {
  resource: 'analytics',
  action: 'read',
};

/** Tier-1 weekly snapshot — generate on demand (executive) */
export const AGENCY_TIER1_WRITE: AgencyPermissionCheck[] = [
  { resource: 'analytics', action: 'export' },
  { resource: 'organization', action: 'manage' },
];

export type AgencyOrgContext = {
  userId: string;
  organizationId: string;
};

export async function requireAgencyOrg(
  request: NextRequest
): Promise<AgencyOrgContext | NextResponse> {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }

  const scopeFilter = await getEffectiveQueryFilter(userId);
  const organizationId =
    typeof scopeFilter.organizationId === 'string'
      ? scopeFilter.organizationId
      : await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Organisation context required' },
      { status: 403 }
    );
  }

  return { userId, organizationId };
}

/**
 * When user has RBAC roles in the org, require any of the listed permissions.
 * Owners (OWNER_EMAILS) always pass. No roles → pass (legacy org-scoped access).
 */
export async function enforceAgencyPermission(
  userId: string,
  organizationId: string,
  checks: AgencyPermissionCheck[]
): Promise<NextResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (user?.email && isOwnerEmail(user.email)) {
    return null;
  }

  const userPerms = await PermissionEngine.getUserPermissions(
    userId,
    organizationId
  );

  if (!userPerms) {
    return null;
  }

  const allowed = await PermissionEngine.checkAny(
    userId,
    organizationId,
    checks
  );

  if (!allowed) {
    const needed = checks.map(c => `${c.resource}:${c.action}`).join(' or ');
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: `Insufficient permissions (requires ${needed})`,
      },
      { status: 403 }
    );
  }

  return null;
}
