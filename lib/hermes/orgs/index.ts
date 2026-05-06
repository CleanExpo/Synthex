/**
 * HERMES — org resolution helpers (SYN-911 / HER-1c)
 *
 * The HERMES cron writes posts via the existing /api/scheduler/posts contract,
 * which requires a real userId via `getEffectiveOrganizationId(userId)`. HERMES
 * has no user of its own — instead it impersonates the org's Owner-role user.
 *
 * This matches the autopilot pattern (app/api/cron/autopilot/route.ts:96), but
 * fixes its silent-skip flaw: autopilot uses `org.users[0]?.id`, which is
 * insertion-order dependent and produces wrong attribution if that user is
 * offboarded. HERMES resolves through the RBAC Role join so the impersonated
 * actor is always the explicit Owner.
 *
 * Schema reference (prisma/schema.prisma):
 *   - Role        @@map("roles")        — name + organizationId, scoped per-org
 *   - UserRole    @@map("user_roles")   — userId ↔ roleId join
 *
 * Returns null when no Owner-role user exists (e.g. the user was offboarded
 * without a successor). The caller must escalate via Linear and skip the org
 * — never throw, never fall back silently to a random user.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Find the Owner-role user for an organization.
 *
 * @param orgId Organization.id (cuid).
 * @returns userId of the first Owner-role user, or null if none exists.
 */
export async function resolveImpersonatedAuthor(
  orgId: string
): Promise<string | null> {
  // Roles are per-org. Find the Owner role for THIS org, then any UserRole
  // grant attached to it. If multiple users hold the Owner role we return
  // the first deterministically (sorted by grantedAt asc) — same user every
  // run, no churn from non-deterministic ordering.
  const ownerRole = await prisma.role.findFirst({
    where: {
      organizationId: orgId,
      name: 'Owner',
    },
    select: {
      id: true,
      userRoles: {
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { grantedAt: 'asc' },
        take: 1,
        select: { userId: true },
      },
    },
  });

  if (!ownerRole) {
    logger.warn('[hermes:orgs] No Owner role configured for org', { orgId });
    return null;
  }

  const userId = ownerRole.userRoles[0]?.userId ?? null;
  if (!userId) {
    logger.warn('[hermes:orgs] Owner role exists but has no active grants', {
      orgId,
      roleId: ownerRole.id,
    });
    return null;
  }

  return userId;
}
