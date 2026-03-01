/**
 * Organizations API
 *
 * @description API endpoints for organization management:
 * - POST: Create new organization (authenticated users)
 * - GET: List organizations (admin only)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token verification (CRITICAL)
 *
 * FAILURE MODE: Returns appropriate error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ResponseOptimizer, cacheHeaders } from '@/lib/api/response-optimizer';
import { generateTenantSlug, createDefaultSettings, PLAN_LIMITS, TenantPlan } from '@/lib/multi-tenant';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

const createOrganizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  plan: z.string().optional().default('free'),
});

// ============================================================================
// POST - Create Organization
// ============================================================================

export async function POST(request: NextRequest) {
  // Security check - requires authentication
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error || 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  try {
    const rawBody = await request.json();
    const validation = createOrganizationSchema.safeParse(rawBody);
    if (!validation.success) {
      return ResponseOptimizer.createErrorResponse(
        'Invalid request data',
        400
      );
    }
    const { name, slug: providedSlug, plan } = validation.data;

    // Use authenticated user ID from security context instead of trusting body
    const userId = security.context.userId;

    if (!userId) {
      return ResponseOptimizer.createErrorResponse('User ID is required', 400);
    }

    // Generate slug if not provided
    const slug = providedSlug || generateTenantSlug(name);

    // Check if slug is already taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      return ResponseOptimizer.createErrorResponse(
        'Organization slug already exists',
        409,
        { field: 'slug' }
      );
    }

    // Get plan limits with fallback
    const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;

    // Create organization and default roles in a transaction
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name,
          slug,
          plan,
          status: 'active',
          domain: `${slug}.synthex.app`,
          settings: JSON.parse(JSON.stringify(createDefaultSettings(plan as TenantPlan))),
          maxUsers: (planLimits?.maxUsers ?? 5) === -1 ? 999999 : (planLimits?.maxUsers ?? 5),
          maxPosts: (planLimits?.maxPosts ?? 500) === -1 ? 999999 : (planLimits?.maxPosts ?? 500),
          maxCampaigns: (planLimits?.maxCampaigns ?? 10) === -1 ? 999999 : (planLimits?.maxCampaigns ?? 10),
          users: {
            connect: { id: userId },
          },
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Create default roles for the organization within the same transaction
      await createDefaultRoles(org.id, tx);

      return org;
    });

    logger.info('Organization created', {
      organizationId: organization.id,
      slug: organization.slug,
      createdBy: userId,
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          plan: organization.plan,
          domain: organization.domain,
          status: organization.status,
          createdAt: organization.createdAt,
        },
      },
      { status: 201, cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to create organization', { error });
    return ResponseOptimizer.createErrorResponse(
      'Failed to create organization',
      500
    );
  }
}

// ============================================================================
// GET - List Organizations (Admin Only)
// ============================================================================

export async function GET(request: NextRequest) {
  // Security check - requires admin authentication
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.ADMIN_ONLY
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error || 'Admin access required' },
      security.error?.includes('Rate limit') ? 429 :
      security.error?.includes('permission') ? 403 : 401,
      security.context
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status');
    const plan = searchParams.get('plan');
    const search = searchParams.get('search');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (plan) {
      where.plan = plan;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.organization.count({ where });

    // Get organizations
    const organizations = await prisma.organization.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        domain: true,
        customDomain: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            campaigns: true,
          },
        },
      },
    });

    return ResponseOptimizer.createResponse(
      {
        data: organizations.map(org => ({
          ...org,
          userCount: org._count.users,
          campaignCount: org._count.campaigns,
          _count: undefined,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      },
      { cacheType: 'api', cacheDuration: 60 }
    );
  } catch (error) {
    logger.error('Failed to list organizations', { error });
    return ResponseOptimizer.createErrorResponse(
      'Failed to list organizations',
      500
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createDefaultRoles(organizationId: string, tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<void> {
  const db = tx ?? prisma;
  const defaultRoles = [
    {
      name: 'Admin',
      description: 'Full access to all organization features',
      permissions: ['*'],
      isDefault: false,
      isSystem: true,
    },
    {
      name: 'Editor',
      description: 'Can create and edit content, campaigns, and analytics',
      permissions: [
        'posts:create',
        'posts:read',
        'posts:update',
        'posts:delete',
        'campaigns:create',
        'campaigns:read',
        'campaigns:update',
        'analytics:read',
        'personas:read',
        'personas:update',
      ],
      isDefault: true,
      isSystem: true,
    },
    {
      name: 'Viewer',
      description: 'Read-only access to content and analytics',
      permissions: [
        'posts:read',
        'campaigns:read',
        'analytics:read',
        'personas:read',
      ],
      isDefault: false,
      isSystem: true,
    },
  ];

  await db.role.createMany({
    data: defaultRoles.map(role => ({
      ...role,
      organizationId,
    })),
    skipDuplicates: true,
  });
}

export const runtime = 'nodejs';
