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
 * - Multi-business owner with activeOrganizationId set → returns activeOrganizationId
 * - Regular user with organizationId → returns organizationId
 * - No organization context → returns null
 *
 * @param userId - The user ID
 * @returns The effective organization ID or null if no context
 */
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

    // Multi-business owner: use their active organization if set
    if (user.isMultiBusinessOwner && user.activeOrganizationId) {
      logger.debug('Using active organization for multi-business owner', {
        userId,
        organizationId: user.activeOrganizationId,
      });
      return user.activeOrganizationId;
    }

    // Regular user: use their organization
    if (user.organizationId) {
      logger.debug('Using organization for regular user', {
        userId,
        organizationId: user.organizationId,
      });
      return user.organizationId;
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
 * - No context → {} (no filter, for admin queries)
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
      return {}; // No filter (admin context)
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
          'Multi-business owner has invalid active organization',
          {
            userId,
            activeOrganizationId: user.activeOrganizationId,
          }
        );
        // Fall back to no filter rather than failing
        return {};
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

      const organizationIds = ownerships.map((o) => o.organizationId);

      logger.debug('Retrieved accessible organizations for multi-business owner', {
        userId,
        count: organizationIds.length,
      });

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
