/**
 * Business Scope Utilities
 *
 * Determines the effective organization context for data queries.
 * Handles scoping for both regular users and multi-business owners.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * None - Uses shared database connection from @/lib/prisma
 *
 * FAILURE MODE: Returns null for no context, throws for database errors
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { EffectiveQueryFilter } from './types';

/**
 * Get the effective organization ID for a user's current context
 *
 * Logic:
 * - Multi-business owner, active org == home org → returns it (no extra query)
 * - Multi-business owner, active org is an OVERRIDE → returns it only after
 *   re-verifying active ownership (SYN-1104); otherwise falls back to home org
 * - Regular user with organizationId → returns organizationId
 * - No organization context → returns null
 *
 * @param userId - The user ID
 * @returns The effective organization ID or null if no context
 */
/**
 * Track B S6'(f) — suspended-org refusal at the single resolver behind the
 * ~144-route publish/generation surface. Offboarded (suspended/deleted)
 * organizations resolve to null; callers already handle null as
 * "No organisation found". A MISSING org row still resolves (data-integrity
 * anomaly, not suspension) so pre-existing tenants are never locked out by
 * this gate. NOTE: this function must never be used for provisioning/offboard
 * AUTHZ decisions (spec criterion 16) — it reads activeOrganizationId without
 * re-verifying ownership.
 */
async function refuseSuspendedOrg(
  organizationId: string,
  userId: string
): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { status: true },
  });
  if (org && (org.status === 'suspended' || org.status === 'deleted')) {
    logger.warn('Refusing suspended organization context', {
      userId,
      organizationId,
    });
    return null;
  }
  return organizationId;
}

/**
 * SYN-1104 — re-verify a multi-business owner is still an active owner of an
 * OVERRIDE active-organization pointer.
 *
 * Mirrors the ownership check in {@link getEffectiveQueryFilter} and is the
 * exact inverse of the SET path (`setActiveOrganization` /
 * `PATCH /api/businesses/switch`), which persist `activeOrganizationId` only
 * after validating an active `BusinessOwnership`. A single indexed lookup —
 * called ONLY on the override cold path, never for the common home-org case.
 *
 * Fail-safe: a check error returns `false` so the caller falls back to the
 * home org, never to the unverified override.
 */
async function isActiveOwnerOfOrg(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const ownership = await prisma.businessOwnership.findUnique({
      where: {
        ownerId_organizationId: {
          ownerId: userId,
          organizationId,
        },
      },
      select: { isActive: true },
    });
    return Boolean(ownership?.isActive);
  } catch (error) {
    logger.error(
      'Active-org membership re-verification failed; treating as non-member',
      {
        userId,
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    );
    return false;
  }
}

export async function getEffectiveOrganizationId(
  userId: string
): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isMultiBusinessOwner: true,
        activeOrganizationId: true,
        organizationId: true,
      },
    });

    if (!user) {
      logger.warn('User not found for effective organization lookup', {
        userId,
      });
      return null;
    }

    // Multi-business owner: use their active organization if set.
    if (user.isMultiBusinessOwner && user.activeOrganizationId) {
      // Common case — the active org IS the user's home org. Membership is
      // implied by the user row, so NO extra query is needed (hot path).
      if (user.activeOrganizationId === user.organizationId) {
        logger.debug('Active organization equals home org for owner', {
          userId,
          organizationId: user.activeOrganizationId,
        });
        return refuseSuspendedOrg(user.activeOrganizationId, userId);
      }

      // Override case (SYN-1104) — the active pointer differs from the home
      // org. Re-verify the user is STILL an active owner before honouring it;
      // a stale pointer (ownership revoked, or a set path that skipped
      // validation) must never select an org the user no longer belongs to.
      const stillOwner = await isActiveOwnerOfOrg(
        userId,
        user.activeOrganizationId
      );
      if (stillOwner) {
        logger.debug('Using verified override organization for owner', {
          userId,
          organizationId: user.activeOrganizationId,
        });
        return refuseSuspendedOrg(user.activeOrganizationId, userId);
      }

      // Not (or no longer) a member of the override → safe default: fall back
      // to the home org rather than the unverified pointer.
      logger.warn(
        'Active organization pointer is not a verified membership; falling back to home org',
        {
          userId,
          activeOrganizationId: user.activeOrganizationId,
        }
      );
      return user.organizationId
        ? refuseSuspendedOrg(user.organizationId, userId)
        : null;
    }

    // Regular user: use their organization
    if (user.organizationId) {
      logger.debug('Using organization for regular user', {
        userId,
        organizationId: user.organizationId,
      });
      return refuseSuspendedOrg(user.organizationId, userId);
    }

    // No organization context
    logger.debug('No organization context for user', { userId });
    return null;
  } catch (error) {
    logger.error('Failed to get effective organization ID', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Failed to determine organization context');
  }
}

/**
 * Get the effective Prisma query filter for scoping data queries
 *
 * Logic:
 * - Multi-business owner viewing specific business → { organizationId }
 * - Regular user → { userId }
 * - Missing user record → { userId } (fail closed to no matching rows)
 *
 * Use this filter in dashboard queries to automatically scope data:
 * ```typescript
 * const filter = await getEffectiveQueryFilter(userId);
 * const posts = await prisma.post.findMany({
 *   where: {
 *     ...filter,
 *     status: 'published'
 *   }
 * });
 * ```
 *
 * @param userId - The user ID
 * @returns Query filter object for Prisma where clauses
 */
export async function getEffectiveQueryFilter(
  userId: string
): Promise<EffectiveQueryFilter> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isMultiBusinessOwner: true,
        activeOrganizationId: true,
        organizationId: true,
      },
    });

    if (!user) {
      logger.warn('User not found for effective query filter', { userId });
      // A verified JWT can outlive its Prisma user row. Absence of that row is
      // never proof of admin authority: keep every consumer scoped to the
      // authenticated identifier so a stale/deleted user matches no tenant rows.
      return { userId };
    }

    // Multi-business owner with active organization: filter by organization
    if (user.isMultiBusinessOwner && user.activeOrganizationId) {
      // Verify they own this organization
      const ownership = await prisma.businessOwnership.findUnique({
        where: {
          ownerId_organizationId: {
            ownerId: userId,
            organizationId: user.activeOrganizationId,
          },
        },
        select: { isActive: true },
      });

      if (!ownership || !ownership.isActive) {
        logger.warn(
          'Multi-business owner active organization is not a verified active ownership; scoping to home org (SYN-1112 F3)',
          { userId, activeOrganizationId: user.activeOrganizationId }
        );
        // Fail CLOSED: a stale/revoked active pointer must never widen the query
        // to every tenant (an empty filter {} = no WHERE scope = cross-tenant
        // read). Scope to the owner's home org, or their own rows if they have
        // none — never unscoped.
        return user.organizationId
          ? { organizationId: user.organizationId }
          : { userId };
      }

      logger.debug('Using organization filter for multi-business owner', {
        userId,
        organizationId: user.activeOrganizationId,
      });

      return { organizationId: user.activeOrganizationId };
    }

    // Regular user: filter by userId
    logger.debug('Using user filter for regular user', { userId });
    return { userId };
  } catch (error) {
    logger.error('Failed to get effective query filter', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Failed to determine query filter');
  }
}

/**
 * Verify a user has access to a specific organization
 *
 * Access is granted if ANY of the following holds:
 * - Multi-business owner: owns the organization via an active BusinessOwnership
 * - Direct member: the user's organizationId matches the target
 * - Workspace member (SYN-847): the user is a member of the target org
 * - Master admin (SYN-847): the target is a CHILD org whose parent workspace
 *   the user is a member of — a parent/master admin can act on any child brand
 *
 * The multiple paths are required because two RBAC models coexist:
 * the BusinessOwnership model and the SYN-847 parent/child workspace model.
 *
 * @param userId - The user ID
 * @param organizationId - The organization ID to check access for
 * @returns True if user has access
 */
export async function hasOrganizationAccess(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isMultiBusinessOwner: true,
        organizationId: true,
      },
    });

    if (!user) {
      return false;
    }

    // Path 1 — Direct membership: the user's own organization matches.
    if (user.organizationId === organizationId) {
      return true;
    }

    // Path 2 — Multi-business owner: active BusinessOwnership over the target.
    if (user.isMultiBusinessOwner) {
      const ownership = await prisma.businessOwnership.findUnique({
        where: {
          ownerId_organizationId: {
            ownerId: userId,
            organizationId,
          },
        },
        select: { isActive: true },
      });

      if (ownership?.isActive) {
        return true;
      }
    }

    // Path 3 — SYN-847 workspace membership / master-admin-over-child.
    // Resolve the target org's parent (if any) and the set of orgs the user is
    // a member of. Access is granted when the user is a member of the target
    // org directly, OR a member of the target's parent workspace (master admin).
    const target = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        parentOrgId: true,
        users: { where: { id: userId }, select: { id: true } },
      },
    });

    if (!target) {
      return false;
    }

    // Member of the target child/brand org directly.
    if (target.users.length > 0) {
      return true;
    }

    // Master admin: member of the target's parent workspace org.
    if (target.parentOrgId) {
      const parentMembership = await prisma.organization.findFirst({
        where: { id: target.parentOrgId, users: { some: { id: userId } } },
        select: { id: true },
      });
      if (parentMembership) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error('Failed to check organization access', {
      userId,
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Error thrown when a campaign create/draft targets an organization the user
 * may not act on. The API route maps this to a 403 response.
 */
export class OrgAccessError extends Error {
  constructor(message = 'Forbidden — no access to target organization') {
    super(message);
    this.name = 'OrgAccessError';
  }
}

/**
 * Resolve the organization a campaign should be created against.
 *
 * Wiring for SYN-847 Campaign Studio: the client may pass the active child
 * brand's organizationId (selected in the workspace brand-switcher). When it
 * does, we authorise it against {@link hasOrganizationAccess} so a parent/
 * master admin can create against a child brand, while a member cannot create
 * against an org they don't belong to.
 *
 * Behaviour:
 * - `requestedOrganizationId` provided → verify access, return it, or throw
 *   {@link OrgAccessError} (mapped to 403 by the route).
 * - `requestedOrganizationId` omitted/null → fall back to the user's effective
 *   (active) organization via {@link getEffectiveOrganizationId}. This keeps
 *   the legacy default-org behaviour fully backward compatible.
 *
 * @param userId - The authenticated user ID
 * @param requestedOrganizationId - Optional explicit target org (active brand)
 * @returns The resolved organization ID, or null when there is no org context
 * @throws {OrgAccessError} when the user lacks access to the requested org
 */
export async function resolveCampaignOrganizationId(
  userId: string,
  requestedOrganizationId?: string | null
): Promise<string | null> {
  if (requestedOrganizationId) {
    const allowed = await hasOrganizationAccess(
      userId,
      requestedOrganizationId
    );
    if (!allowed) {
      throw new OrgAccessError();
    }
    return requestedOrganizationId;
  }

  // No explicit target — preserve the legacy default-org resolution.
  return getEffectiveOrganizationId(userId);
}

/**
 * Get all accessible organization IDs for a user
 *
 * - Multi-business owner: all owned organization IDs (active only)
 * - Regular user: their single organizationId
 *
 * Useful for aggregated queries across all accessible data.
 *
 * @param userId - The user ID
 * @returns Array of organization IDs the user can access
 */
export async function getAccessibleOrganizationIds(
  userId: string
): Promise<string[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isMultiBusinessOwner: true,
        organizationId: true,
      },
    });

    if (!user) {
      logger.warn('User not found for accessible organizations', { userId });
      return [];
    }

    // Multi-business owner: get all owned organizations
    if (user.isMultiBusinessOwner) {
      const ownerships = await prisma.businessOwnership.findMany({
        where: {
          ownerId: userId,
          isActive: true,
        },
        select: {
          organizationId: true,
        },
      });

      const organizationIds = ownerships.map(o => o.organizationId);

      logger.debug(
        'Retrieved accessible organizations for multi-business owner',
        {
          userId,
          count: organizationIds.length,
        }
      );

      return organizationIds;
    }

    // Regular user: return their single organization
    if (user.organizationId) {
      logger.debug('Retrieved organization for regular user', {
        userId,
        organizationId: user.organizationId,
      });
      return [user.organizationId];
    }

    // No organizations
    logger.debug('No accessible organizations for user', { userId });
    return [];
  } catch (error) {
    logger.error('Failed to get accessible organization IDs', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Failed to retrieve accessible organizations');
  }
}
