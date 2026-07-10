/**
 * Marketing Agency Claim — evidence verification trigger (SYN-MCP-006 wiring).
 *
 *   POST /api/marketing-agency/claims/[id]/verify
 *   → 202 { success, jobId, status } — enqueues an `evidence:verify-claim`
 *     job (lib/evidence/verify-claim-job.ts) for the claim.
 *
 * This route NEVER sets evidenceStatus. The status is derived asynchronously
 * by the job via evaluateAndApplyEvidencePolicy → applyEvidenceVerdict (the
 * single evidence-pipeline writer). Auth mirrors the sibling action route:
 *   - withAuth (401 unauthenticated / 403 no org),
 *   - owner-only (403 for collaborators) — triggering paid retrieval + LLM
 *     scoring must cost privilege,
 *   - org-scoped findFirst → 404 for a cross-tenant claimId.
 *
 * SECURITY (bench must_fix `org-from-auth`): the job data
 * {claimId, organizationId, userId} is built ONLY from the withAuth context
 * and the org-scoped lookup — nothing is read from the request body.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import {
  queueVerifyClaim,
  registerVerifyClaimHandler,
} from '@/lib/evidence/verify-claim-job';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export const POST = withAuth(async (request, { userId, clientId, role }) => {
  const id = extractClaimId(request);
  if (!id) {
    return NextResponse.json({ error: 'Invalid claim id' }, { status: 400 });
  }

  // Owner-only (mirror of the action route's gate): withAuth resolves role
  // fail-closed (unknown → collaborator), so this only passes for an owner.
  if (role !== 'owner') {
    return NextResponse.json(
      { error: 'Only the organization owner can trigger claim verification' },
      { status: 403 }
    );
  }

  // Org-scoped existence check — 404 for a claim outside the caller's org.
  const claim = await prisma.marketingAgencyClaim.findFirst({
    where: { id, organizationId: clientId },
    select: { id: true },
  });
  if (!claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }

  try {
    registerVerifyClaimHandler();
    const job = await queueVerifyClaim({
      claimId: id,
      organizationId: clientId,
      userId,
    });

    logger.info('marketing-agency:claim-verify enqueued', {
      claimId: id,
      jobId: job.id,
      requestedBy: userId,
    });

    return NextResponse.json(
      { success: true, jobId: job.id, status: job.status },
      { status: 202 }
    );
  } catch (error) {
    logger.error('marketing-agency:claim-verify enqueue failed', {
      claimId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to enqueue claim verification' },
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
