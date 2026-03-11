/**
 * Directories API — List & Create (Phase 94)
 *
 * GET  /api/directories — List directory listings for the current user
 * POST /api/directories — Create a new directory listing
 *
 * @module app/api/directories/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── Validation ─────────────────────────────────────────────────────────────

const CreateDirectorySchema = z.object({
  orgId:          z.string().min(1),
  directoryName:  z.string().min(1).max(200),
  directoryUrl:   z.string().url(),
  listingUrl:     z.string().url().optional(),
  category:       z.string().max(200).optional(),
  status:         z.enum(['identified', 'submitted', 'live', 'needs-update', 'rejected']).optional().default('identified'),
  domainAuthority: z.number().int().min(0).max(100).optional(),
  isFree:         z.boolean().optional().default(true),
  submittedAt:    z.string().datetime().optional(),
  lastReviewedAt: z.string().datetime().optional(),
  notes:          z.string().max(5000).optional(),
  isAiIndexed:    z.boolean().optional().default(false),
});

// ─── GET /api/directories ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status      = searchParams.get('status');
    const orgId       = searchParams.get('orgId');
    const isAiIndexed = searchParams.get('isAiIndexed');
    const limit       = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
    const offset      = parseInt(searchParams.get('offset') ?? '0', 10);

    const where: Record<string, unknown> = { userId };
    if (status)      where.status      = status;
    if (orgId)       where.orgId       = orgId;
    if (isAiIndexed) where.isAiIndexed = isAiIndexed === 'true';

    const [directories, total] = await Promise.all([
      prisma.directoryListing.findMany({
        where,
        orderBy: [{ domainAuthority: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.directoryListing.count({ where }),
    ]);

    return NextResponse.json({ directories, total, limit, offset });
  } catch (err) {
    console.error('[GET /api/directories]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/directories ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreateDirectorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const directory = await prisma.directoryListing.create({
      data: {
        userId,
        orgId:           data.orgId,
        directoryName:   data.directoryName,
        directoryUrl:    data.directoryUrl,
        listingUrl:      data.listingUrl    ?? null,
        category:        data.category      ?? null,
        status:          data.status,
        domainAuthority: data.domainAuthority ?? null,
        isFree:          data.isFree,
        submittedAt:     data.submittedAt    ? new Date(data.submittedAt)    : null,
        lastReviewedAt:  data.lastReviewedAt ? new Date(data.lastReviewedAt) : null,
        notes:           data.notes          ?? null,
        isAiIndexed:     data.isAiIndexed,
      },
    });

    return NextResponse.json({ directory }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/directories]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
