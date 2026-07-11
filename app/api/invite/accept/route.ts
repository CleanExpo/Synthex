/**
 * POST /api/invite/accept
 *
 * Accepts a team invitation and creates a TeamMember record.
 * Sets a `synthex_role` cookie (collaborator, or owner for provisioning
 * invitations — Track B S5') used by middleware for RBAC gating.
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
import {
  ensureDefaultRoles,
  grantSystemRole,
} from '@/lib/auth/rbac/ensure-default-roles';
import { logger } from '@/lib/logger';

const BodySchema = z.object({
  token: z.string().min(1),
});

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
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
      role: true,
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
    return NextResponse.json(
      { error: 'Invitation not found' },
      { status: 404 }
    );
  }

  if (invitation.status === 'accepted') {
    return NextResponse.json(
      { error: 'Invitation already accepted' },
      { status: 409 }
    );
  }

  const orgId = invitation.organizationId;
  if (!orgId) {
    return NextResponse.json(
      { error: 'Invitation has no organisation' },
      { status: 422 }
    );
  }

  const org = (invitation as any).organization as {
    id: string;
    name: string;
    users: Array<{ id: string; name: string | null; email: string }>;
  };

  const ownerUser = org?.users?.[0];
  const ownerName = ownerUser?.name ?? ownerUser?.email ?? 'the owner';

  // ── Multi-tenancy safety ───────────────────────────────────────────────
  // Look up the accepting user's current org. A user may only adopt the
  // invitation's org if they have NO org yet (the normal collaborator case)
  // or are already in THIS org (re-accept). If they already belong to a
  // DIFFERENT org, reject — never silently move a user across tenants.
  const acceptingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, email: true },
  });

  // ── Identity binding ───────────────────────────────────────────────────
  // The invitation is addressed to a specific email. Bind acceptance to that
  // recipient: the authenticated caller's email MUST match the invitation's
  // email (case-insensitive). Without this, any authenticated user who learns
  // a TeamInvitation id (the token) — e.g. a fresh signup with no org — could
  // POST it here and join an arbitrary org as a Viewer. The org is always
  // derived server-side from the invitation, never from client input; this
  // check ensures the *right* person is the one redeeming it.
  const inviteEmail = invitation.email?.trim().toLowerCase();
  const callerEmail = acceptingUser?.email?.trim().toLowerCase();
  if (!callerEmail || !inviteEmail || callerEmail !== inviteEmail) {
    logger.warn('invite/accept: email mismatch blocked', {
      userId,
      invitationId: invitation.id,
      invitedOrg: orgId,
    });
    return NextResponse.json(
      { error: 'This invitation was issued to a different email address' },
      { status: 403 }
    );
  }

  if (acceptingUser?.organizationId && acceptingUser.organizationId !== orgId) {
    logger.warn('invite/accept: cross-org acceptance blocked', {
      userId,
      currentOrg: acceptingUser.organizationId,
      invitedOrg: orgId,
      invitationId: invitation.id,
    });
    return NextResponse.json(
      { error: 'You already belong to a different organisation' },
      { status: 409 }
    );
  }

  // Track B provisioning (S5'): an invitation minted with role 'owner' seats
  // the client-owner as the child org's owner (TeamMember role + Admin system
  // role). Anything else — including unknown/corrupt role values — stays the
  // least-privileged collaborator path (fail-closed, same doctrine as
  // withAuth.resolveRole).
  const isOwnerInvite = invitation.role === 'owner';
  const memberRole = isOwnerInvite ? 'owner' : 'collaborator';
  const systemRole = isOwnerInvite ? 'Admin' : 'Viewer';

  // Atomically: link user → org, seed RBAC roles, grant default role,
  // create the TeamMember row, and mark the invitation accepted. This is
  // what unblocks withAuth() — it 403s any user without User.organizationId.
  await prisma.$transaction(async tx => {
    // 1. Set the FK the auth layer requires. Owner of this org is unaffected:
    //    their organizationId is already set, and we never overwrite a
    //    different org (guarded above) — this only fills an empty FK or
    //    re-sets the same value.
    await tx.user.update({
      where: { id: userId },
      data: { organizationId: orgId },
    });

    // 2. Ensure the org has the system roles the app expects (idempotent —
    //    covers older orgs created before RBAC seeding existed).
    await ensureDefaultRoles(orgId, tx);

    // 3. Give the invitee a sensible default role: collaborators are
    //    read-only per the invite email ('Viewer'); a provisioned client
    //    OWNER gets 'Admin' (falls back to the org default role if the
    //    named role is somehow absent).
    await grantSystemRole(
      userId,
      orgId,
      systemRole,
      invitation.userId ?? 'system',
      tx
    );

    // 4. Create/refresh the TeamMember row (drives withAuth role resolution).
    await tx.teamMember.upsert({
      where: { team_member_user_org: { userId, organizationId: orgId } },
      create: {
        userId,
        organizationId: orgId,
        role: memberRole,
        invitedBy: invitation.userId ?? undefined,
        invitationId: invitation.id,
        acceptedAt: new Date(),
      },
      update: { acceptedAt: new Date(), role: memberRole },
    });

    // 5. Mark invitation as accepted.
    await tx.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted' },
    });
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

  response.cookies.set('synthex_role', memberRole, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}
