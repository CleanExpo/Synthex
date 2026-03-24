/**
 * app/api/dashboard/bio/route.ts
 *
 * Dashboard: User bio and profile management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

const BioPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  bio: z.string().max(2000).optional(),
  jobRole: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  website: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  twitter: z.string().max(200).optional(),
  linkedin: z.string().max(200).optional(),
  instagram: z.string().max(200).optional(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prisma } = await import('@/lib/prisma');

    let user: {
      id: string;
      name?: string | null;
      email?: string | null;
      avatar?: string | null;
      bio?: string | null;
      jobRole?: string | null;
      company?: string | null;
      website?: string | null;
      location?: string | null;
      twitter?: string | null;
      linkedin?: string | null;
      instagram?: string | null;
      createdAt?: Date | string | null;
    } | null = null;

    try {
      user = await (
        prisma as unknown as {
          user: { findUnique: (args: unknown) => Promise<typeof user> };
        }
      ).user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          bio: true,
          jobRole: true,
          company: true,
          website: true,
          location: true,
          twitter: true,
          linkedin: true,
          instagram: true,
          createdAt: true,
        },
      });
    } catch {
      // Fallback if select fields don't match schema
      try {
        user = await (
          prisma as unknown as {
            user: { findUnique: (args: unknown) => Promise<typeof user> };
          }
        ).user.findUnique({ where: { id: userId } });
      } catch {
        // Model access failure
      }
    }

    const data = {
      id: user?.id ?? userId,
      name: user?.name ?? '',
      email: user?.email ?? '',
      avatar: user?.avatar ?? undefined,
      bio: user?.bio ?? '',
      jobRole: user?.jobRole ?? '',
      company: user?.company ?? '',
      website: user?.website ?? '',
      location: user?.location ?? '',
      socials: {
        twitter: user?.twitter ?? '',
        linkedin: user?.linkedin ?? '',
        instagram: user?.instagram ?? '',
      },
      memberSince: user?.createdAt
        ? new Date(user.createdAt).toISOString()
        : new Date().toISOString(),
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard/bio]', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const parsed = BioPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) updates[key] = value;
    }

    const { prisma } = await import('@/lib/prisma');

    const updated = await (
      prisma as unknown as {
        user: { update: (args: unknown) => Promise<Record<string, unknown>> };
      }
    ).user.update({ where: { id: userId }, data: updates });

    return NextResponse.json(updated, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard/bio PATCH]', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
