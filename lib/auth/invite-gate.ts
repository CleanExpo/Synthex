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
 * invite code locked to this email. Used by the OAuth login gates
 * (signInFlow, platform callback, GitHub callback); org-locked invitations
 * COUNT here — an invited user must be able to sign in and accept.
 * Membership in an existing org should be checked by the caller first.
 *
 * Self-provisioning routes must use hasSelfProvisionEvidence instead
 * (Track B S4', criterion 18 pins this fan-out).
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

  return hasInviteCodeEvidence(email, userId);
}

/**
 * Track B S4' — evidence for SELF-PROVISIONING an organization (the
 * `organizations` POST and `onboarding/review` auto-org doors).
 *
 * An ORG-LOCKED invitation (organizationId non-null — e.g. a client
 * provisioning invite) grants access to join THAT org via invite-accept, but
 * is NOT evidence for creating an unrelated org: only floating invitations
 * (organizationId null) count on the team-invite branch. Invite-code
 * evidence is unchanged. This closes the invite-minting oracle — a
 * CRM-supplied email cannot parlay its provisioning invite into an
 * open-market org (criterion 13).
 */
export async function hasSelfProvisionEvidence(
  email: string,
  userId?: string
): Promise<boolean> {
  const floatingInvite = await prisma.teamInvitation.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      status: { in: ['sent', 'pending', 'accepted'] },
      sentAt: { gte: teamInviteCutoff() },
      organizationId: null,
    },
    select: { id: true },
  });
  if (floatingInvite) return true;

  return hasInviteCodeEvidence(email, userId);
}

async function hasInviteCodeEvidence(
  email: string,
  userId?: string
): Promise<boolean> {
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
