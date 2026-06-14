/**
 * ensureDefaultRoles — idempotent per-organization RBAC seeding.
 *
 * Seeds the three system roles every Synthex organisation expects:
 *   - Admin   (permissions: ['*'])               — full access
 *   - Editor  (default, isDefault=true)          — create/edit content + analytics
 *   - Viewer  (read-only)                         — content + analytics read
 *
 * Safe to call repeatedly: createMany({ skipDuplicates: true }) keys off the
 * Role @@unique([organizationId, name]) constraint, so already-seeded orgs are
 * untouched. This is the single source of truth used by BOTH:
 *   - org creation (app/api/organizations/route.ts)
 *   - invite accept (app/api/invite/accept/route.ts), so a collaborator landing
 *     in an older org that predates RBAC seeding still gets a sensible role.
 *
 * @task collaborator-access-rbac
 */

import { prisma } from '@/lib/prisma';

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** The canonical system roles seeded per organisation. */
export const DEFAULT_SYSTEM_ROLES = [
  {
    name: 'Admin',
    description: 'Full access to all organization features',
    permissions: ['*'],
    isDefault: false,
    isSystem: true,
  },
  {
    name: 'Editor',
    description: 'Can create and edit content, campaigns, and analytics',
    permissions: [
      'posts:create',
      'posts:read',
      'posts:update',
      'posts:delete',
      'campaigns:create',
      'campaigns:read',
      'campaigns:update',
      'analytics:read',
      'personas:read',
      'personas:update',
    ],
    isDefault: true,
    isSystem: true,
  },
  {
    name: 'Viewer',
    description: 'Read-only access to content and analytics',
    permissions: ['posts:read', 'campaigns:read', 'analytics:read', 'personas:read'],
    isDefault: false,
    isSystem: true,
  },
] as const;

/**
 * Ensure the default system roles exist for an organisation. Idempotent.
 *
 * @param organizationId  Organisation to seed.
 * @param tx              Optional Prisma transaction client.
 */
export async function ensureDefaultRoles(
  organizationId: string,
  tx?: TxClient
): Promise<void> {
  const db = tx ?? prisma;
  await db.role.createMany({
    data: DEFAULT_SYSTEM_ROLES.map((role) => ({
      ...role,
      permissions: [...role.permissions],
      organizationId,
    })),
    skipDuplicates: true,
  });
}

/**
 * Grant a named system role to a user in an organisation. Idempotent — uses
 * the UserRole @@unique([userId, roleId]) constraint via skipDuplicates so a
 * re-accept never creates duplicate assignments. No-op if the role is missing.
 *
 * @param userId          User to grant the role to.
 * @param organizationId  Organisation scope.
 * @param roleName        System role name (e.g. 'Viewer'). Falls back to the
 *                        org default role when the named role is absent.
 * @param grantedBy       Actor recorded on the grant.
 * @param tx              Optional Prisma transaction client.
 */
export async function grantSystemRole(
  userId: string,
  organizationId: string,
  roleName: string,
  grantedBy: string,
  tx?: TxClient
): Promise<void> {
  const db = tx ?? prisma;

  let role = await db.role.findUnique({
    where: { organizationId_name: { organizationId, name: roleName } },
    select: { id: true },
  });

  // Fall back to the org's default role if the named role isn't present.
  if (!role) {
    role = await db.role.findFirst({
      where: { organizationId, isDefault: true },
      select: { id: true },
    });
  }

  if (!role) return;

  await db.userRole.createMany({
    data: [{ userId, roleId: role.id, grantedBy }],
    skipDuplicates: true,
  });
}
