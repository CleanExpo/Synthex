/**
 * POST /api/invite/accept
 *
 * Accepts a team invitation and creates a TeamMember record.
 * Sets a `synthex_role=collaborator` cookie used by middleware for RBAC gating.
 *
 * Body: { token: string }  — token is the TeamInvitation.id
 *
 * Returns: { organizationId, organizationName, ownerName }
 *
 * @task SYN-598
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const BodySchema = z.object({
  token: z.string().min(1),
});

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const { token } = parsed.data;

  // Resolve invitation by ID (token = invitation ID)
  const invitation = await prisma.teamInvitation.findUnique({
    where: { id: token },
    select: {
      id: true,
      email: true,
      status: true,
      organizationId: true,
      userId: true,
      organization: {
        select: {
          id: true,
          name: true,
          users: {
            take: 1,
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  if (invitation.status === 'accepted') {
    return NextResponse.json({ error: 'Invitation already accepted' }, { status: 409 });
  }

  const orgId = invitation.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: 'Invitation has no organisation' }, { status: 422 });
  }

  const org = (invitation as any).organization as {
    id: string;
    name: string;
    users: Array<{ id: string; name: string | null; email: string }>;
  };

  const ownerUser = org?.users?.[0];
  const ownerName = ownerUser?.name ?? ownerUser?.email ?? 'the owner';

  // Create TeamMember (upsert in case re-accepting)
  await prisma.teamMember.upsert({
    where: { team_member_user_org: { userId, organizationId: orgId } },
    create: {
      userId,
      organizationId: orgId,
      role: 'collaborator',
      invitedBy: invitation.userId ?? undefined,
      invitationId: invitation.id,
      acceptedAt: new Date(),
    },
    update: { acceptedAt: new Date(), role: 'collaborator' },
  });

  // Mark invitation as accepted
  await prisma.teamInvitation.update({
    where: { id: invitation.id },
    data: { status: 'accepted' },
  });

  logger.info('invite/accept: collaborator accepted', {
    userId,
    orgId,
    invitationId: invitation.id,
  });

  // Build response and set role cookie for middleware RBAC
  const response = NextResponse.json({
    accepted: true,
    organizationId: orgId,
    organizationName: org?.name ?? '',
    ownerName,
    redirectTo: '/welcome',
  });

  response.cookies.set('synthex_role', 'collaborator', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}
