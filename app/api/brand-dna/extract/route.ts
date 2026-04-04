/**
 * POST /api/brand-dna/extract
 *
 * Instant preview path (≤3s): fetches business name + generates first post.
 * Full pipeline runs in background and persists to BrandDNA model.
 *
 * Body: { url: string }
 * Returns: { preview: BrandDNAPreview, status: 'extracting' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { generateInstantPostPreview } from '@/lib/brand-dna/post-preview';
import { extractAndPersistBrandDNA } from '@/lib/brand-dna/extractor';
import { analyzeWebsite } from '@/lib/ai/website-analyzer';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const ExtractSchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No active organisation' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = ExtractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { url } = parsed.data;

  // --- Instant preview path (≤3s) ---
  let businessName = 'your business';
  let industry = 'business';
  let heroCopy = '';

  try {
    const partial = await analyzeWebsite({ url, businessName: '' });
    // Cast to any to access fields that may be present in mocks or future extensions
    const partialAny = partial as Record<string, unknown> | null;
    businessName =
      (partialAny?.['businessName'] as string) ||
      partial?.description?.split(' ')[0] ||
      businessName;
    industry = partial?.industry || industry;
    heroCopy = (partialAny?.['heroCopy'] as string) || '';
  } catch (err) {
    logger.error(
      '[brand-dna/extract] Partial scrape failed, using defaults',
      err
    );
  }

  const firstPost = await generateInstantPostPreview({
    businessName,
    industry,
    heroCopy,
  });

  // --- Fire full extraction in background (don't await) ---
  extractAndPersistBrandDNA(url, businessName, orgId).catch(err => {
    logger.error(
      '[brand-dna/extract] Background extraction failed',
      err instanceof Error ? err : undefined
    );
  });

  return NextResponse.json({
    preview: { businessName, industry, firstPost },
    status: 'extracting',
  });
}
