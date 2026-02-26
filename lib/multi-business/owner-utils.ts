/**
 * Multi-Business Owner Utilities
 *
 * Core functions for managing multi-business ownership in SYNTHEX.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * None - Uses shared database connection from @/lib/prisma
 *
 * FAILURE MODE: Throws errors for invalid operations, returns null/empty for not found
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type {
  OwnedBusiness,
  BusinessQuickStats,
  CrossBusinessAggregation,
  CreateBusinessParams,
} from './types';

/**
 * Check if a user is a multi-business owner
 *
 * @param userId - The user ID to check
 * @returns True if user has isMultiBusinessOwner flag enabled
 */
export async function isMultiBusinessOwner(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isMultiBusinessOwner: true },
    });

    return user?.isMultiBusinessOwner ?? false;
  } catch (error) {
    logger.error('Failed to check multi-business owner status', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Get all businesses owned by a multi-business owner
 *
 * @param userId - The owner's user ID
 * @param includeStats - Whether to include business statistics (default: false)
 * @returns Array of owned businesses with optional stats
 */
export async function getOwnedBusinesses(
  userId: string,
  includeStats: boolean = false
): Promise<OwnedBusiness[]> {
  try {
    const ownerships = await prisma.businessOwnership.findMany({
      where: { ownerId: userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    const businesses: OwnedBusiness[] = await Promise.all(
      ownerships.map(async (ownership) => {
        const business: OwnedBusiness = {
          id: ownership.id,
          organizationId: ownership.organizationId,
          organizationName: ownership.organization.name,
          organizationSlug: ownership.organization.slug,
          displayName: ownership.displayName,
          isActive: ownership.isActive,
          billingStatus: ownership.billingStatus,
          monthlyRate: ownership.monthlyRate,
          createdAt: ownership.createdAt,
          updatedAt: ownership.updatedAt,
        };

        if (includeStats) {
          business.stats = await getBusinessStats(ownership.organizationId);
        }

        return business;
      })
    );

    logger.info('Retrieved owned businesses', {
      userId,
      count: businesses.length,
      includeStats,
    });

    return businesses;
  } catch (error) {
    logger.error('Failed to get owned businesses', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Failed to retrieve owned businesses');
  }
}

/**
 * Get quick statistics for a single business
 *
 * @param organizationId - The organization ID
 * @returns Business statistics
 */
async function getBusinessStats(
  organizationId: string
): Promise<BusinessQuickStats> {
  try {
    // Get campaign count for this organization
    const totalCampaigns = await prisma.campaign.count({
      where: { organizationId },
    });

    // Get post count (through campaigns belonging to this org)
    const totalPosts = await prisma.post.count({
      where: { campaign: { organizationId } },
    });

    // Get unique platforms from platform connections (directly scoped by organizationId)
    const platformsData = await prisma.platformConnection.findMany({
      where: { organizationId, isActive: true },
      select: { platform: true },
      distinct: ['platform'],
    });
    const activePlatforms = platformsData.length;

    // Get total engagement from published posts' analytics JSON
    const publishedPosts = await prisma.post.findMany({
      where: {
        campaign: { organizationId },
        status: 'published',
      },
      select: { analytics: true },
    });

    const totalEngagement = publishedPosts.reduce((sum, post) => {
      const analytics = post.analytics as Record<string, number> | null;
      return sum + (analytics?.engagement || 0);
    }, 0);

    return {
      totalCampaigns,
      totalPosts,
      activePlatforms,
      totalEngagement,
    };
  } catch (error) {
    logger.error('Failed to get business stats', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return zero stats on error
    return {
      totalCampaigns: 0,
      totalPosts: 0,
      activePlatforms: 0,
      totalEngagement: 0,
    };
  }
}

/**
 * Get the user's currently active organization ID
 *
 * @param userId - The user ID
 * @returns The active organization ID or null if not set
 */
export async function getActiveOrganizationId(
  userId: string
): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { activeOrganizationId: true },
    });

    return user?.activeOrganizationId ?? null;
  } catch (error) {
    logger.error('Failed to get active organization ID', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Set the user's active organization
 *
 * Validates that the user owns the organization before setting it as active.
 *
 * @param userId - The user ID
 * @param organizationId - The organization ID to set as active
 * @throws Error if user doesn't own the organization
 */
export async function setActiveOrganization(
  userId: string,
  organizationId: string | null
): Promise<void> {
  try {
    // If null, clear active organization (master overview)
    if (organizationId === null) {
      await prisma.user.update({
        where: { id: userId },
        data: { activeOrganizationId: null },
      });

      logger.info('Cleared active organization (master overview)', { userId });
      return;
    }

    // Verify ownership
    const ownership = await prisma.businessOwnership.findUnique({
      where: {
        ownerId_organizationId: {
          ownerId: userId,
          organizationId: organizationId,
        },
      },
    });

    if (!ownership) {
      throw new Error('User does not own this organization');
    }

    if (!ownership.isActive) {
      throw new Error('Cannot switch to inactive organization');
    }

    // Update user's active organization
    await prisma.user.update({
      where: { id: userId },
      data: { activeOrganizationId: organizationId },
    });

    logger.info('Set active organization', {
      userId,
      organizationId,
    });
  } catch (error) {
    logger.error('Failed to set active organization', {
      userId,
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Generate a URL-friendly slug from a business name
 *
 * @param name - The business name
 * @returns Kebab-case slug (max 50 chars)
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Max 50 chars
}

/**
 * Create a new child business for a multi-business owner
 *
 * Creates:
 * - New Organization record
 * - BusinessOwnership junction record
 * - Default roles (Admin, Editor, Viewer)
 * - Connects owner user to the organization
 *
 * @param userId - The owner's user ID
 * @param params - Business creation parameters
 * @returns The newly created business
 * @throws Error if user is not a multi-business owner or creation fails
 */
export async function createChildBusiness(
  userId: string,
  params: CreateBusinessParams
): Promise<OwnedBusiness> {
  try {
    // Verify user is multi-business owner
    const isOwner = await isMultiBusinessOwner(userId);
    if (!isOwner) {
      throw new Error('User is not a multi-business owner');
    }

    const { name, displayName, monthlyRate = 249.0 } = params;
    const slug = generateSlug(name);
    const domain = `${slug}.synthex.app`;

    // Create organization and ownership in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          domain,
        },
      });

      // Create business ownership
      const ownership = await tx.businessOwnership.create({
        data: {
          ownerId: userId,
          organizationId: organization.id,
          displayName: displayName ?? null,
          monthlyRate,
          isActive: true,
          billingStatus: 'active',
        },
      });

      // Create default roles
      const adminRole = await tx.role.create({
        data: {
          organizationId: organization.id,
          name: 'Admin',
          permissions: ['*'], // Full access
        },
      });

      await tx.role.create({
        data: {
          organizationId: organization.id,
          name: 'Editor',
          permissions: [
            'campaigns:read',
            'campaigns:write',
            'posts:read',
            'posts:write',
            'content:read',
            'content:write',
            'analytics:read',
          ],
        },
      });

      await tx.role.create({
        data: {
          organizationId: organization.id,
          name: 'Viewer',
          permissions: [
            'campaigns:read',
            'posts:read',
            'content:read',
            'analytics:read',
          ],
        },
      });

      // Connect owner to organization via UserRole (admin)
      await tx.userRole.create({
        data: {
          userId,
          roleId: adminRole.id,
          grantedBy: userId,
        },
      });

      return {
        ownership,
        organization,
      };
    });

    logger.info('Created child business', {
      userId,
      organizationId: result.organization.id,
      name,
      slug,
    });

    return {
      id: result.ownership.id,
      organizationId: result.organization.id,
      organizationName: result.organization.name,
      organizationSlug: result.organization.slug,
      displayName: result.ownership.displayName,
      isActive: result.ownership.isActive,
      billingStatus: result.ownership.billingStatus,
      monthlyRate: result.ownership.monthlyRate,
      createdAt: result.ownership.createdAt,
      updatedAt: result.ownership.updatedAt,
    };
  } catch (error) {
    logger.error('Failed to create child business', {
      userId,
      params,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Remove a child business (soft delete)
 *
 * Sets isActive=false and billingStatus='cancelled' on the BusinessOwnership record.
 * Does NOT delete the organization or its data.
 *
 * @param userId - The owner's user ID
 * @param ownershipId - The BusinessOwnership ID to remove
 * @throws Error if ownership not found or user doesn't own it
 */
export async function removeChildBusiness(
  userId: string,
  ownershipId: string
): Promise<void> {
  try {
    // Verify ownership belongs to user
    const ownership = await prisma.businessOwnership.findUnique({
      where: { id: ownershipId },
    });

    if (!ownership) {
      throw new Error('Business ownership not found');
    }

    if (ownership.ownerId !== userId) {
      throw new Error('User does not own this business');
    }

    // Soft delete - mark as inactive and cancelled
    await prisma.businessOwnership.update({
      where: { id: ownershipId },
      data: {
        isActive: false,
        billingStatus: 'cancelled',
      },
    });

    // If this was the user's active organization, clear it
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { activeOrganizationId: true },
    });

    if (user?.activeOrganizationId === ownership.organizationId) {
      await prisma.user.update({
        where: { id: userId },
        data: { activeOrganizationId: null },
      });
    }

    logger.info('Removed child business', {
      userId,
      ownershipId,
      organizationId: ownership.organizationId,
    });
  } catch (error) {
    logger.error('Failed to remove child business', {
      userId,
      ownershipId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get cross-business aggregated statistics
 *
 * Aggregates KPIs across all businesses owned by a user.
 *
 * @param userId - The owner's user ID
 * @returns Aggregated statistics across all businesses
 */
export async function getCrossBusinessStats(
  userId: string
): Promise<CrossBusinessAggregation> {
  try {
    // Get all businesses with stats
    const businesses = await getOwnedBusinesses(userId, true);

    // Calculate aggregations
    const totalBusinesses = businesses.length;
    const activeBusinesses = businesses.filter((b) => b.isActive).length;

    let totalCampaigns = 0;
    let totalPosts = 0;
    let totalEngagement = 0;
    let totalMonthlySpend = 0;

    for (const business of businesses) {
      if (business.stats) {
        totalCampaigns += business.stats.totalCampaigns;
        totalPosts += business.stats.totalPosts;
        totalEngagement += business.stats.totalEngagement;
      }

      if (business.isActive) {
        totalMonthlySpend += business.monthlyRate;
      }
    }

    logger.info('Retrieved cross-business stats', {
      userId,
      totalBusinesses,
      activeBusinesses,
    });

    return {
      totalBusinesses,
      activeBusinesses,
      totalCampaigns,
      totalPosts,
      totalEngagement,
      totalMonthlySpend,
      perBusiness: businesses,
    };
  } catch (error) {
    logger.error('Failed to get cross-business stats', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Failed to retrieve cross-business statistics');
  }
}
