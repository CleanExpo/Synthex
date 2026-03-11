/**
 * Prompt Trackers API (Phase 96)
 *
 * GET  /api/prompts/trackers — List prompt trackers for the current user
 * POST /api/prompts/trackers — Create a new prompt tracker
 *
 * @module app/api/prompts/trackers/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'brand-awareness',
  'competitor-comparison',
  'local-discovery',
  'use-case',
  'how-to',
  'product-feature',
] as const;

const VALID_ENTITY_TYPES = ['brand', 'product', 'service', 'person', 'location'] as const;

const CreateTrackerSchema = z.object({
  orgId:          z.string().min(1),
  entityName:     z.string().min(1).max(200),
  entityType:     z.enum(VALID_ENTITY_TYPES),
  promptText:     z.string().min(5).max(2000),
  promptCategory: z.enum(VALID_CATEGORIES),
  targetModel:    z.string().optional(),
});

// ─── GET /api/prompts/trackers ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId    = searchParams.get('orgId');
    const status   = searchParams.get('status');
    const category = searchParams.get('category');
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
    const offset   = parseInt(searchParams.get('offset') ?? '0', 10);

    const where: Record<string, unknown> = { userId };
    if (orgId)    where.orgId           = orgId;
    if (status)   where.status          = status;
    if (category) where.promptCategory  = category;

    const [trackers, total] = await Promise.all([
      prisma.promptTracker.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          results: {
            orderBy: { testedAt: 'desc' },
            take: 1,  // Most recent result only
          },
        },
      }),
      prisma.promptTracker.count({ where }),
    ]);

    return NextResponse.json({ trackers, total, limit, offset });
  } catch (err) {
    console.error('[GET /api/prompts/trackers]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/prompts/trackers ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body   = await request.json();
    const parsed = CreateTrackerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { orgId, entityName, entityType, promptText, promptCategory, targetModel } = parsed.data;

    // Check for duplicate (same userId + promptText)
    const existing = await prisma.promptTracker.findFirst({
      where: { userId, promptText },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'This prompt is already being tracked', trackerId: existing.id },
        { status: 409 }
      );
    }

    const tracker = await prisma.promptTracker.create({
      data: {
        userId,
        orgId,
        entityName,
        entityType,
        promptText,
        promptCategory,
        targetModel: targetModel ?? 'claude-3-5-haiku-20241022',
        status: 'pending',
      },
    });

    return NextResponse.json({ tracker }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/prompts/trackers]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
