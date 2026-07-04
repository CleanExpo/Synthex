/**
 * Brand Operating System API (SYN-515 — Core layer)
 *
 * @description Org-scoped CRUD for the BrandOperatingSystem (the Core layer of
 * the 3-layer prompt system):
 * - GET:   Fetch the org's BrandOperatingSystem (null when none exists)
 * - POST:  Create the org's BrandOperatingSystem (409 if one already exists)
 * - PATCH: Update the org's BrandOperatingSystem (404 when none exists)
 *
 * SECURITY: All endpoints require authentication + org membership; writes are
 * admin-gated. Mirrors app/api/organizations/[orgId]/route.ts.
 *
 * FAILURE MODE: Returns { error, details? } with the appropriate status.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { getCache } from '@/lib/cache/cache-manager';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

const brandOsSchema = z.object({
  method: z.string().optional(),
  qualityThreshold: z.number().int().min(0).max(100).nullable().optional(),
  version: z.number().int().min(1).optional(),
  systemPromptOverride: z.string().nullable().optional(),
  rules: z.array(z.string()).optional(),
  outputStructure: z.record(z.string(), z.unknown()).optional(),
  decisionLogic: z.record(z.string(), z.unknown()).optional(),
  changelog: z.array(z.unknown()).optional(),
});

type BrandOsInput = z.infer<typeof brandOsSchema>;

// =============================================================================
// Auth helpers — verify user membership / admin (mirrors organizations/[orgId])
// =============================================================================

async function isOrgMember(userId: string, orgId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: orgId },
  });
  return !!user;
}

async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: orgId },
  });
  if (!user) return false;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });
  const settings = org?.settings as { admins?: string[] } | null;
  return settings?.admins?.includes(userId) || false;
}

/** Assemble a Prisma data object from validated input (only provided fields). */
function buildData(body: BrandOsInput): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (body.method !== undefined) data.method = body.method;
  if (body.qualityThreshold !== undefined)
    data.qualityThreshold = body.qualityThreshold;
  if (body.version !== undefined) data.version = body.version;
  if (body.systemPromptOverride !== undefined)
    data.systemPromptOverride = body.systemPromptOverride;
  if (body.rules !== undefined)
    data.rules = body.rules as Prisma.InputJsonValue;
  if (body.outputStructure !== undefined)
    data.outputStructure = body.outputStructure as Prisma.InputJsonValue;
  if (body.decisionLogic !== undefined)
    data.decisionLogic = body.decisionLogic as Prisma.InputJsonValue;
  if (body.changelog !== undefined)
    data.changelog = body.changelog as Prisma.InputJsonValue;
  return data;
}

// ============================================================================
// GET — Fetch the org's BrandOperatingSystem
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return ResponseOptimizer.createErrorResponse('Authentication required', 401);
    }

    const isMember = await isOrgMember(userId, orgId);
    if (!isMember) {
      return ResponseOptimizer.createErrorResponse(
        'Organization not found or access denied',
        404
      );
    }

    const brandOperatingSystem = await prisma.brandOperatingSystem.findUnique({
      where: { organizationId: orgId },
    });

    return ResponseOptimizer.createResponse(
      { brandOperatingSystem },
      { cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to get brand operating system', { error, orgId });
    return ResponseOptimizer.createErrorResponse(
      'Failed to get brand operating system',
      500
    );
  }
}

// ============================================================================
// POST — Create the org's BrandOperatingSystem
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return ResponseOptimizer.createErrorResponse('Authentication required', 401);
    }

    const isAdmin = await isOrgAdmin(userId, orgId);
    if (!isAdmin) {
      const isMember = await isOrgMember(userId, orgId);
      if (!isMember) {
        return ResponseOptimizer.createErrorResponse(
          'Organization not found or access denied',
          404
        );
      }
      return ResponseOptimizer.createErrorResponse(
        'Admin privileges required to create the brand operating system',
        403
      );
    }

    const rawBody = await request.json().catch(() => null);
    const validation = brandOsSchema.safeParse(rawBody);
    if (!validation.success) {
      return ResponseOptimizer.createErrorResponse('Invalid request data', 400, {
        issues: validation.error.flatten(),
      });
    }

    const existing = await prisma.brandOperatingSystem.findUnique({
      where: { organizationId: orgId },
    });
    if (existing) {
      return ResponseOptimizer.createErrorResponse(
        'Brand operating system already exists for this organization',
        409
      );
    }

    const created = await prisma.$transaction(async tx => {
      const record = await tx.brandOperatingSystem.create({
        data: {
          organizationId: orgId,
          ...buildData(validation.data),
        } as Prisma.BrandOperatingSystemUncheckedCreateInput,
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'brand_operating_system_created',
          resource: 'brand_operating_system',
          resourceId: record.id,
          details: { organizationId: orgId },
          severity: 'medium',
          category: 'admin',
          outcome: 'success',
        },
      });
      return record;
    });

    const cache = getCache();
    await cache.invalidateByTag(`org:${orgId}`);

    logger.info('Brand operating system created', { organizationId: orgId, userId });
    return ResponseOptimizer.createResponse(
      { success: true, brandOperatingSystem: created },
      { cacheType: 'none', status: 201 }
    );
  } catch (error) {
    logger.error('Failed to create brand operating system', { error, orgId });
    return ResponseOptimizer.createErrorResponse(
      'Failed to create brand operating system',
      500
    );
  }
}

// ============================================================================
// PATCH — Update the org's BrandOperatingSystem
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return ResponseOptimizer.createErrorResponse('Authentication required', 401);
    }

    const isAdmin = await isOrgAdmin(userId, orgId);
    if (!isAdmin) {
      const isMember = await isOrgMember(userId, orgId);
      if (!isMember) {
        return ResponseOptimizer.createErrorResponse(
          'Organization not found or access denied',
          404
        );
      }
      return ResponseOptimizer.createErrorResponse(
        'Admin privileges required to update the brand operating system',
        403
      );
    }

    const rawBody = await request.json().catch(() => null);
    const validation = brandOsSchema.safeParse(rawBody);
    if (!validation.success) {
      return ResponseOptimizer.createErrorResponse('Invalid request data', 400, {
        issues: validation.error.flatten(),
      });
    }

    const existing = await prisma.brandOperatingSystem.findUnique({
      where: { organizationId: orgId },
    });
    if (!existing) {
      return ResponseOptimizer.createErrorResponse(
        'Brand operating system not found',
        404
      );
    }

    const updateData = buildData(validation.data);
    const updated = await prisma.$transaction(async tx => {
      const record = await tx.brandOperatingSystem.update({
        where: { organizationId: orgId },
        data: updateData as Prisma.BrandOperatingSystemUncheckedUpdateInput,
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'brand_operating_system_updated',
          resource: 'brand_operating_system',
          resourceId: record.id,
          details: { organizationId: orgId, updatedFields: Object.keys(updateData) },
          severity: 'medium',
          category: 'admin',
          outcome: 'success',
        },
      });
      return record;
    });

    const cache = getCache();
    await cache.invalidateByTag(`org:${orgId}`);

    logger.info('Brand operating system updated', {
      organizationId: orgId,
      userId,
      updatedFields: Object.keys(updateData),
    });
    return ResponseOptimizer.createResponse(
      { success: true, brandOperatingSystem: updated },
      { cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to update brand operating system', { error, orgId });
    return ResponseOptimizer.createErrorResponse(
      'Failed to update brand operating system',
      500
    );
  }
}

export const runtime = 'nodejs';
