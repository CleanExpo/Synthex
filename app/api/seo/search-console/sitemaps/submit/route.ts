/**
 * GSC Sitemap Submit API
 *
 * POST /api/seo/search-console/sitemaps/submit — Submit a sitemap URL
 *
 * @module app/api/seo/search-console/sitemaps/submit/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { submitSitemap } from '@/lib/google/search-console-oauth';
import { findOAuthConnection } from '@/lib/google/google-auth';
import { logger } from '@/lib/logger';

const SubmitSitemapSchema = z.object({
  siteUrl: z.string().min(1, 'Site URL is required'),
  sitemapUrl: z.string().url('Invalid sitemap URL'),
});

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

  try {
    const body = await request.json();
    const parsed = SubmitSitemapSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const connectionId = await findOAuthConnection(
      organizationId,
      'searchconsole'
    );

    await submitSitemap(parsed.data.siteUrl, parsed.data.sitemapUrl, {
      connectionId: connectionId ?? undefined,
      organizationId,
    });

    return NextResponse.json({
      success: true,
      message: `Sitemap ${parsed.data.sitemapUrl} submitted successfully`,
    });
  } catch (error) {
    logger.error('GSC sitemap submit error:', error);
    return NextResponse.json(
      { error: 'Failed to submit sitemap' },
      { status: 500 }
    );
  }
}
