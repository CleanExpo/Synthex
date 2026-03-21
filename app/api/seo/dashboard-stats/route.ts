/**
 * SEO Dashboard Stats API
 *
 * GET /api/seo/dashboard-stats
 * Returns aggregate stats for the SEO dashboard quick-stat cards:
 *   - SEO Health Score (latest audit overallScore)
 *   - Issues Found (total issues from latest audit)
 *   - AI Visibility (latest GEO analysis overallScore as %)
 *
 * Protected by authentication. Follows the same user-scoped
 * pattern as other SEO routes (SEOAudit is keyed by userId).
 *
 * UNI-1616
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
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

    // Fetch latest full SEO audit and latest GEO analysis in parallel
    const [latestAudit, previousAudit, latestGeo, previousGeo] =
      await Promise.all([
        // Most recent full audit
        prisma.sEOAudit.findFirst({
          where: { userId, auditType: 'full' },
          orderBy: { createdAt: 'desc' },
          select: {
            overallScore: true,
            recommendations: true,
            rawData: true,
            createdAt: true,
          },
        }),
        // Second-most-recent full audit (for trend comparison)
        prisma.sEOAudit.findFirst({
          where: { userId, auditType: 'full' },
          orderBy: { createdAt: 'desc' },
          skip: 1,
          select: {
            overallScore: true,
            recommendations: true,
            rawData: true,
          },
        }),
        // Most recent GEO analysis
        prisma.gEOAnalysis.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: {
            overallScore: true,
            createdAt: true,
          },
        }),
        // Second-most-recent GEO analysis (for trend comparison)
        prisma.gEOAnalysis.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: 1,
          select: {
            overallScore: true,
          },
        }),
      ]);

    // --- SEO Health Score ---
    let healthScore: number | null = null;
    let healthScoreChange: number | null = null;
    if (latestAudit) {
      healthScore = Math.round(latestAudit.overallScore);
      if (previousAudit) {
        healthScoreChange =
          Math.round(latestAudit.overallScore) -
          Math.round(previousAudit.overallScore);
      }
    }

    // --- Issues Found ---
    let issuesFound: number | null = null;
    let issuesChange: number | null = null;
    if (latestAudit) {
      issuesFound = extractIssueCount(
        latestAudit.rawData,
        latestAudit.recommendations
      );
      if (previousAudit) {
        const previousIssues = extractIssueCount(
          previousAudit.rawData,
          previousAudit.recommendations
        );
        if (previousIssues !== null && issuesFound !== null) {
          issuesChange = issuesFound - previousIssues;
        }
      }
    }

    // --- AI Visibility ---
    let aiVisibility: number | null = null;
    let aiVisibilityChange: number | null = null;
    if (latestGeo) {
      aiVisibility = Math.round(latestGeo.overallScore);
      if (previousGeo) {
        aiVisibilityChange =
          Math.round(latestGeo.overallScore) -
          Math.round(previousGeo.overallScore);
      }
    }

    return APISecurityChecker.createSecureResponse({
      success: true,
      stats: {
        healthScore: {
          value: healthScore,
          change: healthScoreChange,
          updatedAt: latestAudit?.createdAt ?? null,
        },
        issuesFound: {
          value: issuesFound,
          change: issuesChange,
          updatedAt: latestAudit?.createdAt ?? null,
        },
        aiVisibility: {
          value: aiVisibility,
          change: aiVisibilityChange,
          updatedAt: latestGeo?.createdAt ?? null,
        },
      },
    });
  } catch (error) {
    logger.error('SEO dashboard stats error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch SEO dashboard stats' },
      500
    );
  }
}

/**
 * Extract total issue count from audit data.
 *
 * The audit stores issues in two possible shapes:
 * 1. rawData.issues = { critical, major, minor, info } (counts object)
 * 2. recommendations = Array of issue objects
 *
 * We try rawData first (more reliable counts), then fall back to
 * recommendations array length.
 */
function extractIssueCount(
  rawData: unknown,
  recommendations: unknown
): number | null {
  // Try rawData.issues counts object first
  if (rawData && typeof rawData === 'object' && rawData !== null) {
    const rd = rawData as Record<string, unknown>;
    if (rd.issues && typeof rd.issues === 'object' && rd.issues !== null) {
      const issues = rd.issues as Record<string, unknown>;
      const critical =
        typeof issues.critical === 'number' ? issues.critical : 0;
      const major = typeof issues.major === 'number' ? issues.major : 0;
      const minor = typeof issues.minor === 'number' ? issues.minor : 0;
      const info = typeof issues.info === 'number' ? issues.info : 0;
      return critical + major + minor + info;
    }
  }

  // Fall back to recommendations array length
  if (Array.isArray(recommendations)) {
    return recommendations.length;
  }

  return null;
}
