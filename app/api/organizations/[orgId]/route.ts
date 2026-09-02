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
import { ClientLabelPolicySchema } from '@/lib/intentscape/client-label-pipeline';
import { studioSettingsSchema } from '@/lib/marketing-agency/studio/clients';

const organizationSettingsSchema = z
  .record(z.string(), z.unknown())
  .superRefine((settings, context) => {
    if (settings.autoLabelPipeline !== undefined) {
      const result = ClientLabelPolicySchema.safeParse(
        settings.autoLabelPipeline
      );
      if (!result.success) {
        context.addIssue({
          code: 'custom',
          path: ['autoLabelPipeline'],
          message: 'Auto Label Pipeline policy is invalid.',
        });
      }
    }
    // `settings.studio` is validated AFTER the merge with the stored object
    // (see the PATCH handler): the Studio reads the merged object with
    // `studioSettingsSchema` and ignores all of it on any error, so it is the
    // merged result that must be valid, not the fragment.
    if (settings.studio !== undefined && settings.studio !== null) {
      if (
        typeof settings.studio !== 'object' ||
        Array.isArray(settings.studio)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['studio'],
          message: 'Studio settings must be an object (or null to clear them).',
        });
      }
    }
  });

/**
 * Merge semantics for `settings` on PATCH, in one place so the next key does
 * not invent a third rule:
 *   - top level: shallow merge, client keys replace stored keys;
 *   - `provisioning`: reserved, server-owned, never client-writable;
 *   - `studio`: merged ONE level deep (avatar, voice and likeness consent
 *     travel together, and a PATCH of `{ studio: { funnelUrl } }` must not
 *     erase the consent); a key sent as `null` is REMOVED; `studio: null`
 *     clears the whole object; the merged result is validated with the
 *     Studio's own schema and the write is refused on any error;
 *   - `studio.consent`: `recordedBy` / `recordedAt` are stamped from the
 *     authenticated caller and the server clock, never taken from the client.
 */
function mergeStudioSettings(
  existing: unknown,
  fragment: unknown,
  recordedBy: string,
  now: Date
):
  | { ok: true; studio: Record<string, unknown> | null }
  | { ok: false; error: string } {
  if (fragment === null) return { ok: true, studio: null };
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(
    fragment as Record<string, unknown>
  )) {
    if (value === null) delete merged[key];
    else merged[key] = value;
  }
  const clientConsent = (fragment as Record<string, unknown>).consent;
  if (clientConsent && typeof clientConsent === 'object') {
    const {
      recordedBy: _by,
      recordedAt: _at,
      ...consent
    } = clientConsent as Record<string, unknown>;
    merged.consent = {
      ...consent,
      recordedBy,
      recordedAt: now.toISOString(),
    };
  }
  const parsed = studioSettingsSchema.safeParse(merged);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Studio settings are invalid after merge: ${parsed.error.issues
        .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')}`,
    };
  }
  return { ok: true, studio: parsed.data as Record<string, unknown> };
}

const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  primaryColor: z.string().optional(),
  favicon: z.string().optional(),
  customDomain: z.string().optional(),
  settings: organizationSettingsSchema.optional(),
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
      // `settings.studio`: see mergeStudioSettings for the rules.
      const clientStudio = clientSettings.studio;
      let studio: Record<string, unknown> | null | undefined;
      if (clientStudio !== undefined) {
        const merge = mergeStudioSettings(
          existingSettings.studio,
          clientStudio,
          userId,
          new Date()
        );
        if (!merge.ok) {
          return ResponseOptimizer.createErrorResponse(merge.error, 400);
        }
        studio = merge.studio;
      }
      const mergedSettings = {
        ...existingSettings,
        ...clientSettings,
        ...(clientStudio !== undefined ? { studio } : {}),
      };
      updateData.settings = isProvisioned
        ? { ...mergedSettings, provisioning: existingSettings.provisioning }
        : mergedSettings;
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
