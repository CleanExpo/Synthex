/**
 * PR Journalist CRM — Press Releases List & Create (Phase 92)
 *
 * GET  /api/pr/press-releases — List press releases
 * POST /api/pr/press-releases — Create a press release
 *
 * @module app/api/pr/press-releases/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { generateSlug } from '@/lib/pr/press-release-builder';

// ─── Validation ────────────────────────────────────────────────────────────────

const CreatePressReleaseSchema = z.object({
  headline:    z.string().min(1).max(500),
  body:        z.string().min(1),
  slug:        z.string().max(100).optional(),
  subheading:  z.string().max(500).optional(),
  boilerplate: z.string().max(5000).optional(),
  contactName:  z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  datePublished: z.string().datetime().optional(),
  location:    z.string().max(200).optional(),
  category:    z.enum(['funding', 'product', 'partnership', 'award', 'other']).optional(),
  keywords:    z.array(z.string()).optional().default([]),
  imageUrl:    z.string().url().optional(),
  status:      z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  distributedTo: z.array(z.string()).optional().default([]),
});

// ─── GET /api/pr/press-releases ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const releases = await prisma.pressRelease.findMany({
      where: { orgId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id:           true,
        slug:         true,
        headline:     true,
        subheading:   true,
        status:       true,
        category:     true,
        keywords:     true,
        datePublished: true,
        publishedAt:  true,
        createdAt:    true,
        updatedAt:    true,
      },
    });

    return NextResponse.json({ releases });
  } catch (error) {
    console.error('[PR press-releases GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/pr/press-releases ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreatePressReleaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Auto-generate slug if not provided
    let slug = data.slug ?? generateSlug(data.headline);

    // Ensure slug uniqueness — append counter if needed
    const existing = await prisma.pressRelease.findFirst({
      where: { orgId: userId, slug },
    });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const release = await prisma.pressRelease.create({
      data: {
        userId,
        orgId:         userId,
        headline:      data.headline,
        body:          data.body,
        slug,
        subheading:    data.subheading,
        boilerplate:   data.boilerplate,
        contactName:   data.contactName,
        contactEmail:  data.contactEmail,
        contactPhone:  data.contactPhone,
        datePublished: data.datePublished ? new Date(data.datePublished) : undefined,
        location:      data.location,
        category:      data.category,
        keywords:      data.keywords,
        imageUrl:      data.imageUrl,
        status:        data.status,
        distributedTo: data.distributedTo,
        publishedAt:   data.status === 'published' ? new Date() : undefined,
      },
    });

    return NextResponse.json({ release }, { status: 201 });
  } catch (error) {
    console.error('[PR press-releases POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
