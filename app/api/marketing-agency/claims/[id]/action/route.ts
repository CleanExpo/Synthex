/**
 * Marketing Agency Claim — Approve / Reject action (SYN-977).
 *
 *   POST /api/marketing-agency/claims/[id]/action
 *   Body: { action: 'approve' | 'reject', comment?: string }
 *
 * Mutates `MarketingAgencyClaim.evidenceStatus`:
 *   - approve → 'verified'
 *   - reject  → 'disputed' (comment required)
 *
 * Appends a review-log entry to the claim's `metadata.reviewLog` so the
 * audit trail survives even when humans approve via voice (the MCP
 * transport tools call this endpoint).
 *
 * Always org-scoped via withAuth — returns 404 if the claim doesn't
 * belong to the caller's organization.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth/with-auth';
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
}

interface ClaimMetadataShape {
  reviewLog?: ClaimMetadataReviewEntry[];
  [key: string]: unknown;
}

export const POST = withAuth(async (request, { userId, clientId }) => {
  const id = extractClaimId(request);
  if (!id) return NextResponse.json({ error: 'Invalid claim id' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  // Reject requires a non-whitespace comment (CodeRabbit finding —
  // `!comment` alone allowed values like "   " through).
  const trimmedComment = parsed.data.comment?.trim();
  if (parsed.data.action === 'reject' && !trimmedComment) {
    return NextResponse.json(
      { error: 'A comment is required when rejecting a claim' },
      { status: 400 },
    );
  }

  const existing = await prisma.marketingAgencyClaim.findFirst({
    where: { id, organizationId: clientId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }

  const newStatus = parsed.data.action === 'approve' ? 'verified' : 'disputed';
  const reviewEntry: ClaimMetadataReviewEntry = {
    action: parsed.data.action,
    reviewedBy: userId,
    reviewedAt: new Date().toISOString(),
    comment: trimmedComment,
    previousEvidenceStatus: existing.evidenceStatus,
  };

  const currentMetadata = (existing.metadata ?? {}) as ClaimMetadataShape;
  const reviewLog = Array.isArray(currentMetadata.reviewLog)
    ? [...currentMetadata.reviewLog, reviewEntry]
    : [reviewEntry];

  try {
    const updated = await prisma.marketingAgencyClaim.update({
      where: { id },
      data: {
        evidenceStatus: newStatus,
        metadata: { ...currentMetadata, reviewLog } as unknown as Prisma.InputJsonValue,
      },
    });
    logger.info('marketing-agency:claim-action', {
      claimId: id,
      action: parsed.data.action,
      previousStatus: existing.evidenceStatus,
      newStatus,
      reviewedBy: userId,
    });
    return NextResponse.json({
      claim: {
        id: updated.id,
        evidenceStatus: updated.evidenceStatus,
        statement: updated.statement,
      },
      action: parsed.data.action,
    });
  } catch (error) {
    logger.error('marketing-agency:claim-action failed', {
      claimId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update claim' }, { status: 500 });
  }
});

function extractClaimId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('claims');
  if (idx === -1) return null;
  return segments[idx + 1] ?? null;
}
