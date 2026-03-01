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
import { PLAN_LIMITS, TenantPlan } from '@/lib/multi-tenant';
import { verifyToken } from '@/lib/auth/jwt-utils';

const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  primaryColor: z.string().optional(),
  favicon: z.string().optional(),
  customDomain: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
  billingEmail: z.string().email().optional(),
  slug: z.string().optional(),
  plan: z.string().optional(),
});

// =============================================================================
// Auth Helper - Verify user and organization membership
// =============================================================================

async function getUserFromRequest(request: NextRequest): Promise<{ id: string; email: string } | null> {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = verifyToken(token);
      return { id: decoded.userId, email: decoded.email || '' };
    } catch {
      // Fall through to cookie check
    }
  }

  // Try auth-token cookie
  const authToken = request.cookies.get('auth-token')?.value;
  if (authToken) {
    try {
      const decoded = verifyToken(authToken);
      return { id: decoded.userId, email: decoded.email || '' };
    } catch {
      return null;
    }
  }

  return null;
}

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
    const user = await getUserFromRequest(request);
    if (!user) {
      return ResponseOptimizer.createErrorResponse('Authentication required', 401);
    }

    // Verify user is a member of the organization
    const isMember = await isOrgMember(user.id, orgId);
    if (!isMember) {
      return ResponseOptimizer.createErrorResponse('Organization not found or access denied', 404);
    }

    const cache = getCache();

    // Try cache first (user-specific cache key)
    const cacheKey = `org:${orgId}:user:${user.id}`;
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
      return ResponseOptimizer.createErrorResponse('Organization not found', 404);
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
    await cache.set(cacheKey, response, { ttl: 300, tags: [`org:${orgId}`, `user:${user.id}`] });

    return ResponseOptimizer.createResponse(response, {
      cacheType: 'api',
      cacheDuration: 300,
    });
  } catch (error) {
    logger.error('Failed to get organization', { error, orgId });
    return ResponseOptimizer.createErrorResponse('Failed to get organization', 500);
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
    const user = await getUserFromRequest(request);
    if (!user) {
      return ResponseOptimizer.createErrorResponse('Authentication required', 401);
    }

    // Verify user is an admin of the organization
    const isAdmin = await isOrgAdmin(user.id, orgId);
    if (!isAdmin) {
      // Check if they're at least a member (for better error message)
      const isMember = await isOrgMember(user.id, orgId);
      if (!isMember) {
        return ResponseOptimizer.createErrorResponse('Organization not found or access denied', 404);
      }
      return ResponseOptimizer.createErrorResponse('Admin privileges required to update organization', 403);
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
      return ResponseOptimizer.createErrorResponse('Organization not found', 404);
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

    // Handle plan change (requires billing verification in production)
    if (body.plan && body.plan !== existing.plan) {
      const newPlan = body.plan as TenantPlan;
      const planLimits = PLAN_LIMITS[newPlan];

      if (!planLimits) {
        return ResponseOptimizer.createErrorResponse('Invalid plan', 400);
      }

      updateData.plan = newPlan;
      updateData.maxUsers = planLimits.maxUsers === -1 ? 999999 : planLimits.maxUsers;
      updateData.maxPosts = planLimits.maxPosts === -1 ? 999999 : planLimits.maxPosts;
      updateData.maxCampaigns = planLimits.maxCampaigns === -1 ? 999999 : planLimits.maxCampaigns;
    }

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
      updateData.domain = `${body.slug}.synthex.app`;
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
    const organization = await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: orgId },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
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
      userId: user.id,
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
    return ResponseOptimizer.createErrorResponse('Failed to update organization', 500);
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
    const user = await getUserFromRequest(request);
    if (!user) {
      return ResponseOptimizer.createErrorResponse('Authentication required', 401);
    }

    // Verify user is an admin of the organization
    const isAdmin = await isOrgAdmin(user.id, orgId);
    if (!isAdmin) {
      // Check if they're at least a member (for better error message)
      const isMember = await isOrgMember(user.id, orgId);
      if (!isMember) {
        return ResponseOptimizer.createErrorResponse('Organization not found or access denied', 404);
      }
      return ResponseOptimizer.createErrorResponse('Admin privileges required to delete organization', 403);
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
      return ResponseOptimizer.createErrorResponse('Organization not found', 404);
    }

    // Soft delete org, remove users, and log in a transaction
    await prisma.$transaction(async (tx) => {
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
          userId: user.id,
          action: 'organization_deleted',
          resource: 'organization',
          resourceId: orgId,
          details: { organizationName: existing.name, userCount: existing._count.users },
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
      userId: user.id,
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
    return ResponseOptimizer.createErrorResponse('Failed to delete organization', 500);
  }
}

export const runtime = 'nodejs';
