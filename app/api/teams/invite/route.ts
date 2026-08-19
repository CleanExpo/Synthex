import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { sendTeamInviteEmail } from '@/lib/email';
import { sendBrandedTeamInviteEmail } from '@/lib/email/team-invite-email';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import {
  resolveIssuerRole,
  requireIssuerOutranks,
} from '@/lib/auth/rbac/issuer-rank';
import { logger } from '@/lib/logger';

/** Roles that may be issued via a team invitation, highest → lowest. */
const ALLOWED_INVITE_ROLES = ['owner', 'admin', 'editor', 'viewer'] as const;

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1).max(50).optional(),
  message: z.string().max(2000).optional(),
  campaignAccess: z.union([z.array(z.string()), z.string()]).optional(),
});

/**
 * POST /api/teams/invite
 * Accepts: { email, role, message?, campaignAccess? }
 * Returns: { success, data|error }
 *
 * REQUIRES AUTHENTICATION - Only authenticated users can send invitations.
 *
 * Persists a TeamInvitation when DATABASE_URL is configured.
 * Falls back to a non-persistent response if DB is unavailable.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token verification (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */
export async function POST(req: NextRequest) {
  // Security check - requires authentication with write permissions
  const security = await APISecurityChecker.check(
    req,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { success: false, error: security.error || 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  try {
    let rawPayload: unknown = {};
    try {
      rawPayload = await req.json();
    } catch {
      // allow empty body -> treat as invalid below
    }

    const parsed = InviteSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const email = parsed.data.email;
    const requestedRole = (parsed.data.role?.trim() || 'viewer').toLowerCase();
    const message = parsed.data.message || '';

    // Normalize campaignAccess to array of strings
    let campaignAccess: string[];
    const rawAccess = parsed.data.campaignAccess;
    if (typeof rawAccess === 'string') {
      campaignAccess = [rawAccess];
    } else if (Array.isArray(rawAccess)) {
      campaignAccess = rawAccess;
    } else {
      campaignAccess = [];
    }

    // Resolve the inviter's organisation up-front. This is REQUIRED — without
    // it the TeamInvitation has no organizationId, the accept route 422s, and
    // the invitee is never linked to an org (the P0 lockout). We derive it
    // from the authenticated inviter rather than trusting the body, so a
    // collaborator can only ever be invited into the inviter's own org.
    const inviterUserId = security.context.userId;
    let inviterOrgId: string | null = null;
    let inviterName: string | null = null;
    let organizationName = '';
    if (inviterUserId) {
      const inviter = await prisma.user.findUnique({
        where: { id: inviterUserId },
        select: {
          name: true,
          email: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      });
      inviterOrgId = inviter?.organizationId ?? null;
      inviterName = inviter?.name ?? inviter?.email ?? null;
      organizationName = inviter?.organization?.name ?? '';
    }

    // An inviter with no organisation cannot invite collaborators — there is
    // no tenant to add them to.
    if (!inviterOrgId) {
      return NextResponse.json(
        {
          success: false,
          error: 'You must belong to an organisation to invite collaborators',
        },
        { status: 403 }
      );
    }

    // inviterOrgId is only ever set inside the `if (inviterUserId)` block, so a
    // present org implies a present user; narrow explicitly for the type-checker.
    if (!inviterUserId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ── Authorisation gate (SYN-1107) ─────────────────────────────────────
    // Only an org admin/owner may send invitations. Mirrors the canonical
    // admin gate the sibling team routes use (teams/members POST and
    // teams/members/[memberId]/role PATCH) so invite / add-member / change-role
    // all authorise identically. Without this any authenticated member could
    // invite an `owner`/`admin` and self-escalate on accept.
    const inviterIsAdmin = await checkUserIsAdmin(inviterUserId, inviterOrgId);
    if (!inviterIsAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only administrators can invite collaborators',
        },
        { status: 403 }
      );
    }

    // Validate the requested role against the allowlist, then cap it to the
    // caller's authority via the shared issuer-rank guard (SYN-1108): the
    // inviter may never seat a role above their own, and only an owner may seat
    // an owner. resolveIssuerRole derives the inviter's effective rank from the
    // durable authority signals (active BusinessOwnership / owner membership /
    // RBAC roles). An unknown role is a 400.
    if (
      !ALLOWED_INVITE_ROLES.includes(
        requestedRole as (typeof ALLOWED_INVITE_ROLES)[number]
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }
    const issuerRole = await resolveIssuerRole(inviterUserId, inviterOrgId);
    if (!requireIssuerOutranks(issuerRole, requestedRole)) {
      return NextResponse.json(
        {
          success: false,
          error:
            requestedRole === 'owner'
              ? 'Only an organisation owner may invite an owner'
              : 'You cannot invite a role above your own',
        },
        { status: 403 }
      );
    }
    const role = requestedRole;

    // Try to persist via Prisma if DATABASE_URL is set
    interface TeamInvitation {
      id: string;
      email: string;
      role: string;
      message?: string;
      campaignAccess: string[];
      status: string;
      userId: string;
      organizationId?: string | null;
      createdAt: Date;
    }
    interface PrismaWithTeamInvitation {
      teamInvitation?: {
        create: (args: {
          data: Record<string, unknown>;
        }) => Promise<TeamInvitation>;
      };
    }
    let persisted: TeamInvitation | null = null;
    const canUseDb = !!process.env.DATABASE_URL;
    if (canUseDb) {
      try {
        const teamInvitationModel = (
          prisma as unknown as PrismaWithTeamInvitation
        ).teamInvitation;
        if (teamInvitationModel) {
          persisted = await teamInvitationModel.create({
            data: {
              email,
              role,
              message,
              campaignAccess: campaignAccess,
              status: 'sent',
              userId: inviterUserId, // Track who sent the invitation
              organizationId: inviterOrgId, // REQUIRED so accept can link the org
            },
          });
        }
      } catch (e) {
        logger.error(
          'Prisma invitation create failed, falling back to non-persistent response:',
          e
        );
      }
    }

    const invitation = persisted || {
      id: `invite_${Date.now()}`,
      email,
      role,
      message,
      campaignAccess,
      status: 'sent',
      sentAt: new Date().toISOString(),
    };

    // Best-effort email dispatch; do not fail request on email error.
    // When we persisted a TeamInvitation we have a real id → send the branded
    // email whose CTA links to /invite/accept?token=<id> (the working accept
    // flow). Otherwise fall back to the legacy generic invite email.
    let emailQueued = false;
    if (persisted?.id && process.env.RESEND_API_KEY) {
      try {
        const result = await sendBrandedTeamInviteEmail({
          to: email,
          businessName: organizationName || 'your team',
          ownerName: inviterName || 'A teammate',
          invitationId: persisted.id,
        });
        emailQueued = result.success;
        if (!result.success) {
          logger.error('Branded invite email send failed:', result.error);
        }
      } catch (e) {
        logger.error('Branded invite email send failed:', e);
      }
    } else if (process.env.EMAIL_PROVIDER && process.env.EMAIL_FROM) {
      try {
        await sendTeamInviteEmail({
          to: email,
          role,
          message,
          inviterName: inviterName ?? undefined,
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
        });
        emailQueued = true;
      } catch (e) {
        logger.error('Invite email send failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      data: invitation,
      emailQueued,
      message: persisted ? 'Invitation persisted' : 'Invitation sent',
    });
  } catch (err) {
    logger.error('Invite error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to process invitation' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Canonical admin check, mirrored from the sibling team routes
 * (teams/members POST and teams/members/[memberId]/role PATCH) so that who may
 * invite a collaborator authorises identically to who may add or re-role one.
 *
 * A user is an admin/owner of the organisation if they hold any org-scoped role
 * whose name is `admin`/`owner`, or whose permissions include `admin`,
 * `manage_members`, `manage_roles`, or the `*` wildcard.
 *
 * NOTE: the org filter must live on the top-level `where` via the `role`
 * relation — a `where` inside a to-one `include` is invalid in Prisma and
 * throws at runtime (swallowed by the catch below, which would silently deny
 * every real admin). See RoleManager.getUserRoles.
 */
async function checkUserIsAdmin(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        role: { organizationId },
      },
      include: {
        role: {
          select: {
            name: true,
            permissions: true,
          },
        },
      },
    });

    for (const ur of userRoles) {
      if (ur.role) {
        const roleName = ur.role.name.toLowerCase();
        const permissions = ur.role.permissions || [];

        if (
          roleName === 'admin' ||
          roleName === 'owner' ||
          permissions.includes('admin') ||
          permissions.includes('manage_members') ||
          permissions.includes('manage_roles') ||
          permissions.includes('*')
        ) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
