/**
 * Backlink Analysis History API — List (Phase 95)
 *
 * GET /api/backlinks/analysis — List past backlink analyses for the current user
 *
 * @module app/api/backlinks/analysis/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── GET /api/backlinks/analysis ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId  = searchParams.get('orgId');
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const where: Record<string, unknown> = { userId };
    if (orgId) where.orgId = orgId;

    const [analyses, total] = await Promise.all([
      prisma.backlinkAnalysis.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.backlinkAnalysis.count({ where }),
    ]);

    return NextResponse.json({ analyses, total, limit, offset });
  } catch (err) {
    console.error('[GET /api/backlinks/analysis]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
