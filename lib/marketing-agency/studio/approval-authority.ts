/**
 * Who may approve a Client Content Studio draft (SYN-1412).
 *
 * The one place the rule lives. The Studio route's GET (`canApprove`,
 * `approveRefusal`) and its POST gate both call this function, so the board
 * never shows a button the approve request would refuse.
 *
 * The rule: the approver is a direct member of the organisation (not merely of
 * its parent workspace) and their highest recorded role there is editor or
 * above. Four reads start together and the decision is made on what came back:
 *
 *   1. the membership read failed            -> unavailable
 *   2. not a direct member                   -> not_member, whatever else happened
 *   3. rank = the highest of: owner for an active BusinessOwnership; owner when
 *      the TeamMember read succeeded and found no row; the TeamMember row's
 *      role, accepted or not; each unexpired UserRole grant in this organisation
 *   4. that rank is editor or above          -> allowed, even if another read failed
 *   5. otherwise, a role read failed         -> unavailable
 *   6. otherwise                             -> insufficient_role
 *
 * Step 4 is safe because the highest record wins: a read that failed could only
 * have added records, so it could only have raised the rank. Step 5 is why a
 * failed TeamMember read is never "no row": it gives no rank at all.
 *
 * The no-row convention is the idea `lib/auth/with-auth.ts` applies to a direct
 * member with no TeamMember row (organisation creation writes none), but here
 * any row for this organisation counts by its role, accepted or not.
 *
 * Nothing is taken from the token, a cookie or the request body. Ranking is
 * `rankOfRole` / `ROLE_RANK` from `lib/auth/rbac/issuer-rank.ts`, called, never
 * copied.
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { trackError } from '@/lib/observability/error-tracker';
import {
  ROLE_RANK,
  rankOfRole,
  type RankedRole,
} from '@/lib/auth/rbac/issuer-rank';
import { checkOrganizationAccess } from '@/lib/multi-business/business-scope';

export type StudioApprovalRefusalReason =
  | 'not_member'
  | 'insufficient_role'
  | 'unavailable';

export type StudioApprovalRefusalCode =
  | 'STUDIO_APPROVE_NOT_ORG_MEMBER'
  | 'STUDIO_APPROVE_ROLE_REQUIRED'
  | 'STUDIO_APPROVE_CHECK_UNAVAILABLE';

export type StudioApprovalRefusal =
  | {
      allowed: false;
      reason: 'not_member';
      code: 'STUDIO_APPROVE_NOT_ORG_MEMBER';
    }
  | {
      allowed: false;
      reason: 'insufficient_role';
      code: 'STUDIO_APPROVE_ROLE_REQUIRED';
    }
  | {
      allowed: false;
      reason: 'unavailable';
      code: 'STUDIO_APPROVE_CHECK_UNAVAILABLE';
    };

export type StudioApprovalAuthority =
  | { allowed: true; role: RankedRole }
  | StudioApprovalRefusal;

/** The four reads of the decision, by the name a failed one is reported under. */
export type StudioApprovalRead =
  | 'membership'
  | 'ownership'
  | 'teamMember'
  | 'userRole';

const NOT_MEMBER: StudioApprovalRefusal = {
  allowed: false,
  reason: 'not_member',
  code: 'STUDIO_APPROVE_NOT_ORG_MEMBER',
};
const INSUFFICIENT_ROLE: StudioApprovalRefusal = {
  allowed: false,
  reason: 'insufficient_role',
  code: 'STUDIO_APPROVE_ROLE_REQUIRED',
};
const UNAVAILABLE: StudioApprovalRefusal = {
  allowed: false,
  reason: 'unavailable',
  code: 'STUDIO_APPROVE_CHECK_UNAVAILABLE',
};

/**
 * Start a read now. A read that throws before it returns a promise becomes a
 * rejection, so one faulty read cannot stop the others from being started.
 */
function start<T>(read: () => PromiseLike<T>): Promise<T> {
  return new Promise<T>(resolve => resolve(read()));
}

/** The canonical role name of a rank, read from the shared ranking table. */
function roleOfRank(rank: number): RankedRole {
  const roles = Object.keys(ROLE_RANK) as RankedRole[];
  return roles.find(role => ROLE_RANK[role] === rank) ?? 'viewer';
}

export async function resolveStudioApprovalAuthority(
  userId: string,
  organisationId: string
): Promise<StudioApprovalAuthority> {
  const [membership, ownership, teamMember, userRole] =
    await Promise.allSettled([
      start(() =>
        checkOrganizationAccess(userId, organisationId, {
          includeParentWorkspace: false,
        })
      ),
      start(() =>
        prisma.businessOwnership.findUnique({
          where: {
            ownerId_organizationId: {
              ownerId: userId,
              organizationId: organisationId,
            },
          },
          select: { isActive: true },
        })
      ),
      start(() =>
        prisma.teamMember.findUnique({
          where: {
            team_member_user_org: { userId, organizationId: organisationId },
          },
          select: { role: true },
        })
      ),
      // Asked for by user id only. Which organisation a grant belongs to and
      // whether it has expired are decided below, in this function.
      start(() =>
        prisma.userRole.findMany({
          where: { userId },
          select: {
            expiresAt: true,
            role: {
              select: { name: true, permissions: true, organizationId: true },
            },
          },
        })
      ),
    ]);

  const decide = (): StudioApprovalAuthority => {
    // 1. Membership is never assumed.
    if (membership.status === 'rejected') return UNAVAILABLE;
    // 2. Not a direct member, whatever the role reads did.
    if (!membership.value) return NOT_MEMBER;

    // 3. The highest rank among the records that were read.
    let rank = ROLE_RANK.viewer;
    if (ownership.status === 'fulfilled' && ownership.value?.isActive) {
      rank = Math.max(rank, ROLE_RANK.owner);
    }
    if (teamMember.status === 'fulfilled') {
      rank = Math.max(
        rank,
        teamMember.value === null
          ? ROLE_RANK.owner
          : rankOfRole(teamMember.value.role)
      );
    }
    if (userRole.status === 'fulfilled') {
      const now = Date.now();
      for (const grant of userRole.value) {
        const inThisOrganisation = grant.role.organizationId === organisationId;
        // The rule lib/auth/rbac/permission-engine.ts applies: no expiry, or
        // an expiry later than now.
        const unexpired =
          grant.expiresAt === null || grant.expiresAt.getTime() > now;
        if (inThisOrganisation && unexpired) {
          rank = Math.max(rank, rankOfRole(grant.role));
        }
      }
    }

    // 4. Allowed on what was read, even if another read failed.
    if (rank >= ROLE_RANK.editor) {
      return { allowed: true, role: roleOfRank(rank) };
    }
    // 5. Nothing read allows, and a read that failed could have.
    if (
      ownership.status === 'rejected' ||
      teamMember.status === 'rejected' ||
      userRole.status === 'rejected'
    ) {
      return UNAVAILABLE;
    }
    // 6. Every record was read and none ranks editor or above.
    return INSUFFICIENT_ROLE;
  };

  const result = decide();

  // Every failed read is reported, whether or not the decision was allowed, so
  // a failing role store is seen before it refuses anyone.
  const decision = result.allowed ? 'allowed' : result.reason;
  const outcome =
    !result.allowed && result.reason === 'unavailable'
      ? { decision, code: result.code }
      : { decision };
  const reads: Array<[StudioApprovalRead, PromiseSettledResult<unknown>]> = [
    ['membership', membership],
    ['ownership', ownership],
    ['teamMember', teamMember],
    ['userRole', userRole],
  ];
  for (const [read, settled] of reads) {
    if (settled.status !== 'rejected') continue;
    const error: unknown = settled.reason;
    logger.error('studio approval authority read failed', {
      userId,
      organizationId: organisationId,
      read,
      ...outcome,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    trackError(error, {
      operation: 'studio/approval-authority',
      userId,
      metadata: { organizationId: organisationId, read, ...outcome },
    });
  }

  return result;
}
