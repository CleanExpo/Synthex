/**
 * Human Publish-Release API — app/api/publish-queue/release/route.ts
 *
 * THE HUMAN GATE for nexus-viral video cuts (SYN-1075 WS4b).
 *
 * `deriveSocialCut` lands each cut in `publish_queue` as `queued_human_gated`.
 * `processPublishQueue` only ever drains `pending` / `failed` rows, so a gated
 * row is INERT — it can never reach a platform — until a human explicitly
 * releases it here. This route is the ONLY path in the codebase that transitions
 * a `queued_human_gated` row into `pending` (the §15.9 always-human-gated
 * invariant; enforced by a grep-level test).
 *
 * Contract:
 *   - POST only.
 *   - Rate limited (writeDefault — sensitive mutation).
 *   - 401 if unauthenticated.
 *   - 400 if the body fails Zod validation.
 *   - 403 if the caller is not the org owner (owner/RBAC — releasing to a live
 *     social account is an owner-only, irreversible-in-spirit action).
 *   - Org-scoped: the atomic `updateMany` is filtered by the caller's
 *     `organizationId`, so a cut belonging to another organisation can never be
 *     released (cross-org rows simply do not match → released: 0 → 404).
 *   - Atomic claim: `updateMany({ where: status 'queued_human_gated' })` means
 *     concurrent release clicks race on the DB — exactly one transitions each
 *     row; the loser sees it already moved and counts 0 (no double-publish).
 *   - Every release / reject writes an `audit_logs` row in the same transaction.
 *
 * `action`:
 *   - `release` (default): `queued_human_gated → pending` — the queue will now
 *     dispatch it on its next pass.
 *   - `reject`: `queued_human_gated → held` — parked, never dispatched. (A UI
 *     "Hold" is a pure client no-op: the row stays `queued_human_gated`.)
 *
 * @task SYN-1075
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { writeDefault } from '@/lib/rate-limit';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { resolveRole } from '@/lib/auth/with-auth';

export const dynamic = 'force-dynamic';

// ── Schema ──────────────────────────────────────────────────────────────────

const releaseSchema = z.object({
  /**
   * Publish-queue item ids to act on. Per-cut (one id) or batch (up to the
   * 8-cut set, capped at 50 defensively).
   */
  itemIds: z
    .array(z.string().min(1, 'itemId must be a non-empty string'))
    .min(1, 'At least one itemId is required')
    .max(50, 'Cannot release more than 50 cuts in one request'),
  action: z.enum(['release', 'reject']).optional().default('release'),
});

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  return writeDefault(request, async () => {
    try {
      // 1. Authenticate → 401.
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }

      // 2. Validate body → 400.
      const body = await request.json().catch(() => null);
      const validation = releaseSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation Error', details: validation.error.issues },
          { status: 400 }
        );
      }
      const { itemIds, action } = validation.data;

      // 3. Resolve org + role, fail-closed → 403.
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          organizationId: true,
          teamMemberships: {
            where: { acceptedAt: { not: null } },
            select: { role: true, organizationId: true },
          },
        },
      });

      if (!user?.organizationId) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'No organisation found' },
          { status: 403 }
        );
      }
      const organizationId = user.organizationId;

      const membership = user.teamMemberships.find(
        m => m.organizationId === organizationId
      );
      const role = resolveRole(membership?.role);
      if (role !== 'owner') {
        // Releasing a cut to a live social account is an owner-only action.
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Only the organisation owner can release publish cuts',
          },
          { status: 403 }
        );
      }

      // 4. Atomically transition — org-scoped, gated-only — and audit, in one
      //    transaction. The `status: 'queued_human_gated'` predicate makes the
      //    claim idempotent and race-safe (only one writer moves each row) and
      //    the `organizationId` predicate makes it impossible to touch another
      //    org's cuts.
      const nextStatus = action === 'reject' ? 'held' : 'pending';

      const { count } = await prisma.$transaction(async tx => {
        const claim = await tx.publishQueueItem.updateMany({
          where: {
            id: { in: itemIds },
            organizationId,
            status: 'queued_human_gated',
          },
          data:
            action === 'reject'
              ? {
                  status: 'held',
                  lastError: 'Rejected at the human release gate',
                }
              : {
                  status: 'pending',
                  // Make it due now so the next queue pass picks it up.
                  scheduledAt: new Date(),
                },
        });

        await tx.auditLog.create({
          data: {
            action:
              action === 'reject'
                ? 'publish_queue_reject'
                : 'publish_queue_release',
            resource: 'publish_queue',
            userId,
            severity: 'medium',
            category: 'data',
            outcome: claim.count > 0 ? 'success' : 'warning',
            details: {
              organizationId,
              requestedItemIds: itemIds,
              requestedCount: itemIds.length,
              affectedCount: claim.count,
              transition: `queued_human_gated -> ${nextStatus}`,
            } as Prisma.InputJsonValue,
          },
        });

        return claim;
      });

      // 5. Nothing matched: either the ids don't exist, belong to another org,
      //    or were already released. Same 404 for all → no cross-org existence
      //    leak.
      if (count === 0) {
        return NextResponse.json(
          {
            error: 'Not Found',
            message:
              'No gated cuts matched — they may already be released, rejected, or belong to another organisation.',
          },
          { status: 404 }
        );
      }

      logger.info('publish-queue/release: cuts actioned', {
        userId,
        organizationId,
        action,
        requested: itemIds.length,
        affected: count,
      });

      return NextResponse.json({
        success: true,
        action,
        released: action === 'release' ? count : 0,
        rejected: action === 'reject' ? count : 0,
        affected: count,
        requested: itemIds.length,
      });
    } catch (error: unknown) {
      logger.error('publish-queue/release: unexpected error', { error });
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  });
}
