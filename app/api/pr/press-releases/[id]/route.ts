/**
 * PR Journalist CRM — Press Release Detail, Update, Archive (Phase 92)
 *
 * GET    /api/pr/press-releases/[id] — Get press release
 * PATCH  /api/pr/press-releases/[id] — Update press release (publish sets publishedAt)
 * DELETE /api/pr/press-releases/[id] — Archive (soft delete — sets status = archived)
 *
 * @module app/api/pr/press-releases/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── Validation ────────────────────────────────────────────────────────────────

const UpdatePressReleaseSchema = z.object({
  headline:    z.string().min(1).max(500).optional(),
  body:        z.string().min(1).optional(),
  slug:        z.string().max(100).optional(),
  subheading:  z.string().max(500).optional(),
  boilerplate: z.string().max(5000).optional(),
  contactName:  z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  datePublished: z.string().datetime().optional(),
  location:    z.string().max(200).optional(),
  category:    z.enum(['funding', 'product', 'partnership', 'award', 'other']).optional(),
  keywords:    z.array(z.string()).optional(),
  imageUrl:    z.string().url().optional(),
  status:      z.enum(['draft', 'published', 'archived']).optional(),
  distributedTo: z.array(z.string()).optional(),
});

// ─── Route params type ─────────────────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── GET /api/pr/press-releases/[id] ──────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    const release = await prisma.pressRelease.findFirst({
      where: { id, orgId: userId },
    });

    if (!release) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ release });
  } catch (error) {
    console.error('[PR press-releases/[id] GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/pr/press-releases/[id] ────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.pressRelease.findFirst({
      where: { id, orgId: userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdatePressReleaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Set publishedAt when status changes to published
    const publishedAt =
      data.status === 'published' && existing.status !== 'published'
        ? new Date()
        : undefined;

    const release = await prisma.pressRelease.update({
      where: { id },
      data: {
        ...data,
        datePublished: data.datePublished ? new Date(data.datePublished) : undefined,
        ...(publishedAt ? { publishedAt } : {}),
      },
    });

    return NextResponse.json({ release });
  } catch (error) {
    console.error('[PR press-releases/[id] PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/pr/press-releases/[id] ───────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.pressRelease.findFirst({
      where: { id, orgId: userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Soft delete — archive (never hard delete per CLAUDE.md)
    await prisma.pressRelease.update({
      where: { id },
      data: { status: 'archived' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PR press-releases/[id] DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
