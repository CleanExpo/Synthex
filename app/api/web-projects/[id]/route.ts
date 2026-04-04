/**
 * Web Projects [id] API Route
 * Single project CRUD operations
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const projectUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  websiteUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  domain: z.string().max(253).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  pages: z.number().int().min(0).optional(),
  colors: z.array(z.string()).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/web-projects/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const { id } = await context.params;

    const project = await prisma.project.findFirst({
      where: { id, userId, type: 'webdesign' },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error: unknown) {
    logger.error('Get web-project error:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

// PATCH /api/web-projects/[id]
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const { id } = await context.params;
    const body = await request.json();
    const parsed = projectUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.project.findFirst({
      where: { id, userId, type: 'webdesign' },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { name, description, websiteUrl, domain, status, pages, colors } = parsed.data;

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(websiteUrl !== undefined && { websiteUrl: websiteUrl || null }),
        ...(domain !== undefined && { domain: domain || null }),
        ...(status !== undefined && { status }),
        ...(pages !== undefined && { pages }),
        ...(colors !== undefined && { colors }),
      },
    });

    return NextResponse.json({ success: true, project });
  } catch (error: unknown) {
    logger.error('Update web-project error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/web-projects/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const { id } = await context.params;

    const existing = await prisma.project.findFirst({
      where: { id, userId, type: 'webdesign' },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await prisma.project.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Project deleted' });
  } catch (error: unknown) {
    logger.error('Delete web-project error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
