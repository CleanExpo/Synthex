/**
 * SEO Experiments API
 *
 * GET  /api/experiments/experiments — list user's experiments
 * POST /api/experiments/experiments — create new experiment
 *
 * ENVIRONMENT VARIABLES:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// Validation Schema
// ============================================================================

const CreateExperimentSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  experimentType: z.enum([
    'title-tag',
    'meta-description',
    'h1',
    'schema',
    'content-structure',
    'internal-links',
  ]),
  targetUrl: z.string().url(),
  hypothesis: z.string().min(10).max(1000),
  metricToTrack: z.enum([
    'geo-score',
    'eeat-score',
    'quality-score',
    'position',
    'clicks',
  ]),
  originalValue: z.string().min(1).max(5000),
  variantValue: z.string().min(1).max(5000),
});

// ============================================================================
// GET — List Experiments
// ============================================================================

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

  const userId = security.context.userId!;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const experimentType = searchParams.get('type') ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));

    const where = {
      userId,
      ...(status ? { status } : {}),
      ...(experimentType ? { experimentType } : {}),
    };

    const [experiments, total] = await Promise.all([
      prisma.sEOExperiment.findMany({
        where,
        include: {
          observations: {
            orderBy: { recordedAt: 'desc' },
            take: 10,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sEOExperiment.count({ where }),
    ]);

    return APISecurityChecker.createSecureResponse({
      experiments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('[experiments] GET failed', { error, userId });
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch experiments' },
      500
    );
  }
}

// ============================================================================
// POST — Create Experiment
// ============================================================================

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
    const parsed = CreateExperimentSchema.safeParse(body);

    if (!parsed.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid request', details: parsed.error.flatten() },
        400
      );
    }

    const data = parsed.data;

    // Resolve orgId from user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    const orgId = user?.organizationId ?? userId;

    const experiment = await prisma.sEOExperiment.create({
      data: {
        userId,
        orgId,
        name: data.name,
        description: data.description,
        experimentType: data.experimentType,
        targetUrl: data.targetUrl,
        hypothesis: data.hypothesis,
        metricToTrack: data.metricToTrack,
        originalValue: data.originalValue,
        variantValue: data.variantValue,
        status: 'draft',
      },
    });

    logger.info('[experiments] Created experiment', {
      userId,
      experimentId: experiment.id,
      type: data.experimentType,
    });

    return APISecurityChecker.createSecureResponse({ experiment }, 201);
  } catch (error) {
    logger.error('[experiments] POST failed', { error, userId });
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to create experiment' },
      500
    );
  }
}
