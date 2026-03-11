/**
 * Bayesian Optimisation Spaces API
 *
 * GET  /api/bayesian/spaces  — List all BO spaces for the authenticated org
 * POST /api/bayesian/spaces  — Create a new BO space for the org
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - BAYESIAN_SERVICE_URL (optional — falls back gracefully when absent)
 * - BAYESIAN_SERVICE_API_KEY (optional — paired with BAYESIAN_SERVICE_URL)
 *
 * @module app/api/bayesian/spaces/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { getBayesianClient } from '@/lib/bayesian/client';
import { isSurfaceAvailable, isWithinBOLimit, getBOFeatureLimits } from '@/lib/bayesian/feature-limits';
import { GEO_SCORE_BOUNDS } from '@/lib/bayesian/surfaces/geo-weights';
import { TACTIC_BOUNDS } from '@/lib/bayesian/surfaces/tactic-weights';
import type { BOSurface } from '@/lib/bayesian/types';
import { logger } from '@/lib/logger';

// ─── Zod Schemas ───────────────────────────────────────────────────────────────

const ALL_SURFACES: [BOSurface, ...BOSurface[]] = [
  'geo_score_weights',
  'tactic_weights',
  'experiment_sampling',
  'content_scheduling',
  'prompt_testing',
  'backlink_scoring',
  'authority_validation',
  'psychology_levers',
  'self_healing_priority',
  'campaign_roi',
];

const createSpaceSchema = z.object({
  surface: z.enum(ALL_SURFACES),
  acquisitionFunction: z.enum(['ucb', 'ei', 'poi']).optional(),
});

// ─── Parameter bounds per surface ──────────────────────────────────────────────

function getBoundsForSurface(surface: BOSurface): Record<string, { min: number; max: number }> {
  if (surface === 'geo_score_weights') return GEO_SCORE_BOUNDS;
  if (surface === 'tactic_weights') return TACTIC_BOUNDS;
  // Generic bounds for other surfaces — 0.0 to 1.0
  return {};
}

// ─── GET — List spaces ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorised', message: 'Authentication required' },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      return NextResponse.json({ data: [] });
    }

    const spaces = await prisma.bOSpace.findMany({
      where: { orgId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: spaces });
  } catch (error) {
    logger.error('GET /api/bayesian/spaces error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to list spaces' },
      { status: 500 },
    );
  }
}

// ─── POST — Create space ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorised', message: 'Authentication required' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const validation = createSpaceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 },
      );
    }

    const { surface, acquisitionFunction } = validation.data;

    // Resolve org and plan
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, organization: { select: { plan: true } } },
    });
    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Organisation required to create a BO space' },
        { status: 403 },
      );
    }
    const orgId = user.organizationId;
    const plan = user.organization?.plan ?? 'free';

    // Feature-limit checks
    if (!isSurfaceAvailable(plan, surface)) {
      return NextResponse.json(
        { error: 'Forbidden', message: `Surface '${surface}' is not available on the ${plan} plan` },
        { status: 403 },
      );
    }

    const currentCount = await prisma.bOSpace.count({ where: { orgId } });
    const limits = getBOFeatureLimits(plan);
    if (!isWithinBOLimit(plan, 'optimisationSpaces', currentCount)) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: `Optimisation space limit reached (${limits.optimisationSpaces} spaces on ${plan} plan)`,
        },
        { status: 403 },
      );
    }

    const parameters = getBoundsForSurface(surface);
    const acquisitionFn = acquisitionFunction ?? 'ei';
    const constraints = { sumEquals: 1 };

    // Attempt to create space in BO service (best-effort — falls back to pending)
    let externalStatus = 'pending';
    const client = await getBayesianClient();
    if (client) {
      try {
        await client.createSpace({
          spaceId: `${orgId}_${surface}`,
          orgId,
          surface,
          parameters,
          acquisitionFunction: acquisitionFn,
          constraints,
        });
        externalStatus = 'active';
      } catch (err) {
        logger.warn('BO service createSpace failed — persisting as pending', { surface, orgId, err });
      }
    }

    // Persist to DB
    const space = await prisma.bOSpace.upsert({
      where: { orgId_surface: { orgId, surface } },
      create: {
        orgId,
        userId,
        surface,
        parameters,
        acquisitionFn,
        constraints,
        status: externalStatus,
      },
      update: {
        acquisitionFn,
        constraints,
        status: externalStatus,
      },
    });

    return NextResponse.json({ data: space }, { status: 201 });
  } catch (error) {
    logger.error('POST /api/bayesian/spaces error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to create space' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
