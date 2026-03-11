/**
 * PR Journalist CRM — Public Newsroom Endpoint (Phase 92)
 *
 * GET /api/pr/press-releases/[orgSlug]/[slug] — Public newsroom endpoint (no auth)
 *
 * Returns the press release content + JSON-LD structured data.
 * Only published releases are returned (404 for draft/archived).
 * No authentication required — this is a public endpoint for AI crawler indexing.
 *
 * @module app/api/pr/press-releases/[orgSlug]/[slug]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { buildPressRelease } from '@/lib/pr/press-release-builder';

// ─── Route params type ─────────────────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ orgSlug: string; slug: string }>;
}

// ─── GET /api/pr/press-releases/[orgSlug]/[slug] ──────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { orgSlug, slug } = await params;

    // Find the organisation by slug
    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { slug: orgSlug },
          { domain: orgSlug },
        ],
      },
      select: {
        id:   true,
        name: true,
        slug: true,
        website: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    // Find the published press release
    const release = await prisma.pressRelease.findFirst({
      where: {
        orgId:  org.id,
        slug,
        status: 'published',
      },
    });

    if (!release) {
      return NextResponse.json({ error: 'Press release not found' }, { status: 404 });
    }

    // Build JSON-LD structured data
    const { jsonLd } = buildPressRelease(
      {
        headline:      release.headline,
        body:          release.body,
        subheading:    release.subheading ?? undefined,
        datePublished: release.datePublished?.toISOString(),
        location:      release.location ?? undefined,
        keywords:      release.keywords,
        imageUrl:      release.imageUrl ?? undefined,
        category:      release.category as 'funding' | 'product' | 'partnership' | 'award' | 'other' | undefined,
        contactName:   release.contactName ?? undefined,
        contactEmail:  release.contactEmail ?? undefined,
        contactPhone:  release.contactPhone ?? undefined,
        boilerplate:   release.boilerplate ?? undefined,
      },
      org.name,
      org.website ?? undefined
    );

    return NextResponse.json({ release, jsonLd });
  } catch (error) {
    console.error('[PR press-releases/[orgSlug]/[slug] GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
