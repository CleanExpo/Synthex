/**
 * Client-tenant provisioning core — Track B v1 (consumption boundary).
 *
 * Spec: docs/specs/spm-track-b-client-provisioning.md (S1'/S2'/S4'/S7'/S8'/S9').
 *
 * One idempotent call provisions an isolated child Organization under a brand
 * parent: child org + default RBAC roles + an ORG-LOCKED owner TeamInvitation
 * + an ENFORCING OrgBudgetPolicy row, all in a single transaction, followed by
 * an audit event. Invoked from the command-centre route, which owns *policy*
 * (authz, parent derivation); this module owns create *mechanics* — a thin
 * extension of the proven POST /api/organizations core.
 *
 * Idempotency: the child slug is derived from IMMUTABLE inputs only — the
 * parent Organization.id (never its renameable slug) plus the caller's stable
 * externalRef — and arbitrated by the Organization.slug @unique index, so
 * concurrent provisions of the same client race safely (P2002 → replay path).
 * The replay path status-checks the found child: active/suspended are returned
 * with replayed=true; a soft-deleted (tombstoned) child surfaces a conflict —
 * its slug is still held by the unique index (resolved for real by the
 * founder-packet external_ref constraint, spec §17.4).
 *
 * `settings.provisioning` is best-effort display metadata, NOT load-bearing:
 * idempotency rests on the slug index, offboard lookups on id/parentOrgId.
 */
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ensureDefaultRoles } from '@/lib/auth/rbac/ensure-default-roles';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { sendBrandedTeamInviteEmail } from '@/lib/email/team-invite-email';
import { createHash } from 'crypto';
import {
  createDefaultSettings,
  PLAN_LIMITS,
  TenantPlan,
} from '@/lib/multi-tenant';

/** Conservative default spend ceilings for provisioned client orgs (USD). */
export const DEFAULT_CLIENT_DAILY_CEILING_USD = 25;
export const DEFAULT_CLIENT_MONTHLY_CEILING_USD = 250;

export interface ProvisionClientOrgInput {
  /** Immutable Organization.id of the brand parent (from the session, never the body). */
  parentOrgId: string;
  /** Stable CRM record id — the idempotency key. Never an email. */
  externalRef: string;
  clientName: string;
  ownerEmail: string;
  plan?: string;
  /** User.id of the brand admin performing the provision (audit + invitation). */
  provisionedBy: string;
  /** Display name used in the invite email greeting. */
  provisionedByName?: string;
}

export interface ProvisionedOrgSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  parentOrgId: string | null;
  createdAt: Date;
}

export interface ProvisionClientOrgResult {
  organization: ProvisionedOrgSummary;
  invitation: { id: string; email: string; status: string } | null;
  replayed: boolean;
  advisory: {
    duplicateBusinessName: true;
    matches: Array<{ organizationId: string; name: string }>;
  } | null;
  emailQueued: boolean;
}

/**
 * Replay against a tombstoned child, or a slug held by a foreign org.
 * Routes map this to HTTP 409.
 */
export class ProvisionConflictError extends Error {
  constructor(
    public readonly reason: 'TOMBSTONED' | 'SLUG_COLLISION',
    message: string
  ) {
    super(message);
    this.name = 'ProvisionConflictError';
  }
}

/**
 * Deterministic child-org slug: `c-` + first 12 base36 chars of
 * sha-256(`${parentOrgId}:${externalRef}`).
 *
 * parentOrgId is the org **id** (immutable), never the brand slug — a brand
 * rename must not change where a client's idempotent replay lands. The `:`
 * separator keeps (ab, c) and (a, bc) from colliding.
 */
export function deriveClientSlug(
  parentOrgId: string,
  externalRef: string
): string {
  const hex = createHash('sha256')
    .update(`${parentOrgId}:${externalRef}`, 'utf8')
    .digest('hex');
  return `c-${BigInt(`0x${hex}`).toString(36).slice(0, 12)}`;
}

/** Unique-constraint violation, duck-typed so tests never need Prisma error classes. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

function envCeiling(name: string, fallback: number): number {
  const parsed = Number.parseFloat(process.env[name] ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Provision (or idempotently replay) a client child-org under a brand parent.
 *
 * @throws ProvisionConflictError on a tombstoned replay or foreign slug holder.
 */
export async function provisionClientOrg(
  input: ProvisionClientOrgInput
): Promise<ProvisionClientOrgResult> {
  const {
    parentOrgId,
    externalRef,
    clientName,
    ownerEmail,
    provisionedBy,
    provisionedByName,
  } = input;
  const plan = input.plan ?? 'free';
  const slug = deriveClientSlug(parentOrgId, externalRef);
  const planLimits =
    PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
  const cap = (limit: number) => (limit === -1 ? 999999 : limit);

  // Advisory only (S9'): warn on a name collision with a business the caller
  // already owns. Non-blocking — the brand admin decides.
  const owned = await prisma.businessOwnership.findMany({
    where: { ownerId: provisionedBy, isActive: true },
    select: { organization: { select: { id: true, name: true } } },
  });
  const nameLc = clientName.trim().toLowerCase();
  const matches = owned
    .map(o => o.organization)
    .filter(o => o.name.trim().toLowerCase() === nameLc)
    .map(o => ({ organizationId: o.id, name: o.name }));
  const advisory = matches.length
    ? ({ duplicateBusinessName: true, matches } as const)
    : null;

  try {
    const { organization, invitation } = await prisma.$transaction(async tx => {
      const organization = await tx.organization.create({
        data: {
          name: clientName,
          slug,
          plan,
          status: 'active',
          parentOrgId,
          domain: `${slug}.synthex.social`,
          settings: JSON.parse(
            JSON.stringify({
              ...createDefaultSettings(plan as TenantPlan),
              // Server-owned display metadata — reserved key, never
              // load-bearing (§11). The org PATCH strips client writes to it.
              provisioning: {
                externalRef,
                parentOrgId,
                provisionedBy,
                provisionedAt: new Date().toISOString(),
              },
            })
          ),
          maxUsers: cap(planLimits?.maxUsers ?? 5),
          maxPosts: cap(planLimits?.maxPosts ?? 500),
          maxCampaigns: cap(planLimits?.maxCampaigns ?? 10),
        },
      });

      await ensureDefaultRoles(organization.id, tx);

      // ORG-LOCKED evidence (S4'): non-null organizationId, role 'owner'.
      // Satisfies the Track-A signup gate and joins THIS org via
      // invite-accept; excluded from generic self-provisioning evidence.
      const invitation = await tx.teamInvitation.create({
        data: {
          email: ownerEmail,
          role: 'owner',
          status: 'sent',
          userId: provisionedBy,
          organizationId: organization.id,
        },
      });

      // Spend edge (S7'): never rely on the log-only default. Bounds the
      // enforcer-covered surface (generate-content + calendar) — see spec
      // §17.7 for the honest-coverage residual.
      await tx.orgBudgetPolicy.create({
        data: {
          organizationId: organization.id,
          enforcementMode: 'enforce',
          dailyCeilingUsd: envCeiling(
            'SYNTHEX_CLIENT_DAILY_COST_CEILING_USD',
            DEFAULT_CLIENT_DAILY_CEILING_USD
          ),
          monthlyCeilingUsd: envCeiling(
            'SYNTHEX_CLIENT_MONTHLY_COST_CEILING_USD',
            DEFAULT_CLIENT_MONTHLY_CEILING_USD
          ),
        },
      });

      return { organization, invitation };
    });

    await logAuditEvent({
      event: 'provisioning.created',
      userId: provisionedBy,
      metadata: {
        organizationId: organization.id,
        parentOrgId,
        externalRef,
        slug,
        ownerEmail,
      },
    });

    let emailQueued = false;
    if (process.env.SYNTHEX_PROVISIONING_INVITE_EMAILS === 'true') {
      try {
        const sent = await sendBrandedTeamInviteEmail({
          to: ownerEmail,
          businessName: clientName,
          ownerName: provisionedByName || 'Your brand team',
          invitationId: invitation.id,
        });
        emailQueued = Boolean(sent?.success);
        if (!sent?.success) {
          logger.error('provisioning: invite email send failed', {
            invitationId: invitation.id,
            error: sent?.error,
          });
        }
      } catch (error) {
        // Best-effort — email failure never fails provisioning.
        logger.error('provisioning: invite email send threw', {
          invitationId: invitation.id,
          error,
        });
      }
    }

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
        status: organization.status,
        parentOrgId: organization.parentOrgId,
        createdAt: organization.createdAt,
      },
      invitation: {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
      },
      replayed: false,
      advisory,
      emailQueued,
    };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return replayExistingChild({
      slug,
      parentOrgId,
      externalRef,
      ownerEmail,
      provisionedBy,
      advisory,
    });
  }
}

/**
 * P2002 replay path (S2'): the slug already exists — the DB unique index is
 * the race arbiter. Status-check the holder before returning it.
 */
async function replayExistingChild(args: {
  slug: string;
  parentOrgId: string;
  externalRef: string;
  ownerEmail: string;
  provisionedBy: string;
  advisory: ProvisionClientOrgResult['advisory'];
}): Promise<ProvisionClientOrgResult> {
  const { slug, parentOrgId, externalRef, ownerEmail, provisionedBy } = args;

  const existing = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      status: true,
      parentOrgId: true,
      createdAt: true,
    },
  });
  if (!existing) {
    // P2002 on something other than our slug — not a replay.
    throw new ProvisionConflictError(
      'SLUG_COLLISION',
      'Provisioning hit a unique-constraint conflict that is not the derived slug.'
    );
  }
  if (existing.parentOrgId !== parentOrgId) {
    throw new ProvisionConflictError(
      'SLUG_COLLISION',
      'Derived slug is held by an organization outside this brand.'
    );
  }
  if (existing.status === 'deleted') {
    // Tombstone: the soft-deleted child still holds the slug (documented S2'
    // limit until the founder-packet unique constraint lands).
    throw new ProvisionConflictError(
      'TOMBSTONED',
      'A previously deleted client org holds this externalRef. Founder action required to re-provision.'
    );
  }

  const invitation = await prisma.teamInvitation.findFirst({
    where: { organizationId: existing.id, email: ownerEmail },
    orderBy: { sentAt: 'desc' },
    select: { id: true, email: true, status: true },
  });

  await logAuditEvent({
    event: 'provisioning.replay_detected',
    userId: provisionedBy,
    metadata: {
      organizationId: existing.id,
      parentOrgId,
      externalRef,
      slug,
      childStatus: existing.status,
    },
  });

  return {
    organization: existing,
    invitation,
    replayed: true,
    advisory: args.advisory,
    emailQueued: false,
  };
}
