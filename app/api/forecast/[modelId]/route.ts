/**
 * Forecast Model Status API
 *
 * GET /api/forecast/[modelId]  — Fetch a single forecast model with its latest forecast
 *
 * @module app/api/forecast/[modelId]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

// ─── GET — Model status ───────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> },
) {
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
      return NextResponse.json(
        { error: 'Not Found', message: 'Forecast model not found' },
        { status: 404 },
      );
    }

    const { modelId } = await params;
    const orgId = user.organizationId;

    const model = await prisma.forecastModel.findFirst({
      where: { id: modelId, orgId },
      include: {
        forecasts: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!model) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Forecast model not found' },
        { status: 404 },
      );
    }

    const { forecasts, ...modelData } = model;

    return NextResponse.json({
      data: {
        ...modelData,
        latestForecast: forecasts[0] ?? null,
      },
    });
  } catch (error) {
    logger.error('GET /api/forecast/[modelId] error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch forecast model' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
