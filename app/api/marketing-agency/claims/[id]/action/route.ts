/**
 * Marketing Agency Claim — Approve / Reject action (SYN-977, SYN-MCP-001).
 *
 *   POST /api/marketing-agency/claims/[id]/action
 *   Body: { action: 'approve' | 'reject', comment?: string }
 *
 * SYN-MCP-001: human approval is a SEPARATE axis from evidence verification.
 * The verbs mutate `MarketingAgencyClaim.approvalStatus` ONLY:
 *   - approve → approvalStatus='approved' (+ approvedById/approvedAt)
 *   - reject  → approvalStatus='rejected' (comment required; clears
 *               approvedById/approvedAt)
 *
 * `evidenceStatus` is DERIVED-ONLY (lib/marketing-agency/evidence-policy.ts):
 * on approve it moves iff the policy is satisfied (sourceRef present →
 * 'verified'); otherwise it is untouched — approving an unevidenced claim
 * yields approved-but-unverified, never 'verified'. Reject never touches
 * evidenceStatus (the pre-SYN-MCP-001 route wrote 'disputed'; that legacy
 * value is backfilled to approvalStatus='rejected' by the SYN-MCP-001
 * migration).
 *
 * Both verbs are OWNER-gated (403 for collaborators) — approval must cost
 * privilege, not nothing.
 *
 * Appends a review-log entry to the claim's `metadata.reviewLog` so the
 * audit trail survives even when humans approve via voice (the MCP
 * transport tools call this endpoint). The response keeps `evidenceStatus`
 * (MCP back-compat) and ADDS `approvalStatus`.
 *
 * Always org-scoped: the mutation itself is an atomic
 * `updateMany({ where: { id, organizationId } })` (no TOCTOU between the
 * metadata read and the write's org check) — returns 404 if the claim
 * doesn't belong to the caller's organization.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth/with-auth';
import { evidenceStatusOnApprove } from '@/lib/marketing-agency/evidence-policy';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().max(2000).optional(),
});

interface ClaimMetadataReviewEntry {
  action: 'approve' | 'reject';
  reviewedBy: string;
  reviewedAt: string;
  comment?: string;
  previousEvidenceStatus: string;
  previousApprovalStatus: string;
}

interface ClaimMetadataShape {
  reviewLog?: ClaimMetadataReviewEntry[];
  [key: string]: unknown;
}

export const POST = withAuth(async (request, { userId, clientId, role }) => {
  const id = extractClaimId(request);
  if (!id)
    return NextResponse.json({ error: 'Invalid claim id' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  // Reject requires a non-whitespace comment (CodeRabbit finding —
  // `!comment` alone allowed values like "   " through).
  const trimmedComment = parsed.data.comment?.trim();
  if (parsed.data.action === 'reject' && !trimmedComment) {
    return NextResponse.json(
      { error: 'A comment is required when rejecting a claim' },
      { status: 400 }
    );
  }

  // SYN-MCP-001: approve/reject are owner-only. withAuth resolves role
  // fail-closed (unknown → collaborator), so this can only pass for a
  // genuine owner.
  if (role !== 'owner') {
    return NextResponse.json(
      { error: 'Only the organization owner can approve or reject claims' },
      { status: 403 }
    );
  }

  const existing = await prisma.marketingAgencyClaim.findFirst({
    where: { id, organizationId: clientId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }

  const reviewEntry: ClaimMetadataReviewEntry = {
    action: parsed.data.action,
    reviewedBy: userId,
    reviewedAt: new Date().toISOString(),
    comment: trimmedComment,
    previousEvidenceStatus: existing.evidenceStatus,
    previousApprovalStatus: existing.approvalStatus,
  };

  const currentMetadata = (existing.metadata ?? {}) as ClaimMetadataShape;
  const reviewLog = Array.isArray(currentMetadata.reviewLog)
    ? [...currentMetadata.reviewLog, reviewEntry]
    : [reviewEntry];

  const metadata = {
    ...currentMetadata,
    reviewLog,
  } as unknown as Prisma.InputJsonValue;

  // The verbs write ONLY the approval axis. evidenceStatus is derived-only:
  // on approve the policy may upgrade it to 'verified' (sourceRef present);
  // `undefined` leaves the column untouched. Reject never touches it.
  const data: Prisma.MarketingAgencyClaimUpdateManyMutationInput =
    parsed.data.action === 'approve'
      ? {
          approvalStatus: 'approved',
          approvedById: userId,
          approvedAt: new Date(),
          evidenceStatus: evidenceStatusOnApprove({
            sourceRefId: existing.sourceRefId,
            claimType: existing.claimType,
          }),
          metadata,
        }
      : {
          approvalStatus: 'rejected',
          approvedById: null,
          approvedAt: null,
          metadata,
        };

  try {
    // Atomic org-scoped mutation (SYN-MCP-001): id + organizationId in ONE
    // where clause — no TOCTOU window between the findFirst above (metadata
    // read) and this write.
    const result = await prisma.marketingAgencyClaim.updateMany({
      where: { id, organizationId: clientId },
      data,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const updated = await prisma.marketingAgencyClaim.findFirst({
      where: { id, organizationId: clientId },
      select: {
        id: true,
        approvalStatus: true,
        evidenceStatus: true,
        statement: true,
      },
    });

    logger.info('marketing-agency:claim-action', {
      claimId: id,
      action: parsed.data.action,
      previousApprovalStatus: existing.approvalStatus,
      newApprovalStatus: updated?.approvalStatus,
      previousEvidenceStatus: existing.evidenceStatus,
      newEvidenceStatus: updated?.evidenceStatus,
      reviewedBy: userId,
    });
    return NextResponse.json({
      claim: {
        id,
        approvalStatus: updated?.approvalStatus,
        evidenceStatus: updated?.evidenceStatus,
        statement: updated?.statement ?? existing.statement,
      },
      action: parsed.data.action,
    });
  } catch (error) {
    logger.error('marketing-agency:claim-action failed', {
      claimId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to update claim' },
      { status: 500 }
    );
  }
});

function extractClaimId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('claims');
  if (idx === -1) return null;
  return segments[idx + 1] ?? null;
}
