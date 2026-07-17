/**
 * Issuer-rank RBAC guard — the single source of truth for "may this actor
 * grant/seat this role?" across every org-scoped issuance and acceptance writer.
 *
 * Closes the SYN-1108 escalation class: without a consistent "the issuer must
 * outrank the role being granted" rule, a non-owner ADMIN could seat an OWNER
 * (on invite, on role-change, or by an acceptance that trusts a stored owner
 * role without revalidating the inviter's authority).
 *
 * Design:
 *   - ROLE_RANK ranks the four canonical roles (owner > admin > editor > viewer).
 *   - rankOfRole() maps a role name OR a Role-like {name, permissions} to a rank,
 *     reusing the same admin-permission set the route-local checkUserIsAdmin
 *     helpers already trust (admin / manage_members / manage_roles / '*').
 *   - requireIssuerOutranks() is the guard: the issuer must strictly outrank the
 *     granted role, and — the load-bearing invariant — only an owner may grant
 *     owner.
 *   - resolveIssuerRole() derives an actor's effective rank in an org from the
 *     durable authority signals (BusinessOwnership + TeamMember owner ⇒ owner;
 *     otherwise the highest RBAC role they hold). Fail-closed to 'viewer'.
 *
 * @task SYN-1108
 */

import { prisma } from '@/lib/prisma';

export type RankedRole = 'owner' | 'admin' | 'editor' | 'viewer';

/** Canonical role ranks. Higher outranks lower. */
export const ROLE_RANK: Record<RankedRole, number> = {
  owner: 3,
  admin: 2,
  editor: 1,
  viewer: 0,
};

/** Permissions that confer admin-level (rank 2) authority — mirrors checkUserIsAdmin. */
const ADMIN_PERMISSIONS = ['*', 'admin', 'manage_members', 'manage_roles'];

/** A role name string, or a Role-like object carrying a name and/or permissions. */
export type RoleLike =
  | string
  | { name?: string | null; permissions?: string[] | null }
  | null
  | undefined;

/**
 * Map a role (name string or Role-like object) to a numeric rank. Unknown /
 * corrupt roles map to the least-privileged rank (viewer=0), fail-closed.
 */
export function rankOfRole(role: RoleLike): number {
  if (!role) return ROLE_RANK.viewer;
  const name = (typeof role === 'string' ? role : role.name ?? '')
    .trim()
    .toLowerCase();
  const permissions = typeof role === 'string' ? [] : role.permissions ?? [];

  if (name === 'owner') return ROLE_RANK.owner;
  if (name === 'admin' || permissions.some(p => ADMIN_PERMISSIONS.includes(p))) {
    return ROLE_RANK.admin;
  }
  if (name === 'editor') return ROLE_RANK.editor;
  return ROLE_RANK.viewer;
}

/** Reverse of ROLE_RANK: numeric rank → canonical role name. */
function rankToRole(rank: number): RankedRole {
  if (rank >= ROLE_RANK.owner) return 'owner';
  if (rank >= ROLE_RANK.admin) return 'admin';
  if (rank >= ROLE_RANK.editor) return 'editor';
  return 'viewer';
}

/**
 * The core guard. Returns true iff `issuer` is authorised to grant/seat `granted`.
 *
 *   - Only an owner may grant an owner-rank role.
 *   - For every other role, the issuer must be AT LEAST the granted rank: you may
 *     never grant a role ABOVE your own. Equal-rank grants are allowed on purpose
 *     — an admin managing (or seating) another admin is legitimate; the class
 *     this closes is granting a role above yourself, and above all seating owner.
 *
 * The escalation the SYN-1108 class describes — a non-owner admin seating an
 * owner — is refused by both arms: admin (rank 2) is not owner, and 2 < 3.
 */
export function requireIssuerOutranks(issuer: RoleLike, granted: RoleLike): boolean {
  const grantedRank = rankOfRole(granted);
  const issuerRank = rankOfRole(issuer);

  // Load-bearing invariant: owner is only ever granted by an owner.
  if (grantedRank >= ROLE_RANK.owner) {
    return issuerRank >= ROLE_RANK.owner;
  }
  return issuerRank >= grantedRank;
}

/**
 * Minimal prisma surface resolveIssuerRole needs. Kept structural so callers may
 * pass a transaction client, and so unit tests may supply partial mocks — any
 * absent model is treated as "no signal" via optional chaining, never a throw.
 */
type IssuerRankDb = {
  businessOwnership?: {
    findFirst?: (args: unknown) => Promise<{ id: string } | null>;
  };
  teamMember?: {
    findUnique?: (args: unknown) => Promise<{ role: string | null } | null>;
  };
  userRole?: {
    findMany?: (
      args: unknown
    ) => Promise<Array<{ role?: { name?: string | null; permissions?: string[] | null } | null }>>;
  };
};

/**
 * Resolve an actor's effective rank within an organisation.
 *
 * Owner (rank 3) is asserted by a durable ownership signal — a BusinessOwnership
 * row, or a TeamMember whose role is 'owner'. Otherwise the rank is the highest
 * RBAC role the actor holds in that org. Fail-closed to 'viewer' on any error,
 * so a transient failure denies rather than grants authority.
 */
export async function resolveIssuerRole(
  userId: string,
  organizationId: string,
  db: IssuerRankDb = prisma as unknown as IssuerRankDb
): Promise<RankedRole> {
  try {
    // Only an ACTIVE ownership confers owner rank. A deactivated ownership
    // (isActive:false — see businesses/[id] DELETE and owner-utils.deleteBusiness)
    // is a cancelled business, not a live authority signal (SYN-1108).
    const ownership = await db.businessOwnership?.findFirst?.({
      where: { ownerId: userId, organizationId, isActive: true },
      select: { id: true },
    });
    if (ownership) return 'owner';

    const membership = await db.teamMember?.findUnique?.({
      where: { team_member_user_org: { userId, organizationId } },
      select: { role: true },
    });
    if (membership?.role && membership.role.trim().toLowerCase() === 'owner') {
      return 'owner';
    }

    const userRoles =
      (await db.userRole?.findMany?.({
        where: { userId, role: { organizationId } },
        include: { role: { select: { name: true, permissions: true } } },
      })) ?? [];

    let best = ROLE_RANK.viewer;
    for (const ur of userRoles) {
      if (ur?.role) best = Math.max(best, rankOfRole(ur.role));
    }
    return rankToRole(best);
  } catch {
    return 'viewer';
  }
}
