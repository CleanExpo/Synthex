/**
 * Client Content Studio — per-client board API (SYN-1005 / VS-6).
 *
 * GET  /api/marketing-agency/studio/[client]  → org-scoped board grouped by status.
 * POST /api/marketing-agency/studio/[client]  → approve a draft (the human-approval
 *      gate) and schedule it for publishing (g2).
 *
 * Auth + org-scope via APISecurityChecker. The `[client]` segment IS the organisation
 * slug: the organisation record is loaded, the Studio configuration is derived from it
 * (g9 — no hardcoded client registry), then access is checked before any
 * organisation-scoped reads/writes.
 *
 * @module app/api/marketing-agency/studio/[client]/route
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { hasOrganizationAccess } from '@/lib/multi-business';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { listStudioDrafts } from '@/lib/marketing-agency/studio/draft-store';
import { approveAndScheduleStudioDraft } from '@/lib/marketing-agency/studio/approve-and-schedule';
import { resolveStudioClient } from '@/lib/marketing-agency/studio/clients';

export const runtime = 'nodejs';

type RouteCtx = { params: Promise<{ client: string }> };

async function loadStudioOrganization(clientSlug: string) {
  return prisma.organization.findUnique({
    where: { slug: clientSlug },
    select: { id: true, name: true, slug: true, website: true, settings: true },
  });
}

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      401,
      security.context
    );
  }

  const { client } = await params;
  const organization = await loadStudioOrganization(client);
  if (!organization) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Studio client organisation not found' },
      404,
      security.context
    );
  }
  const studioClient = resolveStudioClient(organization);
  const organizationId = organization.id;

  const userId = security.context.userId!;
  const canAccessClient = await hasOrganizationAccess(userId, organizationId);
  if (!canAccessClient) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Forbidden' },
      403,
      security.context
    );
  }

  try {
    const drafts = (await listStudioDrafts({
      organizationId,
      clientSlug: client,
    })) as Array<{ status: string }>;

    const board: Record<string, Array<{ status: string }>> = {
      awaiting_approval: [],
      approved: [],
      published: [],
      rejected: [],
    };
    for (const draft of drafts) {
      (board[draft.status] ??= []).push(draft);
    }

    return APISecurityChecker.createSecureResponse(
      {
        clientSlug: client,
        displayName: studioClient.displayName,
        organizationId,
        platforms: studioClient.platforms,
        funnelUrl: studioClient.funnelUrl,
        videoConfigured: studioClient.video !== null,
        configSource: studioClient.configSource,
        warnings: studioClient.warnings,
        board,
        total: drafts.length,
      },
      200,
      security.context
    );
  } catch (error) {
    logger.error('studio board read failed', {
      clientSlug: client,
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to load studio board' },
      500,
      security.context
    );
  }
}

const approveSchema = z.object({
  draftId: z.string().min(1),
  /** ISO instant to publish at. Omit to publish on the cron's next tick. */
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});

export async function POST(request: NextRequest, { params }: RouteCtx) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      401,
      security.context
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid request body' },
      400,
      security.context
    );
  }

  const { client } = await params;
  const organization = await loadStudioOrganization(client);
  if (!organization) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Studio client organisation not found' },
      404,
      security.context
    );
  }
  const studioClient = resolveStudioClient(organization);
  const organizationId = organization.id;

  const userId = security.context.userId!;
  const canAccessClient = await hasOrganizationAccess(userId, organizationId);
  if (!canAccessClient) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Forbidden' },
      403,
      security.context
    );
  }

  try {
    const result = await approveAndScheduleStudioDraft({
      organizationId,
      id: parsed.data.draftId,
      approvedBy: userId,
      client: studioClient,
      scheduledAt: parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt)
        : undefined,
    });
    if (!result.approved) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Draft not found or not awaiting approval' },
        404,
        security.context
      );
    }
    return APISecurityChecker.createSecureResponse(
      {
        approved: true,
        draftId: parsed.data.draftId,
        scheduled: result.scheduled,
        skipped: result.skipped,
      },
      200,
      security.context
    );
  } catch (error) {
    logger.error('studio draft approval failed', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to approve draft' },
      500,
      security.context
    );
  }
}
