/**
 * Command Centre — client tenant provisioning (Track B v1).
 *
 * Spec: docs/specs/spm-track-b-client-provisioning.md (S1'/S3'/§9.2).
 *
 *   POST /api/command-centre/clients — provision one isolated client child-org
 *     under the caller's brand. Brand-admin (owner) JWT only. The parent org is
 *     the AUTHENTICATED SESSION ORG (withAuth clientId) — no request parameter
 *     selects it, ever (copies the proven /api/organisations/children scoping).
 *     A caller whose org is itself a child is rejected 403 (depth-2 cap).
 *     Idempotent: replaying the same externalRef returns the existing child
 *     with replayed=true (200); a tombstoned holder surfaces 409.
 *
 *   GET /api/command-centre/clients — list the caller-org's child organisations
 *     (scoping copied verbatim from /api/organisations/children).
 *
 * This route owns POLICY (authz, parent derivation, status mapping); create
 * mechanics live in lib/tenancy/provision-client-org.ts.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { withAuth } from '@/lib/auth/with-auth';
import {
  provisionClientOrg,
  ProvisionConflictError,
} from '@/lib/tenancy/provision-client-org';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ProvisionClientSchema = z.object({
  /** Stable CRM record id — the idempotency key. Never an email. */
  externalRef: z.string().min(1).max(200),
  clientName: z.string().min(1).max(200),
  ownerEmail: z.string().email(),
  // NOTE: no `plan` field (SYN-1107) — a new client org is always provisioned
  // on `free`; its plan derives only from Stripe state, never client input.
  // Also no parent/parentOrgId field — the parent is the session org, full
  // stop (S3'). Unknown body keys are ignored by zod, so a hostile `plan` or
  // `parentOrgId` in the payload is dropped and can never select a tier/brand.
});

export const POST = withAuth(async (request, { userId, clientId, role }) => {
  // Brand-admin only: collaborators cannot provision client tenants.
  if (role !== 'owner') {
    return NextResponse.json(
      { error: 'Provisioning requires brand-admin (owner) access' },
      { status: 403 }
    );
  }

  // Depth-2 cap (S3'): the parent is the caller's own org, which must be a
  // ROOT (brand) org. 403 — never a 404 that leaks org existence.
  const parent = await prisma.organization.findUnique({
    where: { id: clientId },
    select: { id: true, parentOrgId: true, status: true },
  });
  if (!parent || parent.parentOrgId !== null) {
    return NextResponse.json(
      { error: 'Client provisioning is available to brand organisations only' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = ProvisionClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await provisionClientOrg({
      parentOrgId: parent.id,
      externalRef: parsed.data.externalRef,
      clientName: parsed.data.clientName,
      ownerEmail: parsed.data.ownerEmail,
      provisionedBy: userId,
    });

    return NextResponse.json(
      {
        success: true,
        organization: result.organization,
        invitation: result.invitation,
        replayed: result.replayed,
        advisory: result.advisory,
        emailQueued: result.emailQueued,
      },
      { status: result.replayed ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof ProvisionConflictError) {
      logger.warn('command-centre/clients: provisioning conflict', {
        userId,
        parentOrgId: parent.id,
        reason: error.reason,
      });
      return NextResponse.json(
        { error: error.message, reason: error.reason },
        { status: 409 }
      );
    }
    logger.error('command-centre/clients: provisioning failed', {
      userId,
      parentOrgId: parent.id,
      error,
    });
    return NextResponse.json(
      { error: 'Failed to provision client organisation' },
      { status: 500 }
    );
  }
});

/**
 * GET — the caller-org's child organisations. Scoped to `clientId` (the
 * caller's resolved org) so the query can only ever return children of the
 * org the session belongs to — copied from /api/organisations/children.
 */
export const GET = withAuth(async (_request, { clientId }) => {
  const children = await prisma.organization.findMany({
    where: { parentOrgId: clientId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      plan: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    children: children.map(c => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      status: c.status,
      plan: c.plan,
      createdAt: c.createdAt,
    })),
  });
});
