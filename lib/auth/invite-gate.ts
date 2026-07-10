/**
 * Invite gate — server-side evidence checks for the invite-only market mode
 * (Track A, consumption boundary).
 *
 * team_invitations has no expiresAt column, so the TeamInvitation bypass is
 * bounded on sentAt instead: an invitation older than TEAM_INVITE_VALID_DAYS
 * no longer opens the door (re-send the invitation to refresh it).
 */
import { prisma } from '@/lib/prisma';

export { isInviteOnlyMode } from '@/lib/auth/invite-mode';

export const TEAM_INVITE_VALID_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function teamInviteCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - TEAM_INVITE_VALID_DAYS * DAY_MS);
}

/**
 * A recent pending/sent TeamInvitation addressed to this email. Satisfies
 * the invite-only gate at signup without an InviteCode (team invitees get a
 * TeamInvitation, not an InviteCode).
 */
export async function findPendingTeamInvite(
  email: string
): Promise<{ id: string } | null> {
  return prisma.teamInvitation.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      status: { in: ['sent', 'pending'] },
      sentAt: { gte: teamInviteCutoff() },
    },
    select: { id: true },
  });
}

/**
 * Whether this identity was invited: a recent team invitation (including
 * already-accepted ones), an invite code redeemed by this user, or an active
 * invite code locked to this email. Used by org-provisioning routes and
 * OAuth first-login user creation; membership in an existing org should be
 * checked by the caller first.
 */
export async function hasInviteEvidence(
  email: string,
  userId?: string
): Promise<boolean> {
  const teamInvite = await prisma.teamInvitation.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      status: { in: ['sent', 'pending', 'accepted'] },
      sentAt: { gte: teamInviteCutoff() },
    },
    select: { id: true },
  });
  if (teamInvite) return true;

  const code = await prisma.inviteCode.findFirst({
    where: {
      OR: [
        ...(userId ? [{ usedBy: userId }] : []),
        { email: { equals: email, mode: 'insensitive' }, isActive: true },
      ],
    },
    select: { id: true },
  });
  return Boolean(code);
}
