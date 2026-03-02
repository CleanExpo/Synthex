/**
 * Web Projects API Route
 * CRUD operations for web design projects
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { z } from 'zod';

const projectCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(1000).optional(),
  websiteUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  domain: z.string().max(253).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
});

// GET /api/web-projects — list projects of type "webdesign" for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const projects = await prisma.project.findMany({
      where: { userId, type: 'webdesign' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ projects });
  } catch (error: unknown) {
    console.error('Get web-projects error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/web-projects — create a new web design project
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const body = await request.json();
    const parsed = projectCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, description, websiteUrl, domain, status } = parsed.data;

    const project = await prisma.project.create({
      data: {
        name,
        description,
        type: 'webdesign',
        status,
        websiteUrl: websiteUrl || null,
        domain: domain || null,
        pages: 0,
        colors: [],
        userId,
      },
    });

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create web-project error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
