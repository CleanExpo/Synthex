/**
 * POST /api/brand-dna/refresh
 * Triggers a full re-extraction from the stored sourceUrl.
 * Returns 202 Accepted immediately; extraction runs in background.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { extractAndPersistBrandDNA } from '@/lib/brand-dna/extractor';
import { logger } from '@/lib/logger';

// ── Validation ───────────────────────────────────────────────────────────────

const refreshBodySchema = z.object({
  force: z.boolean().optional(),
}).strict().optional();

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) return unauthorizedResponse();

  // Validate optional body (reject unexpected fields)
  const rawBody = await req.json().catch(() => ({}));
  const parsed = refreshBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No active organisation' },
      { status: 403 }
    );
  }

  const existing = await prisma.brandDNA.findUnique({
    where: { organizationId: orgId },
    select: { sourceUrl: true, businessName: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: 'No Brand DNA found — run /extract first' },
      { status: 404 }
    );
  }

  extractAndPersistBrandDNA(
    existing.sourceUrl,
    existing.businessName,
    orgId
  ).catch(err => {
    logger.error(
      '[brand-dna/refresh] Background re-extraction failed',
      err instanceof Error ? err : undefined
    );
  });

  return NextResponse.json(
    { status: 'refreshing', message: 'Re-extraction started' },
    { status: 202 }
  );
}
