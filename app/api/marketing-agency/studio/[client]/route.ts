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
 * SYN-1412: reading the board needs access to the organisation (the parent
 * workspace counts); approving needs direct membership and an editor, admin or
 * owner role. Who may approve is decided in one place,
 * `resolveStudioApprovalAuthority`, which GET (`canApprove`, `approveRefusal`)
 * and the POST gate both call. A read that fails while either rule is checked
 * answers 503, never a refusal.
 *
 * @module app/api/marketing-agency/studio/[client]/route
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { checkOrganizationAccess } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';
import { trackError } from '@/lib/observability/error-tracker';
import prisma from '@/lib/prisma';
import { listStudioDrafts } from '@/lib/marketing-agency/studio/draft-store';
import { withFreshReviewLinks } from '@/lib/marketing-agency/studio/review-links';
import { signedUrls } from '@/lib/storage/object-storage';
import {
  approveAndScheduleStudioDraft,
  InvalidClearanceError,
} from '@/lib/marketing-agency/studio/approve-and-schedule';
import { resolveStudioClient } from '@/lib/marketing-agency/studio/clients';
import { resolveStudioApprovalAuthority } from '@/lib/marketing-agency/studio/approval-authority';

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
  let canAccessClient: boolean;
  try {
    canAccessClient = await checkOrganizationAccess(userId, organizationId);
  } catch (error) {
    // A read that failed is not a refusal: say the check could not be made.
    const code = 'STUDIO_ACCESS_CHECK_UNAVAILABLE';
    logger.error('studio board access check failed', {
      userId,
      organizationId,
      clientSlug: client,
      code,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    trackError(error, {
      operation: 'studio/board-access',
      userId,
      metadata: { organizationId, clientSlug: client, code },
    });
    return APISecurityChecker.createSecureResponse(
      {
        error:
          'Access could not be checked just now. Reload the page to try again.',
        code: 'STUDIO_ACCESS_CHECK_UNAVAILABLE' satisfies typeof code,
      },
      503,
      security.context
    );
  }
  if (!canAccessClient) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Forbidden' },
      403,
      security.context
    );
  }
  // The board may be read from the parent workspace; approving needs direct
  // membership and an editor-or-above role. Tell the client whether it may
  // approve, decided by the same function the POST gates on, so a button is
  // never shown that the POST will refuse.
  const authority = await resolveStudioApprovalAuthority(
    userId,
    organizationId
  );
  const approveRefusal = authority.allowed ? null : authority.code;
  if (approveRefusal !== null) {
    // The page hides the button, so a refused person never sends the POST
    // that would have logged: this line is the only trace of a lost approve.
    logger.info('studio approve refused', {
      userId,
      organizationId,
      code: approveRefusal,
    });
  }

  try {
    // Review copies are signed on every read, so a link saved at load time
    // can never expire on the client. A link that cannot be signed is
    // reported on the card (videoError), never served stale.
    const drafts = await withFreshReviewLinks(
      (await listStudioDrafts({
        organizationId,
        clientSlug: client,
      })) as Array<{ status: string; metadata?: unknown }>,
      client,
      signedUrls,
      (bucket, error) =>
        logger.error('studio review link signing failed', {
          clientSlug: client,
          organizationId,
          bucket,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
    );

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
        canApprove: authority.allowed,
        approveRefusal,
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
  /**
   * Campaign-pack blocker ids the approver explicitly discharges with this
   * approval (e.g. `final_asset_rights_check_required`). Recorded on the draft
   * when the approval commits. The reserved ids are refused by the service
   * (`InvalidClearanceError` → 400 with `blockers`), the one place that owns
   * the rule, so the response names them rather than a generic body error.
   */
  clearances: z.array(z.string().min(1).max(120)).max(10).optional(),
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

  // Approving publishes on the organisation's behalf: the approver must belong
  // to THIS organisation (member, owner, or user), not merely to its parent
  // workspace, and hold an editor, admin or owner role there. Reading the
  // board (GET) keeps the wider check.
  const userId = security.context.userId!;
  const authority = await resolveStudioApprovalAuthority(
    userId,
    organizationId
  );
  if (!authority.allowed) {
    logger.warn('studio approve refused', {
      userId,
      organizationId,
      reason: authority.reason,
      code: authority.code,
    });
    // Each code is written out where it is answered, and checked against the
    // code the authority module gives for that reason: a renamed or swapped
    // code fails type-check.
    switch (authority.reason) {
      case 'not_member':
        // Distinguishable from the board's 403: this caller may be able to
        // READ the board (parent workspace) and still not speak for the
        // organisation.
        return APISecurityChecker.createSecureResponse(
          {
            error:
              'Approval requires membership of this organisation (its own member or an active business owner), not of its parent workspace',
            organizationId,
            code: 'STUDIO_APPROVE_NOT_ORG_MEMBER' satisfies typeof authority.code,
          },
          403,
          security.context
        );
      case 'insufficient_role':
        return APISecurityChecker.createSecureResponse(
          {
            error:
              'You can view this board. Approving needs an editor, admin or owner role in this organisation. An owner or admin of this organisation can change your role.',
            code: 'STUDIO_APPROVE_ROLE_REQUIRED' satisfies typeof authority.code,
          },
          403,
          security.context
        );
      case 'unavailable':
        // A read failed and nothing that was read allows: not a refusal.
        return APISecurityChecker.createSecureResponse(
          {
            error:
              'Approval could not be checked just now. Reload the page to try again.',
            code: 'STUDIO_APPROVE_CHECK_UNAVAILABLE' satisfies typeof authority.code,
          },
          503,
          security.context
        );
      default: {
        // A reason added to the union without a case here fails type-check;
        // if one ever arrives at run time, nothing is approved.
        const unhandled: never = authority;
        throw new Error(
          `Unhandled studio approval refusal: ${JSON.stringify(unhandled)}`
        );
      }
    }
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
      clearances: parsed.data.clearances,
    });

    switch (result.outcome) {
      case 'not_awaiting_approval':
        return APISecurityChecker.createSecureResponse(
          { error: 'Draft not found or not awaiting approval' },
          404,
          security.context
        );
      case 'blocked': {
        // The draft is back in awaiting_approval; the reasons name what to
        // clear. When the organisation's publish-safety state is the block,
        // the response names the organisation and the action that opens it —
        // a fail-closed gate whose message does not say which row opens it
        // reads as a bug.
        const orgGated = result.skipped.some(entry =>
          entry.reason.startsWith('org_publish_gate')
        );
        return APISecurityChecker.createSecureResponse(
          {
            error:
              'External publishing is blocked for this draft; it remains awaiting approval',
            draftId: parsed.data.draftId,
            organizationId,
            outcome: result.outcome,
            skipped: result.skipped,
            ...(orgGated
              ? {
                  remedy: {
                    action: 'POST /api/calendar/live-mode-activate',
                    body: { tier: 1, confirmed: true, organizationId },
                    note: 'The organisation must be calendarMode live and not paused before a Studio post can be scheduled.',
                  },
                }
              : {}),
          },
          409,
          security.context
        );
      }
      case 'schedule_failed':
        return APISecurityChecker.createSecureResponse(
          {
            error:
              'Scheduling failed; the draft remains awaiting approval and can be retried',
            draftId: parsed.data.draftId,
            outcome: result.outcome,
            skipped: result.skipped,
          },
          502,
          security.context
        );
      case 'approved':
        return APISecurityChecker.createSecureResponse(
          {
            approved: true,
            draftId: parsed.data.draftId,
            outcome: result.outcome,
            scheduled: result.scheduled,
            skipped: result.skipped,
          },
          200,
          security.context
        );
    }
  } catch (error) {
    if (error instanceof InvalidClearanceError) {
      return APISecurityChecker.createSecureResponse(
        { error: error.message, blockers: error.blockers },
        400,
        security.context
      );
    }
    logger.error('studio draft approval failed', {
      organizationId,
      draftId: parsed.data.draftId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // The bridge tracks failures inside its own boundaries; anything that
    // escapes to here (a rejected claim, a rejected final record) must reach
    // the error backend too, with the draft named so one can be reproduced.
    trackError(error, {
      operation: 'studio/approve-and-schedule',
      metadata: {
        organizationId,
        clientSlug: client,
        draftId: parsed.data.draftId,
        stage: 'route',
      },
    });
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to approve draft' },
      500,
      security.context
    );
  }
}
