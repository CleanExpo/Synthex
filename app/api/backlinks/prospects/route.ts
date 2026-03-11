/**
 * Backlink Prospects API — List & Create (Phase 95)
 *
 * GET  /api/backlinks/prospects — List backlink prospects for the current user
 * POST /api/backlinks/prospects — Save a new backlink prospect
 *
 * @module app/api/backlinks/prospects/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── Validation ─────────────────────────────────────────────────────────────

const CreateProspectSchema = z.object({
  orgId:           z.string().min(1),
  targetUrl:       z.string().url(),
  targetDomain:    z.string().min(1).max(253),
  domainAuthority: z.number().int().min(0).max(100).optional(),
  pageRank:        z.number().min(0).max(10).optional(),
  opportunityType: z.enum(['resource-page', 'guest-post', 'broken-link', 'competitor-link', 'journalist-mention']),
  outreachEmail:   z.string().email().optional(),
  notes:           z.string().max(5000).optional(),
});

// ─── GET /api/backlinks/prospects ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId           = searchParams.get('orgId');
    const status          = searchParams.get('status');
    const opportunityType = searchParams.get('opportunityType');
    const limit           = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const offset          = parseInt(searchParams.get('offset') ?? '0', 10);

    const where: Record<string, unknown> = { userId };
    if (orgId)           where.orgId           = orgId;
    if (status)          where.status          = status;
    if (opportunityType) where.opportunityType  = opportunityType;

    const [prospects, total] = await Promise.all([
      prisma.backlinkProspect.findMany({
        where,
        orderBy: [{ domainAuthority: 'desc' }, { discoveredAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.backlinkProspect.count({ where }),
    ]);

    return NextResponse.json({ prospects, total, limit, offset });
  } catch (err) {
    console.error('[GET /api/backlinks/prospects]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/backlinks/prospects ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreateProspectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const prospect = await prisma.backlinkProspect.create({
      data: {
        userId,
        orgId:           data.orgId,
        targetUrl:       data.targetUrl,
        targetDomain:    data.targetDomain,
        domainAuthority: data.domainAuthority ?? null,
        pageRank:        data.pageRank ?? null,
        opportunityType: data.opportunityType,
        outreachEmail:   data.outreachEmail ?? null,
        notes:           data.notes ?? null,
      },
    });

    return NextResponse.json({ prospect }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/backlinks/prospects]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
