/**
 * SEO API - Base Route
 *
 * Provides SEO tools and analysis endpoints for the dashboard.
 * All endpoints are protected behind authentication and subscription checks.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService, PLAN_LIMITS } from '@/lib/stripe/subscription-service';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/seo
 * Returns SEO tools status and usage for the authenticated user
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

    // Get subscription info
    const subscription = await subscriptionService.getOrCreateSubscription(userId);

    // Calculate SEO limits based on plan
    const planLimits = PLAN_LIMITS[subscription.plan] || PLAN_LIMITS.free;

    // Check if user has SEO access
    const hasSeoAccess = subscription.plan !== 'free';

    // Count actual SEO usage this billing period (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [auditCount, pageCount] = await Promise.all([
      prisma.sEOAudit.count({
        where: { userId, auditType: 'full', createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.sEOAudit.count({
        where: { userId, auditType: 'page', createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    return APISecurityChecker.createSecureResponse({
      success: true,
      seo: {
        hasAccess: hasSeoAccess,
        plan: subscription.plan,
        limits: {
          audits: planLimits.maxSeoAudits,
          pages: planLimits.maxSeoPages,
        },
        usage: {
          audits: auditCount,
          pages: pageCount,
        },
        features: {
          siteAudit: hasSeoAccess,
          pageAnalysis: hasSeoAccess,
          schemaGenerator: hasSeoAccess,
          geoOptimization: subscription.plan === 'business' || subscription.plan === 'custom',
          sitemapAnalyzer: hasSeoAccess,
          competitorPages: hasSeoAccess,
          hreflangChecker: subscription.plan === 'business' || subscription.plan === 'custom',
          contentOptimizer: subscription.plan === 'business' || subscription.plan === 'custom',
        },
      },
    });
  } catch (error) {
    logger.error('SEO API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch SEO status' },
      500
    );
  }
}

const seoActionSchema = z.object({
  action: z.string().optional(),
  feature: z.string().optional(),
});

/**
 * POST /api/seo
 * Validates SEO access and returns feature availability
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

    const body = await request.json();
    const seoValidation = seoActionSchema.safeParse(body);
    if (!seoValidation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid request data', details: seoValidation.error.issues },
        400
      );
    }
    const { action, feature } = seoValidation.data;

    // Get subscription
    const subscription = await subscriptionService.getOrCreateSubscription(userId);

    // Check if user can use the requested feature
    if (subscription.plan === 'free') {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'SEO tools require a paid subscription',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    // Check limits based on action
    const planLimits = PLAN_LIMITS[subscription.plan] || PLAN_LIMITS.free;

    // Check actual usage against plan limits
    const billingPeriodStart = new Date();
    billingPeriodStart.setDate(billingPeriodStart.getDate() - 30);

    if (action === 'audit' && planLimits.maxSeoAudits !== -1) {
      const auditUsage = await prisma.sEOAudit.count({
        where: { userId, auditType: 'full', createdAt: { gte: billingPeriodStart } },
      });
      if (auditUsage >= planLimits.maxSeoAudits) {
        return APISecurityChecker.createSecureResponse(
          {
            success: false,
            error: `SEO audit limit reached (${auditUsage}/${planLimits.maxSeoAudits} this period)`,
            upgradeRequired: true,
          },
          429
        );
      }
    }

    if (action === 'page-analysis' && planLimits.maxSeoPages !== -1) {
      const pageUsage = await prisma.sEOAudit.count({
        where: { userId, auditType: 'page', createdAt: { gte: billingPeriodStart } },
      });
      if (pageUsage >= planLimits.maxSeoPages) {
        return APISecurityChecker.createSecureResponse(
          {
            success: false,
            error: `Page analysis limit reached (${pageUsage}/${planLimits.maxSeoPages} this period)`,
            upgradeRequired: true,
          },
          429
        );
      }
    }

    return APISecurityChecker.createSecureResponse({
      success: true,
      allowed: true,
      plan: subscription.plan,
      feature,
    });
  } catch (error) {
    logger.error('SEO API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to validate SEO access' },
      500
    );
  }
}
