/**
 * GSC Indexing Request API
 *
 * POST /api/seo/search-console/indexing — Request URL crawl or removal
 *
 * @module app/api/seo/search-console/indexing/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { requestIndexing } from '@/lib/google/search-console-oauth';
import { findOAuthConnection } from '@/lib/google/google-auth';
import { logger } from '@/lib/logger';

const IndexingRequestSchema = z.object({
  url: z.string().url('Invalid URL'),
  type: z.enum(['URL_UPDATED', 'URL_DELETED']).default('URL_UPDATED'),
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
    const parsed = IndexingRequestSchema.safeParse(body);

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

    const result = await requestIndexing(parsed.data.url, parsed.data.type, {
      connectionId: connectionId ?? undefined,
      organizationId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Indexing request failed' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      url: parsed.data.url,
      type: parsed.data.type,
      notifyTime: result.notifyTime,
    });
  } catch (error) {
    logger.error('GSC indexing request error:', error);
    return NextResponse.json(
      { error: 'Failed to submit indexing request' },
      { status: 500 }
    );
  }
}
