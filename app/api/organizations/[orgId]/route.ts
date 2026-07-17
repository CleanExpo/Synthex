/**
 * Organization Detail API
 *
 * @description API endpoints for single organization management:
 * - GET: Get organization details
 * - PATCH: Update organization
 * - DELETE: Delete organization (soft delete)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For authentication (CRITICAL)
 *
 * SECURITY: All endpoints require authentication and organization membership
 *
 * FAILURE MODE: Returns appropriate error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { getCache } from '@/lib/cache/cache-manager';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  primaryColor: z.string().optional(),
  favicon: z.string().optional(),
  customDomain: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  billingEmail: z.string().email().optional(),
  slug: z.string().optional(),
  // `plan` is intentionally NOT accepted. Org plan is derived only from
  // verified Stripe subscription state — an admin cannot self-grant a paid
  // plan (e.g. 'enterprise') via this payload.
});

// =============================================================================
// Auth Helper - Verify user and organization membership
// =============================================================================

/**
 * Check if user is a member of the organization
 */
async function isOrgMember(userId: string, orgId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: orgId,
    },
  });
  return !!user;
}

/**
 * Check if user is an admin of the organization
 */
async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: orgId,
    },
  });

  if (!user) return false;

  // Check organization settings for admin list
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });

  const settings = org?.settings as { admins?: string[] } | null;
  return settings?.admins?.includes(userId) || false;
}

// ============================================================================
// GET - Get Organization Details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  try {
    // Authenticate user
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return ResponseOptimizer.createErrorResponse(
        'Authentication required',
        401
      );
    }

    // Verify user is a member of the organization
    const isMember = await isOrgMember(userId, orgId);
    if (!isMember) {
      return ResponseOptimizer.createErrorResponse(
        'Organization not found or access denied',
        404
      );
    }

    const cache = getCache();

    // Try cache first (user-specific cache key)
    const cacheKey = `org:${orgId}:user:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return ResponseOptimizer.createResponse(cached, {
        cacheType: 'api',
        cacheDuration: 300,
      });
    }

    // Fetch from database
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            createdAt: true,
          },
        },
        roles: {
          select: {
            id: true,
            name: true,
            description: true,
            permissions: true,
            isDefault: true,
            isSystem: true,
          },
        },
        _count: {
          select: {
            users: true,
            campaigns: true,
            teamInvitations: true,
          },
        },
      },
    });

    if (!organization) {
      return ResponseOptimizer.createErrorResponse(
        'Organization not found',
        404
      );
    }

    const response = {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      plan: organization.plan,
      status: organization.status,
      domain: organization.domain,
      customDomain: organization.customDomain,
      logo: organization.logo,
      primaryColor: organization.primaryColor,
      settings: organization.settings,
      limits: {
        maxUsers: organization.maxUsers,
        maxPosts: organization.maxPosts,
        maxCampaigns: organization.maxCampaigns,
      },
      usage: {
        users: organization._count.users,
        campaigns: organization._count.campaigns,
        pendingInvitations: organization._count.teamInvitations,
      },
      users: organization.users,
      roles: organization.roles,
      billing: {
        stripeCustomerId: organization.stripeCustomerId,
        billingEmail: organization.billingEmail,
        billingStatus: organization.billingStatus,
      },
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };

    // Cache the response (user-specific)
    await cache.set(cacheKey, response, {
      ttl: 300,
      tags: [`org:${orgId}`, `user:${userId}`],
    });

    return ResponseOptimizer.createResponse(response, {
      cacheType: 'api',
      cacheDuration: 300,
    });
  } catch (error) {
    logger.error('Failed to get organization', { error, orgId });
    return ResponseOptimizer.createErrorResponse(
      'Failed to get organization',
      500
    );
  }
}

// ============================================================================
// PATCH - Update Organization
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  try {
    // Authenticate user
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return ResponseOptimizer.createErrorResponse(
        'Authentication required',
        401
      );
    }

    // Verify user is an admin of the organization
    const isAdmin = await isOrgAdmin(userId, orgId);
    if (!isAdmin) {
      // Check if they're at least a member (for better error message)
      const isMember = await isOrgMember(userId, orgId);
      if (!isMember) {
        return ResponseOptimizer.createErrorResponse(
          'Organization not found or access denied',
          404
        );
      }
      return ResponseOptimizer.createErrorResponse(
        'Admin privileges required to update organization',
        403
      );
    }

    const rawBody = await request.json();
    const validation = updateOrganizationSchema.safeParse(rawBody);
    if (!validation.success) {
      return ResponseOptimizer.createErrorResponse('Invalid request data', 400);
    }
    const body = validation.data;

    // Check organization exists
    const existing = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!existing) {
      return ResponseOptimizer.createErrorResponse(
        'Organization not found',
        404
      );
    }

    // Track B §11 — provisioning provenance is server-owned.
    const existingSettings = (existing.settings ?? {}) as Record<
      string,
      unknown
    >;
    const isProvisioned = Boolean(existingSettings.provisioning);

    // A provisioned child's slug is its idempotency derivation — it must
    // never drift (criterion 17). Reject renames outright.
    if (body.slug && body.slug !== existing.slug && isProvisioned) {
      return ResponseOptimizer.createErrorResponse(
        'Slug is immutable for provisioned client organisations',
        409,
        { field: 'slug' }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name',
      'description',
      'logo',
      'primaryColor',
      'favicon',
      'customDomain',
      'settings',
      'billingEmail',
    ];

    const bodyRecord = body as Record<string, unknown>;
    for (const field of allowedFields) {
      if (bodyRecord[field] !== undefined) {
        updateData[field] = bodyRecord[field];
      }
    }

    // `settings.provisioning` is a RESERVED key (criteria 2 & 15): stripped
    // from every client write, the server value re-applied — a client admin
    // can neither alter, erase, nor forge it.
    if (updateData.settings !== undefined) {
      const { provisioning: _clientSupplied, ...clientSettings } =
        updateData.settings as Record<string, unknown>;
      updateData.settings = isProvisioned
        ? { ...clientSettings, provisioning: existingSettings.provisioning }
        : clientSettings;
    }

    // Plan changes are NOT handled here: an org's plan and quota limits are
    // derived only from verified Stripe subscription state, never from a
    // client PATCH. `plan` is not part of the accepted schema.

    // Check slug uniqueness if changing
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await prisma.organization.findUnique({
        where: { slug: body.slug },
      });

      if (slugExists) {
        return ResponseOptimizer.createErrorResponse(
          'Organization slug already exists',
          409,
          { field: 'slug' }
        );
      }

      updateData.slug = body.slug;
      updateData.domain = `${body.slug}.synthex.social`;
    }

    // Check custom domain uniqueness
    if (body.customDomain && body.customDomain !== existing.customDomain) {
      const domainExists = await prisma.organization.findFirst({
        where: {
          customDomain: body.customDomain,
          id: { not: orgId },
        },
      });

      if (domainExists) {
        return ResponseOptimizer.createErrorResponse(
          'Custom domain already in use',
          409,
          { field: 'customDomain' }
        );
      }
    }

    // Update organization and log in a transaction
    const organization = await prisma.$transaction(async tx => {
      const updated = await tx.organization.update({
        where: { id: orgId },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          userId: userId,
          action: 'organization_updated',
          resource: 'organization',
          resourceId: orgId,
          details: { updatedFields: Object.keys(updateData) },
          severity: 'medium',
          category: 'admin',
          outcome: 'success',
        },
      });

      return updated;
    });

    // Invalidate cache
    const cache = getCache();
    await cache.invalidateByTag(`org:${orgId}`);

    logger.info('Organization updated', {
      organizationId: organization.id,
      updatedFields: Object.keys(updateData),
      userId: userId,
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          plan: organization.plan,
          status: organization.status,
          domain: organization.domain,
          customDomain: organization.customDomain,
          updatedAt: organization.updatedAt,
        },
      },
      { cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to update organization', { error, orgId: orgId });
    return ResponseOptimizer.createErrorResponse(
      'Failed to update organization',
      500
    );
  }
}

// ============================================================================
// DELETE - Delete Organization (Soft Delete)
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  try {
    // Authenticate user
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return ResponseOptimizer.createErrorResponse(
        'Authentication required',
        401
      );
    }

    // Verify user is an admin of the organization
    const isAdmin = await isOrgAdmin(userId, orgId);
    if (!isAdmin) {
      // Check if they're at least a member (for better error message)
      const isMember = await isOrgMember(userId, orgId);
      if (!isMember) {
        return ResponseOptimizer.createErrorResponse(
          'Organization not found or access denied',
          404
        );
      }
      return ResponseOptimizer.createErrorResponse(
        'Admin privileges required to delete organization',
        403
      );
    }

    // Check organization exists
    const existing = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!existing) {
      return ResponseOptimizer.createErrorResponse(
        'Organization not found',
        404
      );
    }

    // Soft delete org, remove users, and log in a transaction
    await prisma.$transaction(async tx => {
      await tx.organization.update({
        where: { id: orgId },
        data: {
          status: 'deleted',
          // Clear domain to allow reuse
          domain: null,
          customDomain: null,
        },
      });

      await tx.user.updateMany({
        where: { organizationId: orgId },
        data: { organizationId: null },
      });

      await tx.auditLog.create({
        data: {
          userId: userId,
          action: 'organization_deleted',
          resource: 'organization',
          resourceId: orgId,
          details: {
            organizationName: existing.name,
            userCount: existing._count.users,
          },
          severity: 'high',
          category: 'admin',
          outcome: 'success',
        },
      });
    });

    // Invalidate cache
    const cache = getCache();
    await cache.invalidateByTag(`org:${orgId}`);

    logger.info('Organization deleted', {
      organizationId: orgId,
      userCount: existing._count.users,
      userId: userId,
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        message: 'Organization deleted successfully',
      },
      { cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to delete organization', { error, orgId: orgId });
    return ResponseOptimizer.createErrorResponse(
      'Failed to delete organization',
      500
    );
  }
}

export const runtime = 'nodejs';
