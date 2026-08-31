/**
 * Cohort Analysis API
 *
 * Provides cohort-level retention analytics and churn-flagging.
 * Targets NRR >= 100% by surfacing top churn drivers, pricing discipline gaps,
 * and feature adoption correlations.
 *
 * Endpoints:
 * - GET /api/cohort-analysis?timeRange=7d|30d|90d
 * - GET /api/cohort-analysis/churn-flagged?gapDays=30
 *
 * @module app/api/cohort-analysis/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import {
  getEffectiveQueryFilter,
  getEffectiveOrganizationId,
} from '@/lib/multi-business/business-scope';

// =============================================================================
// Types
// =============================================================================

export interface CohortRetention {
  cohortDate: string;
  cohortSize: number;
  active30d: number;
  active90d: number;
  churn30d: number;
  churn90d: number;
  retention30d: number;
  retention90d: number;
}

export interface ChurnDriverInsight {
  driverType: string;
  drivers: {
    name: string;
    count: number;
    churnRate: number;
    impactScore: number;
  }[];
}

export interface PricingElasticityInsight {
  tier: string;
  monthlyPrice: number;
  churnRate: number;
  featureUsage: Record<string, number>;
  recommendation: string;
}

// =============================================================================
// Schemas
// =============================================================================

const timeRangeSchema = z
  .enum(['7d', '30d', '90d', '12m'])
  .optional()
  .default('30d');
const querySchema = z.object({
  timeRange: timeRangeSchema,
});

// =============================================================================
// Auth & Org Scoping
// =============================================================================

/**
 * Gets the authenticated userId from request cookies.
 * Throws 401 if no valid session found.
 */
async function getUserId(request: NextRequest): Promise<string> {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    throw new Error('Authentication required');
  }
  return userId;
}

/**
 * Resolves org-scoped campaign filter from JWT.
 * For multi-business owners, scopes to active organization.
 * For regular users, scopes by userId campaigns.
 */
async function getScopedFilter(userId: string) {
  try {
    const effectiveOrgId = await getEffectiveOrganizationId(userId);
    if (effectiveOrgId) {
      const campaignFilter = await getEffectiveQueryFilter(userId);
      if (Object.keys(campaignFilter).length > 0) {
        return { userId, effectiveOrgId, campaignFilter };
      }
    }
    return { userId, effectiveOrgId: null, campaignFilter: {} };
  } catch {
    const campaignFilter = await getEffectiveQueryFilter(userId);
    return { userId, effectiveOrgId: null, campaignFilter };
  }
}

// =============================================================================
// Churn-Flagging Logic
// =============================================================================

/**
 * Identifies users with activity gaps exceeding threshold.
 *
 * Logic:
 * - Uses lastLogin timestamp from User model.
 * - If lastLogin is null (first-time users), excludes from churn analysis.
 * - If lastLogin <= (now - gapDays), returns as churned.
 *
 * Returns org-scoped user IDs matching the condition.
 */
async function findChurnedUsers(
  userId: string,
  effectiveOrgId: string | null,
  campaignFilter: Record<string, unknown>,
  gapDays: number = 30
): Promise<string[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - gapDays);

  const userIds = await prisma.user.findMany({
    where: {
      lastLogin: { lte: cutoffDate },
      id: { in: [userId] }, // Only current user and org-scoped scope
      ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
    },
    select: { id: true },
  });

  return userIds.map(u => u.id);
}

// =============================================================================
// GET /api/cohort-analysis
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const { effectiveOrgId, campaignFilter } = await getScopedFilter(userId);

    const url = new URL(request.url);
    const timeRangeParam = url.searchParams.get('timeRange') || '30d';
    const timeRange = z.enum(['7d', '30d', '90d']).parse(timeRangeParam);

    // Build date range from timeRange
    const cohortStartDate = new Date();
    const now = new Date();
    const ranges = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };
    const daysAgo = ranges[timeRange];
    cohortStartDate.setDate(cohortStartDate.getDate() - daysAgo);

    // Fetch cohorts in parallel
    const [
      userCountsByDate,
      activeUserCounts,
      churnCounts,
      featureUsageByCohort,
    ] = await Promise.all([
      // Count new users per day in the range
      prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: { gte: cohortStartDate },
          ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
        },
        _count: { id: true },
      }),

      // Count active users (lastLogin <= now) per cohort
      prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: { gte: cohortStartDate },
          lastLogin: { lte: now },
          ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
        },
        _count: { id: true },
      }),

      // Count churned users (lastLogin <= (now - daysAgo))
      prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: { gte: cohortStartDate },
          lastLogin: { lte: new Date(now.getTime() - daysAgo * 86400000) },
          ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
        },
        _count: { id: true },
      }),

      // Feature usage aggregated by user within the cohort
      prisma.apiUsage.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: cohortStartDate },
          ...(effectiveOrgId
            ? { user: { organizationId: effectiveOrgId } }
            : {}),
        },
        _count: { id: true },
      }),
    ]);

    // Build cohort retention table
    const retentionTable: CohortRetention[] = userCountsByDate.map(userRow => {
      const cohortDate = userRow.createdAt.toISOString().split('T')[0];
      const cohortSize = userRow._count.id;

      // Find active count for this cohort date
      const activeRow = activeUserCounts.find(
        a => a.createdAt.toISOString().split('T')[0] === cohortDate
      );
      const activeCount = activeRow?._count.id || 0;

      // Find churned count for this cohort date
      const churnRow = churnCounts.find(
        c => c.createdAt.toISOString().split('T')[0] === cohortDate
      );
      const churnCount = churnRow?._count.id || 0;

      const retention30d =
        cohortSize > 0 ? ((cohortSize - churnCount) / cohortSize) * 100 : 0;
      const retention90d =
        activeCount > 0 ? (activeCount / cohortSize) * 100 : 0;

      return {
        cohortDate,
        cohortSize,
        active30d: cohortSize - churnCount,
        active90d: activeCount,
        churn30d: churnCount,
        churn90d: 0, // Simplified for 7d/30d range
        retention30d,
        retention90d: retention90d > 0 ? retention90d : 0,
      };
    });

    // Compute top churn drivers
    const churnDriverInsights = await computeChurnDrivers(
      effectiveOrgId,
      campaignFilter
    );

    // Compute pricing elasticity insights
    const pricingElasticityInsights =
      await computePricingElasticity(effectiveOrgId);

    // Compute feature usage vs retention correlation
    const featureAdoptionInsights = await computeFeatureAdoption(
      effectiveOrgId,
      cohortStartDate
    );

    const responseData = {
      timeRange,
      cohorts: retentionTable,
      churnDrivers: churnDriverInsights,
      pricingElasticity: pricingElasticityInsights,
      featureAdoption: featureAdoptionInsights,
      generatedAt: now.toISOString(),
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      {
        error: 'Server Error',
        message: err.message || 'Failed to retrieve cohort analysis',
        details: err.stack,
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/cohort-analysis/churn-flagged?gapDays=30
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const { effectiveOrgId, campaignFilter } = await getScopedFilter(userId);

    const body = await request.json().catch(() => ({}));
    const gapDays = body.gapDays || 30;

    // Find churned users
    const churnedUserIds = await findChurnedUsers(
      userId,
      effectiveOrgId || '',
      campaignFilter,
      gapDays
    );

    // Fetch detailed churned user data (names, emails, etc.)
    const churnedUsers = await prisma.user.findMany({
      where: {
        id: { in: churnedUserIds },
        ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        lastLogin: true,
        createdAt: true,
        organizationId: true,
      },
    });

    const responseData = {
      gapDays,
      count: churnedUsers.length,
      users: churnedUsers,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      {
        error: 'Server Error',
        message: err.message || 'Failed to retrieve churn-flagged users',
        details: err.stack,
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// Churn Drivers Computation
// =============================================================================

async function computeChurnDrivers(
  effectiveOrgId: string | null,
  campaignFilter: Record<string, unknown>
): Promise<ChurnDriverInsight> {
  // Strategy: Aggregates churned users by feature usage patterns (ApiUsage status, endpoint categories)
  // In production, enrich with tier/campaign data from Organization, Campaign.

  // Fetch all churned users (simplified for prototype)
  const churnedUsers = await prisma.user.findMany({
    where: effectiveOrgId
      ? {
          organizationId: effectiveOrgId,
          lastLogin: { lte: new Date(Date.now() - 30 * 86400000) },
        }
      : { lastLogin: { lte: new Date(Date.now() - 30 * 86400000) } },
    select: { id: true },
  });

  const userCounts = churnedUsers.length;

  // Group churned users by endpoint category
  // For prototype, use 'success' vs 'error' status categories (future: group by endpoint prefix)
  const statusGroups = churnedUsers.reduce(
    (acc, user) => {
      const statusCounts = await prisma.apiUsage.findMany({
        where: { userId: user.id },
        select: { status: true },
      });

      statusCounts.forEach(s => {
        acc[s.status] = (acc[s.status] || 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>
  );

  // Derive drivers: high 'error' count = API reliability churn driver
  const drivers: ChurnDriverInsight['drivers'] = [
    {
      name: 'API reliability errors',
      count: statusGroups.error || 0,
      churnRate:
        userCounts > 0 ? ((statusGroups.error || 0) / userCounts) * 100 : 0,
      impactScore: Math.round(((statusGroups.error || 0) / userCounts) * 10), // Simple impact heuristic
    },
    {
      name: 'Rate limiting issues',
      count: statusGroups['rate_limited'] || 0,
      churnRate:
        userCounts > 0
          ? ((statusGroups['rate_limited'] || 0) / userCounts) * 100
          : 0,
      impactScore: Math.round(
        ((statusGroups['rate_limited'] || 0) / userCounts) * 10
      ),
    },
    {
      name: 'Feature adoption lag',
      count: userCounts - (statusGroups.success || 0),
      churnRate:
        userCounts > 0
          ? ((userCounts - (statusGroups.success || 0)) / userCounts) * 100
          : 0,
      impactScore: 5, // Heuristic placeholder
    },
  ];

  return {
    driverType: 'feature_adoption_reliability',
    drivers,
  };
}

// =============================================================================
// Pricing Elasticity Computation
// =============================================================================

async function computePricingElasticity(
  effectiveOrgId: string | null
): Promise<PricingElasticityInsight[]> {
  const tiers: PricingElasticityInsight[] = [
    {
      tier: 'starter',
      monthlyPrice: 29,
      churnRate: 0,
      featureUsage: { platforms: 3, posts_per_month: 100, analytics: 30 },
      recommendation:
        'Monitor engagement; strengthen onboarding to reduce self-service drop-off',
    },
    {
      tier: 'professional',
      monthlyPrice: 79,
      churnRate: 0,
      featureUsage: { platforms: 8, posts_per_month: 500, analytics: 90 },
      recommendation: 'Upsell team features; increase support touchpoints',
    },
    {
      tier: 'business',
      monthlyPrice: 149,
      churnRate: 0,
      featureUsage: {
        platforms: 'unlimited',
        posts_per_month: 2000,
        analytics: 365,
      },
      recommendation:
        'Focus on retention campaigns; expand video/video-generations availability',
    },
    {
      tier: 'enterprise',
      monthlyPrice: 299,
      churnRate: 0,
      featureUsage: {
        platforms: 'unlimited',
        posts_per_month: 'unlimited',
        analytics: 'unlimited',
      },
      recommendation:
        'Provide dedicated account management; ensure SLA compliance',
    },
  ];

  // For prototype, uses static reference data. In production, enrich from Organization.plan,
  // churn rates per tier, and feature adoption from ApiUsage or Campaign data.

  return tiers;
}

// =============================================================================
// Feature Adoption Correlation Computation
// =============================================================================

async function computeFeatureAdoption(
  effectiveOrgId: string | null,
  cohortStartDate: Date
) {
  // Prototype: returns aggregated feature adoption metrics per cohort
  const featureUsage = await prisma.apiUsage.groupBy({
    by: ['endpoint'],
    where: {
      createdAt: { gte: cohortStartDate },
      ...(effectiveOrgId ? { user: { organizationId: effectiveOrgId } } : {}),
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  const usageByUser = await prisma.apiUsage.groupBy({
    by: ['userId'],
    where: {
      createdAt: { gte: cohortStartDate },
      ...(effectiveOrgId ? { user: { organizationId: effectiveOrgId } } : {}),
    },
    _count: { id: true },
  });

  const totalActiveUsers = usageByUser.length;
  const avgUsagePerUser =
    totalActiveUsers > 0
      ? usageByUser.reduce((sum, u) => sum + u._count.id, 0) / totalActiveUsers
      : 0;

  return {
    featureUsage: featureUsage.map(f => ({
      feature: f.endpoint,
      usageCount: f._count.id,
    })),
    totalActiveUsers,
    avgUsagePerUser,
    cohortStartDate: cohortStartDate.toISOString(),
  };
}
