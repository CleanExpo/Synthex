/**
 * Scheduled SEO Audits API
 *
 * POST /api/seo/scheduled-audits - Create a new scheduled audit target
 * GET /api/seo/scheduled-audits - List user's scheduled audit targets
 *
 * Protected by authentication. Requires professional+ subscription.
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

// Request validation schemas
const createTargetSchema = z.object({
  url: z.string().url('Invalid URL provided'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  frequency: z.enum(['daily', 'weekly', 'monthly'], {
    errorMap: () => ({ message: 'Frequency must be daily, weekly, or monthly' }),
  }),
  alertThreshold: z.number().min(1).max(100).optional().default(10),
});

/**
 * POST /api/seo/scheduled-audits
 * Create a new scheduled audit target
 */
export async function POST(request: NextRequest) {
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

    // Get subscription - require professional+ plan
    const subscription = await subscriptionService.getOrCreateSubscription(userId);

    if (subscription.plan === 'free' || subscription.plan === 'starter') {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Scheduled audits require a Professional or higher subscription',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = createTargetSchema.safeParse(body);

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

    const { url, name, frequency, alertThreshold } = validation.data;

    // Check for duplicate URL for this user
    const existingTarget = await prisma.scheduledAuditTarget.findFirst({
      where: { userId, url },
    });

    if (existingTarget) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'A scheduled audit for this URL already exists',
          existingTarget: { id: existingTarget.id, name: existingTarget.name },
        },
        409
      );
    }

    // Create the scheduled audit target
    const target = await prisma.scheduledAuditTarget.create({
      data: {
        userId,
        url,
        name,
        frequency,
        alertThreshold,
        enabled: true,
      },
    });

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        target,
      },
      201
    );
  } catch (error) {
    console.error('Create scheduled audit target error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to create scheduled audit target' },
      500
    );
  }
}

/**
 * GET /api/seo/scheduled-audits
 * List user's scheduled audit targets
 */
export async function GET(request: NextRequest) {
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

    // Get subscription - require professional+ plan
    const subscription = await subscriptionService.getOrCreateSubscription(userId);

    if (subscription.plan === 'free' || subscription.plan === 'starter') {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Scheduled audits require a Professional or higher subscription',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    // Fetch user's scheduled audit targets
    const targets = await prisma.scheduledAuditTarget.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Get latest audit for each target (for score display)
    const targetsWithLatestAudit = await Promise.all(
      targets.map(async (target) => {
        const latestAudit = await prisma.sEOAudit.findFirst({
          where: {
            userId,
            url: target.url,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            overallScore: true,
            createdAt: true,
          },
        });

        return {
          ...target,
          latestAudit,
        };
      })
    );

    return APISecurityChecker.createSecureResponse({
      success: true,
      targets: targetsWithLatestAudit,
      total: targets.length,
    });
  } catch (error) {
    console.error('List scheduled audit targets error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch scheduled audit targets' },
      500
    );
  }
}
