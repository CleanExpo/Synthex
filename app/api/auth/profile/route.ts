import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type ProfileBody = {
  name?: string;
  email?: string;
  company?: string;
  role?: string;
  bio?: string;
  timezone?: string;
};

/**
 * GET /api/auth/profile?email={email}
 * Returns basic profile data. If DATABASE_URL is not configured or email not provided, returns an empty profile.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email') || '';

  const canUseDb = !!process.env.DATABASE_URL;
  if (!canUseDb || !email) {
    return NextResponse.json({
      success: true,
      data: { name: '', email, preferences: {} },
      persisted: false,
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { name: true, email: true, preferences: true },
    });

    return NextResponse.json({
      success: true,
      data: user || { name: '', email, preferences: {} },
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
  let body: ProfileBody = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const email = (body.email || '').toString().trim();
  if (!email) {
    return NextResponse.json(
      { success: false, error: 'Email is required' },
      { status: 400 }
    );
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
      where: { email },
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
