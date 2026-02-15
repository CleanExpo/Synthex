/**
 * Author Profile API — Get, Update, Delete single author
 *
 * GET /api/authors/:id
 * PATCH /api/authors/:id
 * DELETE /api/authors/:id
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/authors/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

const updateAuthorSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().min(50).max(5000).optional(),
  credentials: z.array(z.object({
    type: z.string(),
    title: z.string(),
    institution: z.string().optional(),
    year: z.number().optional(),
  })).optional(),
  socialLinks: z.object({
    linkedin: z.string().url().optional(),
    twitter: z.string().url().optional(),
    youtube: z.string().url().optional(),
    scholar: z.string().url().optional(),
    wikipedia: z.string().url().optional(),
  }).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  expertiseAreas: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const authorId = parseInt(id, 10);
    if (isNaN(authorId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const author = await prisma.authorProfile.findFirst({
      where: { id: authorId, userId },
      include: { articles: true, geoAnalyses: { take: 5, orderBy: { createdAt: 'desc' } } },
    });

    if (!author) {
      return NextResponse.json({ error: 'Not Found', message: 'Author profile not found' }, { status: 404 });
    }

    return NextResponse.json(author);
  } catch (error) {
    console.error('Get author error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const authorId = parseInt(id, 10);
    if (isNaN(authorId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.authorProfile.findFirst({ where: { id: authorId, userId } });
    if (!existing) {
      return NextResponse.json({ error: 'Not Found', message: 'Author profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = updateAuthorSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation Error', details: validation.error.issues }, { status: 400 });
    }

    const data = validation.data;

    // Rebuild sameAs URLs if social links updated
    let sameAsUrls: string[] | undefined;
    if (data.socialLinks) {
      sameAsUrls = Object.values(data.socialLinks).filter((url): url is string => !!url);
    }

    const updated = await prisma.authorProfile.update({
      where: { id: authorId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.bio && { bio: data.bio }),
        ...(data.credentials && { credentials: data.credentials as any }),
        ...(data.socialLinks && { socialLinks: data.socialLinks as any }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.expertiseAreas && { expertiseAreas: data.expertiseAreas }),
        ...(sameAsUrls && { sameAsUrls }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update author error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const authorId = parseInt(id, 10);
    if (isNaN(authorId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const existing = await prisma.authorProfile.findFirst({ where: { id: authorId, userId } });
    if (!existing) {
      return NextResponse.json({ error: 'Not Found', message: 'Author profile not found' }, { status: 404 });
    }

    await prisma.authorProfile.delete({ where: { id: authorId } });

    return NextResponse.json({ success: true, message: 'Author profile deleted' });
  } catch (error) {
    console.error('Delete author error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
