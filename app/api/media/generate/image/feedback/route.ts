/**
 * AI Image Batch Feedback API
 *
 * @description Records per-image keep/reject/rank verdicts for a generated
 * batch (PATCH) and returns org-scoped aggregate insights over the caller's
 * feedback history (GET).
 *
 * ENVIRONMENT VARIABLES REQUIRED: none beyond the shared Prisma/Supabase
 * config already required by the generate route.
 *
 * FAILURE MODE: Returns structured `{ error, details? }` responses; never
 * throws past the route boundary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withRateLimit } from '@/lib/rate-limit/rate-limiter';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import {
  validateVerdicts,
  aggregateInsights,
  type FeedbackRowLite,
} from '@/lib/services/ai/image-feedback-core';
import { logger } from '@/lib/logger';

// Request validation schema
const FeedbackSchema = z.object({
  batchGroupId: z.string().min(1),
  verdicts: z
    .array(
      z.object({
        generationId: z.string().min(1),
        kept: z.boolean(),
        rank: z.number().int().min(1).max(3).optional(),
      })
    )
    .min(1)
    .max(3),
  noneGoodReason: z.string().max(500).optional(),
});

/**
 * PATCH /api/media/generate/image/feedback
 * Records keep/reject/rank verdicts for a batch. Idempotent whole-batch
 * replace: every call resets rank on the whole batch before re-applying the
 * payload, so re-ranking can never leave two rank-1 rows.
 */
async function _handlePatch(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;

  try {
    const body = await request.json();
    const validated = FeedbackSchema.parse(body);
    const { batchGroupId, verdicts, noneGoodReason } = validated;

    const effectiveOrg = await getEffectiveOrganizationId(userId);

    const rows = await prisma.imageGeneration.findMany({
      where: { batchGroupId },
    });

    if (rows.length === 0) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Batch not found' },
        404
      );
    }

    // Scope rule: owned when row.userId === userId, OR (effectiveOrg !==
    // null AND row.organizationId === effectiveOrg). When effectiveOrg is
    // null, scope by userId ONLY — never match organizationId: null.
    const owned = rows.every(
      row =>
        row.userId === userId ||
        (effectiveOrg !== null && row.organizationId === effectiveOrg)
    );
    if (!owned) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Forbidden' },
        403
      );
    }

    const check = validateVerdicts(
      verdicts,
      rows.map(row => ({ id: row.id, status: row.status }))
    );
    if (!check.ok) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: check.error },
        400
      );
    }

    await prisma.$transaction(async tx => {
      // Idempotent whole-batch replace: clear ranks first so re-ranking can
      // never trip the partial unique index or leave two rank-1 rows.
      await tx.imageGeneration.updateMany({
        where: { batchGroupId },
        data: { rank: null },
      });

      for (const verdict of verdicts) {
        const existingRow = rows.find(row => row.id === verdict.generationId);
        await tx.imageGeneration.update({
          where: { id: verdict.generationId },
          data: {
            kept: verdict.kept,
            rank: verdict.rank ?? null,
            feedbackAt: new Date(),
            ...(noneGoodReason
              ? {
                  metadata: {
                    ...((existingRow?.metadata as object) ?? {}),
                    noneGoodReason,
                  } as Prisma.InputJsonValue,
                }
              : {}),
          },
        });
      }
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      updated: verdicts.length,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.issues },
        400
      );
    }

    logger.error('Image batch feedback error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * GET /api/media/generate/image/feedback
 * Returns aggregate insights over the caller's scoped, completed,
 * feedback-bearing rows.
 */
export async function GET(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;

  try {
    const effectiveOrg = await getEffectiveOrganizationId(userId);

    const rows = await prisma.imageGeneration.findMany({
      where: {
        AND: [
          { feedbackAt: { not: null } },
          { status: 'completed' },
          effectiveOrg !== null
            ? { OR: [{ userId }, { organizationId: effectiveOrg }] }
            : { userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const feedbackRows: FeedbackRowLite[] = rows.map(row => ({
      batchGroupId: row.batchGroupId,
      status: row.status,
      kept: row.kept,
      rank: row.rank,
      grounded: row.grounded,
      style: row.style,
      referenceSet: row.referenceSet,
      provider: row.provider,
    }));

    return APISecurityChecker.createSecureResponse(
      aggregateInsights(feedbackRows)
    );
  } catch (error: unknown) {
    logger.error('Image batch feedback insights error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

// RA-3024 — rate-limited wrapper around the PATCH handler, matching the
// generate route's POST wrapper exactly.
export async function PATCH(request: NextRequest) {
  return withRateLimit(request, async () => _handlePatch(request));
}
