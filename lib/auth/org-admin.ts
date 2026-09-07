/**
 * Organisation admin check used by org PATCH/DELETE and sibling write routes.
 *
 * `settings.admins` is an extra allow-list, not the only signal. Real owners
 * and RBAC admin/owner ranks must be able to update Studio config and org
 * settings without a hand-maintained JSON array.
 */

import { prisma } from '@/lib/prisma';
import { resolveIssuerRole, ROLE_RANK } from '@/lib/auth/rbac/issuer-rank';

export async function isOrganizationMember(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: { id: true },
  });
  return Boolean(user);
}

function settingsAdminsInclude(settings: unknown, userId: string): boolean {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return false;
  }
  const admins = (settings as { admins?: unknown }).admins;
  return Array.isArray(admins) && admins.includes(userId);
}

export async function isOrganizationAdmin(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const member = await isOrganizationMember(userId, organizationId);
  if (!member) return false;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  if (settingsAdminsInclude(org?.settings, userId)) return true;

  const rank = await resolveIssuerRole(userId, organizationId);
  return ROLE_RANK[rank] >= ROLE_RANK.admin;
}
