/**
 * Client Content Studio — per-client board API (SYN-1005 / VS-6).
 *
 * GET  /api/marketing-agency/studio/[client]  → org-scoped board grouped by status.
 * POST /api/marketing-agency/studio/[client]  → approve a draft (the human-approval gate).
 *
 * Auth + org-scope via APISecurityChecker + getEffectiveOrganizationId (same pattern as the
 * other marketing-agency routes). All reads/writes are organisation-scoped in draft-store.
 *
 * @module app/api/marketing-agency/studio/[client]/route
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { logger } from '@/lib/logger';
import {
  listStudioDrafts,
  approveStudioDraft,
} from '@/lib/marketing-agency/studio/draft-store';
import { getStudioClient } from '@/lib/marketing-agency/studio/clients';

export const runtime = 'nodejs';

type RouteCtx = { params: Promise<{ client: string }> };

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
  const studioClient = getStudioClient(client);
  if (!studioClient) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Unknown studio client' },
      404,
      security.context
    );
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'No organisation found' },
      400,
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

const approveSchema = z.object({ draftId: z.string().min(1) });

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
  if (!getStudioClient(client)) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Unknown studio client' },
      404,
      security.context
    );
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'No organisation found' },
      400,
      security.context
    );
  }

  try {
    const count = await approveStudioDraft({
      organizationId,
      id: parsed.data.draftId,
      approvedBy: userId,
    });
    if (count === 0) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Draft not found or not awaiting approval' },
        404,
        security.context
      );
    }
    return APISecurityChecker.createSecureResponse(
      { approved: true, draftId: parsed.data.draftId },
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
