/**
 * Client Profile API (SYN-515 — Client layer)
 *
 * @description Org-scoped CRUD for the ClientProfile (the Client layer of the
 * 3-layer prompt system):
 * - GET:   Fetch the org's ClientProfile (null when none exists)
 * - POST:  Create the org's ClientProfile (409 if one already exists)
 * - PATCH: Update the org's ClientProfile (404 when none exists)
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

const clientProfileSchema = z.object({
  budgetTier: z.string().nullable().optional(),
  intakeStatus: z.enum(['pending', 'in_progress', 'complete']).optional(),
  intakeSource: z.string().nullable().optional(),
  intakeCompletedAt: z.string().datetime().nullable().optional(),
  icp: z.record(z.string(), z.unknown()).optional(),
  offers: z.array(z.string()).optional(),
  proofPoints: z.array(z.string()).optional(),
  competitors: z.array(z.string()).optional(),
  toneKeywords: z.array(z.string()).optional(),
  antiPatterns: z.array(z.string()).optional(),
  vocabularyBank: z.record(z.string(), z.unknown()).optional(),
  goals: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
});

type ClientProfileInput = z.infer<typeof clientProfileSchema>;

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
function buildData(body: ClientProfileInput): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (body.budgetTier !== undefined) data.budgetTier = body.budgetTier;
  if (body.intakeStatus !== undefined) data.intakeStatus = body.intakeStatus;
  if (body.intakeSource !== undefined) data.intakeSource = body.intakeSource;
  if (body.intakeCompletedAt !== undefined)
    data.intakeCompletedAt = body.intakeCompletedAt
      ? new Date(body.intakeCompletedAt)
      : null;
  if (body.icp !== undefined) data.icp = body.icp as Prisma.InputJsonValue;
  if (body.offers !== undefined)
    data.offers = body.offers as Prisma.InputJsonValue;
  if (body.proofPoints !== undefined)
    data.proofPoints = body.proofPoints as Prisma.InputJsonValue;
  if (body.competitors !== undefined)
    data.competitors = body.competitors as Prisma.InputJsonValue;
  if (body.toneKeywords !== undefined)
    data.toneKeywords = body.toneKeywords as Prisma.InputJsonValue;
  if (body.antiPatterns !== undefined)
    data.antiPatterns = body.antiPatterns as Prisma.InputJsonValue;
  if (body.vocabularyBank !== undefined)
    data.vocabularyBank = body.vocabularyBank as Prisma.InputJsonValue;
  if (body.goals !== undefined) data.goals = body.goals as Prisma.InputJsonValue;
  if (body.channels !== undefined)
    data.channels = body.channels as Prisma.InputJsonValue;
  if (body.constraints !== undefined)
    data.constraints = body.constraints as Prisma.InputJsonValue;
  return data;
}

// ============================================================================
// GET — Fetch the org's ClientProfile
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

    const clientProfile = await prisma.clientProfile.findUnique({
      where: { organizationId: orgId },
    });

    return ResponseOptimizer.createResponse(
      { clientProfile },
      { cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to get client profile', { error, orgId });
    return ResponseOptimizer.createErrorResponse(
      'Failed to get client profile',
      500
    );
  }
}

// ============================================================================
// POST — Create the org's ClientProfile
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
        'Admin privileges required to create the client profile',
        403
      );
    }

    const rawBody = await request.json().catch(() => null);
    const validation = clientProfileSchema.safeParse(rawBody);
    if (!validation.success) {
      return ResponseOptimizer.createErrorResponse('Invalid request data', 400, {
        issues: validation.error.flatten(),
      });
    }

    const existing = await prisma.clientProfile.findUnique({
      where: { organizationId: orgId },
    });
    if (existing) {
      return ResponseOptimizer.createErrorResponse(
        'Client profile already exists for this organization',
        409
      );
    }

    const created = await prisma.$transaction(async tx => {
      const record = await tx.clientProfile.create({
        data: {
          organizationId: orgId,
          ...buildData(validation.data),
        } as Prisma.ClientProfileUncheckedCreateInput,
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'client_profile_created',
          resource: 'client_profile',
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

    logger.info('Client profile created', { organizationId: orgId, userId });
    return ResponseOptimizer.createResponse(
      { success: true, clientProfile: created },
      { cacheType: 'none', status: 201 }
    );
  } catch (error) {
    logger.error('Failed to create client profile', { error, orgId });
    return ResponseOptimizer.createErrorResponse(
      'Failed to create client profile',
      500
    );
  }
}

// ============================================================================
// PATCH — Update the org's ClientProfile
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
        'Admin privileges required to update the client profile',
        403
      );
    }

    const rawBody = await request.json().catch(() => null);
    const validation = clientProfileSchema.safeParse(rawBody);
    if (!validation.success) {
      return ResponseOptimizer.createErrorResponse('Invalid request data', 400, {
        issues: validation.error.flatten(),
      });
    }

    const existing = await prisma.clientProfile.findUnique({
      where: { organizationId: orgId },
    });
    if (!existing) {
      return ResponseOptimizer.createErrorResponse('Client profile not found', 404);
    }

    const updateData = buildData(validation.data);
    const updated = await prisma.$transaction(async tx => {
      const record = await tx.clientProfile.update({
        where: { organizationId: orgId },
        data: updateData as Prisma.ClientProfileUncheckedUpdateInput,
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'client_profile_updated',
          resource: 'client_profile',
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

    logger.info('Client profile updated', {
      organizationId: orgId,
      userId,
      updatedFields: Object.keys(updateData),
    });
    return ResponseOptimizer.createResponse(
      { success: true, clientProfile: updated },
      { cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to update client profile', { error, orgId });
    return ResponseOptimizer.createErrorResponse(
      'Failed to update client profile',
      500
    );
  }
}

export const runtime = 'nodejs';
