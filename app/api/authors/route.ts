/**
 * Authors API — List and Create Author Profiles
 *
 * GET /api/authors — List user's author profiles
 * POST /api/authors — Create a new author profile
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/authors/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

const createAuthorSchema = z.object({
  name: z.string().min(2).max(100),
  title: z.string().min(2).max(200).optional(),
  bio: z.string().min(50).max(5000),
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
  avatarUrl: z.string().url().optional(),
  expertiseAreas: z.array(z.string()).optional(),
});

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
    }

    const authors = await prisma.authorProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { articles: true, geoAnalyses: true } } },
    });

    return NextResponse.json({ authors, total: authors.length });
  } catch (error) {
    console.error('List authors error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to list authors' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createAuthorSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation Error', details: validation.error.issues }, { status: 400 });
    }

    const data = validation.data;
    let slug = generateSlug(data.name);

    // Check slug uniqueness
    const existing = await prisma.authorProfile.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Build sameAs URLs from social links
    const sameAsUrls: string[] = [];
    if (data.socialLinks) {
      Object.values(data.socialLinks).forEach(url => { if (url) sameAsUrls.push(url); });
    }

    const author = await prisma.authorProfile.create({
      data: {
        userId,
        name: data.name,
        slug,
        bio: data.bio,
        credentials: data.credentials as any || [],
        socialLinks: data.socialLinks as any || {},
        avatarUrl: data.avatarUrl || null,
        sameAsUrls,
        expertiseAreas: data.expertiseAreas || [],
      },
    });

    return NextResponse.json(author, { status: 201 });
  } catch (error) {
    console.error('Create author error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to create author' }, { status: 500 });
  }
}
