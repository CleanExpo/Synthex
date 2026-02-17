import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';

type ProfileBody = {
  name?: string;
  email?: string;
  company?: string;
  role?: string;
  bio?: string;
  timezone?: string;
};

/**
 * GET /api/auth/profile
 * Returns the authenticated user's profile data.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromCookies();
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
      select: { name: true, email: true, preferences: true },
    });

    return NextResponse.json({
      success: true,
      data: user || { name: '', email: '', preferences: {} },
      persisted: true,
    });
  } catch (err) {
    console.error('GET /api/auth/profile error:', err);
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
  const userId = await getUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ProfileBody = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }

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
        name: body.name,
        // store additional profile fields in preferences json
        preferences: {
          ...(body.timezone ? { timezone: body.timezone } : {}),
          ...(body.company ? { company: body.company } : {}),
          ...(body.role ? { role: body.role } : {}),
          ...(body.bio ? { bio: body.bio } : {}),
        } as any,
      },
      select: { name: true, email: true, preferences: true },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      persisted: true,
    });
  } catch (err) {
    console.error('PUT /api/auth/profile error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
