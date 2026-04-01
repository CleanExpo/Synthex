/**
 * GET /api/teams/team-card
 *
 * Returns accepted team members (non-owners) for the owner's dashboard TeamCard.
 * Uses the TeamMember table from SYN-598, NOT the legacy teams/members route.
 * Returns empty array when no team members exist — the card self-hides (AC #7).
 *
 * @task SYN-599
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return NextResponse.json({ members: [] });
  }

  const members = await prisma.teamMember.findMany({
    where: {
      organizationId: user.organizationId,
      role: { not: 'owner' },
      acceptedAt: { not: null },
    },
    orderBy: { lastActiveAt: 'desc' },
    take: 10, // Cap at 10 for the card — full list lives in /dashboard/team
    select: {
      id: true,
      role: true,
      lastActiveAt: true,
      user: {
        select: { name: true, email: true },
      },
    },
  });

  return NextResponse.json({
    members: members.map(m => ({
      id: m.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      lastActiveAt: m.lastActiveAt?.toISOString() ?? null,
    })),
  });
}
