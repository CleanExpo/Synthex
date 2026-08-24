import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  isInviteOnlyMode,
  hasSelfProvisionEvidence,
} from '@/lib/auth/invite-gate';
import { attachUserToOrganization } from '@/lib/onboarding/persist';

function slugFromName(businessName: string): string {
  const base = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return `${base || 'workspace'}-${Date.now().toString(36)}`;
}

/**
 * Find the caller's organisation, or create one during onboarding.
 * Invite-only mode still blocks uninvited auto-provisioning.
 */
export async function ensureOnboardingOrganization(
  userId: string,
  businessName: string,
  options?: { description?: string | null }
): Promise<{ id: string } | null> {
  const existing = await prisma.organization.findFirst({
    where: { users: { some: { id: userId } } },
    select: { id: true, description: true },
  });
  if (existing) {
    const nextDescription = options?.description?.trim();
    if (nextDescription && !existing.description) {
      await prisma.organization.update({
        where: { id: existing.id },
        data: { description: nextDescription },
      });
    }
    await attachUserToOrganization(userId, existing.id);
    return { id: existing.id };
  }

  if (isInviteOnlyMode()) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user || !(await hasSelfProvisionEvidence(user.email, userId))) {
      logger.warn('[onboarding] Blocked uninvited org auto-provisioning', {
        userId,
      });
      return null;
    }
  }

  const name = businessName.trim() || 'My Business';
  const description = options?.description?.trim() || null;
  const org = await prisma.organization.create({
    data: {
      name,
      slug: slugFromName(name),
      ...(description ? { description } : {}),
      users: { connect: { id: userId } },
    },
    select: { id: true },
  });

  logger.info('[onboarding] Created organisation', {
    orgId: org.id,
    userId,
  });

  await attachUserToOrganization(userId, org.id);

  return org;
}
