/**
 * Bayesian Optimisation Suggest API
 *
 * POST /api/bayesian/suggest — Get next suggested parameters from BO
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - BAYESIAN_SERVICE_URL (required — returns 503 when service is down)
 * - BAYESIAN_SERVICE_API_KEY (required)
 *
 * @module app/api/bayesian/suggest/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { getBayesianClient } from '@/lib/bayesian/client';
import { isWithinBOLimit } from '@/lib/bayesian/feature-limits';
import { logger } from '@/lib/logger';

const suggestSchema = z.object({
  spaceId: z.string().min(1),
});

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

    const validation = suggestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 },
      );
    }

    const { spaceId } = validation.data;

    // Resolve user org and plan
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, organization: { select: { plan: true } } },
    });
    const userOrgId = user?.organizationId;
    const plan = user?.organization?.plan ?? 'free';

    // Fetch space and verify ownership
    const space = await prisma.bOSpace.findUnique({
      where: { id: spaceId },
      select: { id: true, orgId: true },
    });
    if (!space) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Space not found' },
        { status: 404 },
      );
    }
    if (space.orgId !== userOrgId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Access denied — space belongs to a different organisation' },
        { status: 403 },
      );
    }

    // Feature-limit check: monthly suggestion count
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyCount = await prisma.bOObservation.count({
      where: {
        spaceId,
        recordedAt: { gte: monthStart },
      },
    });
    if (!isWithinBOLimit(plan, 'monthlySuggestions', monthlyCount)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Monthly suggestion limit reached' },
        { status: 403 },
      );
    }

    // Call BO service
    const client = await getBayesianClient();
    if (!client) {
      return NextResponse.json(
        { error: 'Service Unavailable', message: 'Bayesian optimisation service is not available' },
        { status: 503 },
      );
    }

    const suggestion = await client.suggest(spaceId);

    return NextResponse.json({ data: suggestion });
  } catch (error) {
    logger.error('POST /api/bayesian/suggest error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to get suggestion' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
