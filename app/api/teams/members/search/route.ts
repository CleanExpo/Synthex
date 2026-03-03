/**
 * Team Member Search Route
 *
 * Returns members of the user's organisation matching the search query.
 * Used by CommentsPanel @mention autocomplete and ShareDialog.
 *
 * @route GET /api/teams/members/search?q=<query>
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (!q || q.length < 1) {
      return NextResponse.json({ members: [] });
    }

    const organizationId = await getEffectiveOrganizationId(userId);

    // If the user belongs to an org, search org members; otherwise return just self
    let members: { id: string; name: string | null; email: string; avatar: string | null }[] = [];

    if (organizationId) {
      members = await prisma.user.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
        take: 10,
        orderBy: { name: 'asc' },
      });
    } else {
      // Solo user — only allow searching self (for @mention of own name)
      const self = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, avatar: true },
      });
      if (
        self &&
        (self.name?.toLowerCase().includes(q.toLowerCase()) ||
          self.email.toLowerCase().includes(q.toLowerCase()))
      ) {
        members = [self];
      }
    }

    return NextResponse.json({
      members: members.map(m => ({
        id: m.id,
        name: m.name || m.email.split('@')[0],
        email: m.email,
        avatar: m.avatar,
      })),
    });
  } catch (error) {
    console.error('[Teams Members Search] Error:', error);
    return NextResponse.json({ error: 'Member search failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
