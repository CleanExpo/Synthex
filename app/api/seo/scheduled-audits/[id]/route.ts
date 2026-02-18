/**
 * Scheduled SEO Audit Target API (Single Resource)
 *
 * GET /api/seo/scheduled-audits/[id] - Get single target details
 * PATCH /api/seo/scheduled-audits/[id] - Update target settings
 * DELETE /api/seo/scheduled-audits/[id] - Remove target
 *
 * Protected by authentication. Verifies ownership.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { prisma } from '@/lib/prisma';

// Update validation schema
const updateTargetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  alertThreshold: z.number().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/seo/scheduled-audits/[id]
 * Get single target details with audit history
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
    }

    // Fetch the target and verify ownership
    const target = await prisma.scheduledAuditTarget.findUnique({
      where: { id },
    });

    if (!target) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Scheduled audit target not found' },
        404
      );
    }

    if (target.userId !== userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Access denied' },
        403
      );
    }

    // Get audit history for this target
    const auditHistory = await prisma.sEOAudit.findMany({
      where: {
        userId,
        url: target.url,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        overallScore: true,
        technicalScore: true,
        recommendations: true,
        createdAt: true,
      },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      target,
      auditHistory,
    });
  } catch (error) {
    console.error('Get scheduled audit target error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch scheduled audit target' },
      500
    );
  }
}

/**
 * PATCH /api/seo/scheduled-audits/[id]
 * Update target settings
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
    }

    // Fetch the target and verify ownership
    const target = await prisma.scheduledAuditTarget.findUnique({
      where: { id },
    });

    if (!target) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Scheduled audit target not found' },
        404
      );
    }

    if (target.userId !== userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Access denied' },
        403
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = updateTargetSchema.safeParse(body);

    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Invalid request',
          details: validation.error.flatten().fieldErrors,
        },
        400
      );
    }

    // Update the target
    const updatedTarget = await prisma.scheduledAuditTarget.update({
      where: { id },
      data: validation.data,
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      target: updatedTarget,
    });
  } catch (error) {
    console.error('Update scheduled audit target error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to update scheduled audit target' },
      500
    );
  }
}

/**
 * DELETE /api/seo/scheduled-audits/[id]
 * Remove target
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
    }

    // Fetch the target and verify ownership
    const target = await prisma.scheduledAuditTarget.findUnique({
      where: { id },
    });

    if (!target) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Scheduled audit target not found' },
        404
      );
    }

    if (target.userId !== userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Access denied' },
        403
      );
    }

    // Delete the target
    await prisma.scheduledAuditTarget.delete({
      where: { id },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      message: 'Scheduled audit target deleted',
    });
  } catch (error) {
    console.error('Delete scheduled audit target error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to delete scheduled audit target' },
      500
    );
  }
}
