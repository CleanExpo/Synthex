/**
 * Command Centre — client offboarding (Track B v1).
 *
 * Spec: docs/specs/spm-track-b-client-provisioning.md (S6').
 *
 * POST /api/command-centre/clients/[id]/offboard — suspend the child org and
 * cut it off on every org-scoped plane, in one transaction:
 *   (a) idempotent soft-revoke of every mcp_api_keys row for the child
 *   (d) neutralise home pointers (organizationId AND activeOrganizationId)
 *       of EVERY member — owner and collaborators
 *   (e) flip open provisioning TeamInvitations out of the evidence set
 * plus the `status='suspended'` flip that the (b) resolveOrgFromBearer,
 * (c) withAuth and (f) getEffectiveOrganizationId chokepoint gates key off.
 *
 * Reversible — no hard delete. Idempotent — re-offboarding a suspended child
 * re-runs the (harmless) enforcement writes and returns 200.
 *
 * DOCUMENTED v1 residuals (adversary-amended criterion 5 — named, never
 * claimed closed): live JWT sessions survive until expiry, and org-agnostic
 * image generation (clientId=null) is user-scoped, untouched by suspension.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { withAuth } from '@/lib/auth/with-auth';
import { logAuditEvent } from '@/lib/audit/audit-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The two v1 enforcement residuals — surfaced on every offboard response. */
export const OFFBOARD_RESIDUALS = [
  'Live JWT sessions issued before suspension remain valid until expiry (session revocation is a platform follow-up, spec §17.7).',
  'Org-agnostic image generation (media/generate/image runs clientId=null) is user-scoped and unaffected by org suspension (spec §17.7).',
] as const;

/** /api/command-centre/clients/{id}/offboard → {id} */
function extractClientId(url: string): string | null {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  const offboardIdx = segments.lastIndexOf('offboard');
  return offboardIdx > 0 ? (segments[offboardIdx - 1] ?? null) : null;
}

export const POST = withAuth(async (request, { userId, clientId, role }) => {
  if (role !== 'owner') {
    return NextResponse.json(
      { error: 'Offboarding requires brand-admin (owner) access' },
      { status: 403 }
    );
  }

  const childId = extractClientId(request.url);
  if (!childId) {
    return NextResponse.json({ error: 'Missing client id' }, { status: 400 });
  }

  // The child must belong to the CALLER's brand — 403 for both "not found"
  // and "foreign brand" so org existence never leaks across tenants.
  const child = await prisma.organization.findUnique({
    where: { id: childId },
    select: { id: true, parentOrgId: true, status: true },
  });
  if (!child || child.parentOrgId !== clientId) {
    return NextResponse.json(
      { error: 'Client organisation not found in your brand' },
      { status: 403 }
    );
  }

  try {
    const enforcement = await prisma.$transaction(async tx => {
      await tx.organization.update({
        where: { id: child.id },
        data: { status: 'suspended' },
      });

      // (a) machine plane: idempotent soft-revoke (mirrors admin/mcp-keys
      // DELETE semantics — already-revoked rows are untouched).
      const keys = await tx.mcpApiKey.updateMany({
        where: { organizationId: child.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // (e) evidence plane: open invitations stop satisfying the Track-A gate.
      const invitations = await tx.teamInvitation.updateMany({
        where: {
          organizationId: child.id,
          status: { in: ['sent', 'pending'] },
        },
        data: { status: 'revoked' },
      });

      // (d) human plane: EVERY member's home pointers, owner included.
      const members = await tx.user.updateMany({
        where: { organizationId: child.id },
        data: { organizationId: null },
      });
      const activePointers = await tx.user.updateMany({
        where: { activeOrganizationId: child.id },
        data: { activeOrganizationId: null },
      });

      return {
        keysRevoked: keys.count,
        invitationsRevoked: invitations.count,
        membersDetached: members.count,
        activePointersCleared: activePointers.count,
      };
    });

    await logAuditEvent({
      event: 'provisioning.offboarded',
      userId,
      metadata: {
        organizationId: child.id,
        parentOrgId: clientId,
        ...enforcement,
      },
    });

    logger.info('command-centre/clients: offboarded', {
      organizationId: child.id,
      parentOrgId: clientId,
      by: userId,
      ...enforcement,
    });

    return NextResponse.json({
      success: true,
      organizationId: child.id,
      status: 'suspended',
      enforcement,
      residuals: OFFBOARD_RESIDUALS,
    });
  } catch (error) {
    logger.error('command-centre/clients: offboard failed', {
      organizationId: child.id,
      error,
    });
    return NextResponse.json(
      { error: 'Failed to offboard client organisation' },
      { status: 500 }
    );
  }
});
