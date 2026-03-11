/**
 * Healing Analysis API
 *
 * POST /api/experiments/healing/analyze
 * Analyzes a URL for SEO healing opportunities and persists results.
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { analyzeForHealing } from '@/lib/experiments/self-healer';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const AnalyzeSchema = z.object({
  url: z.string().url(),
  // Optional metadata the client can provide (e.g. from an existing GEO analysis)
  metadata: z
    .object({
      title: z.string().optional(),
      metaDescription: z.string().optional(),
      h1: z.string().optional(),
      hasSchema: z.boolean().optional(),
      geoScore: z.number().optional(),
      qualityScore: z.number().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
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

  const userId = security.context.userId!;

  try {
    const body = await request.json();
    const parsed = AnalyzeSchema.safeParse(body);

    if (!parsed.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid request', details: parsed.error.flatten() },
        400
      );
    }

    const { url, metadata } = parsed.data;

    // Resolve orgId from user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    const orgId = user?.organizationId ?? userId;

    const issues = await analyzeForHealing(url, userId, orgId, metadata);

    logger.info('[healing] Analyzed URL', {
      userId,
      url,
      issueCount: issues.length,
    });

    return APISecurityChecker.createSecureResponse({
      url,
      issues,
      issueCount: issues.length,
      criticalCount: issues.filter((i) => i.severity === 'critical').length,
      warningCount: issues.filter((i) => i.severity === 'warning').length,
      analysedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[healing] ANALYZE failed', { error, userId });
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to analyze URL' },
      500
    );
  }
}
