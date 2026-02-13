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
 * Checks:
 * - Multi-business owner: must own the organization via BusinessOwnership
 * - Regular user: must have organizationId matching
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

    // Multi-business owner: check ownership
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

      return ownership?.isActive ?? false;
    }

    // Regular user: check organization match
    return user.organizationId === organizationId;
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
