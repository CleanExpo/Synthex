import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const profileUpdateSchema = z.object({
  name: z.string().max(255).optional(),
  company: z.string().max(255).optional(),
  role: z.string().max(255).optional(),
  bio: z.string().max(2000).optional(),
  timezone: z.string().max(64).optional(),
});

/**
 * GET /api/auth/profile
 * Returns the authenticated user's profile data.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canUseDb = !!process.env.DATABASE_URL;
  if (!canUseDb) {
    return NextResponse.json({
      success: true,
      data: { name: '', email: '', preferences: {} },
      persisted: false,
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        company: true,
        jobRole: true,
        bio: true,
        timezone: true,
        preferences: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: user || { name: '', email: '', preferences: {} },
      persisted: true,
    });
  } catch (err) {
    logger.error('GET /api/auth/profile error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/profile
 * Body: { name, email, company, role, bio, timezone }
 * If DATABASE_URL is configured, updates the user by email. Otherwise, returns success with echo.
 */
export async function PUT(req: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let rawBody: unknown = {};
  try {
    rawBody = await req.json();
  } catch {
    // ignore
  }

  const validation = profileUpdateSchema.safeParse(rawBody);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: validation.error.flatten() },
      { status: 400 }
    );
  }
  const body = validation.data;

  const canUseDb = !!process.env.DATABASE_URL;
  if (!canUseDb) {
    return NextResponse.json({
      success: true,
      data: { ...body },
      persisted: false,
    });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.company !== undefined && { company: body.company }),
        ...(body.role !== undefined && { jobRole: body.role }),
        ...(body.bio !== undefined && { bio: body.bio }),
        ...(body.timezone !== undefined && { timezone: body.timezone }),
      },
      select: {
        name: true,
        email: true,
        company: true,
        jobRole: true,
        bio: true,
        timezone: true,
        preferences: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      persisted: true,
    });
  } catch (err) {
    logger.error('PUT /api/auth/profile error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
