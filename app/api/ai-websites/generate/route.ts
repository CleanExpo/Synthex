/**
 * AI-Websites — generate a site section from a connected GBP location.
 *
 * POST — resolves the caller's Google Business Profile connection, fetches the
 * location, and runs the Phase 3 pipeline (fetch → industry-starter gap-fill →
 * validator-gated LLM copy → validated, schema-marked site). Returns the
 * generated `html`, `jsonLd`, and `validations` — no DB write, no deploy; this
 * is the reachable composition root over `lib/site-generator`.
 *
 * The generator business logic is covered by the site-generator unit suite; the
 * live GBP fetch + LLM call are exercised here against the caller's real
 * connection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { findOAuthConnection } from '@/lib/google/google-auth';
import { getLocationDetails, getReviews } from '@/lib/google/business-profile';
import {
  createGbpProfileFetcher,
  createLlmCopyWriter,
  generateSiteFromGbp,
  type SiteBrand,
} from '@/lib/site-generator';
import { logger } from '@/lib/logger';

const GenerateSchema = z.object({
  /** GBP location resource name, e.g. 'accounts/{id}/locations/{id}'. */
  locationId: z.string().min(1),
  /** Optional hero service slug (defaults to the profile's first service). */
  serviceSlug: z.string().min(1).optional(),
});

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'brand'
  );
}

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const connectionId = await findOAuthConnection(
    organizationId,
    'googlebusiness'
  );
  if (!connectionId) {
    return NextResponse.json(
      {
        error:
          'No Google Business Profile connection found. Please connect first.',
      },
      { status: 400 }
    );
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, website: true },
  });
  if (!organization) {
    return NextResponse.json(
      { error: 'Organisation not found' },
      { status: 404 }
    );
  }

  try {
    const brand: SiteBrand = {
      slug: slugify(organization.name),
      displayName: organization.name,
      forbiddenWords: [],
    };

    const fetcher = createGbpProfileFetcher(
      { getLocationDetails, getReviews },
      connectionId,
      organization.website ? { fallbackUrl: organization.website } : {}
    );
    const copywriter = createLlmCopyWriter();

    const { profile, result } = await generateSiteFromGbp(
      fetcher,
      copywriter,
      parsed.data.locationId,
      brand,
      { serviceSlug: parsed.data.serviceSlug }
    );

    return NextResponse.json({
      success: true,
      ok: result.ok,
      slug: result.slug,
      canonicalUrl: result.canonicalUrl,
      html: result.html,
      jsonLd: result.jsonLd,
      copy: result.copy,
      validations: result.validations,
      profile: {
        name: profile.name,
        servicesCount: profile.services.length,
        hasReviews: Boolean(profile.reviews?.length),
      },
    });
  } catch (error) {
    logger.error('ai-websites generate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate site' },
      { status: 500 }
    );
  }
}
