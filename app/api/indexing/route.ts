/**
 * Google Indexing API Route
 *
 * Submit URLs to Google for instant crawling via the Indexing API.
 * Requires service account credentials and Search Console ownership.
 *
 * POST /api/indexing — submit URL(s) for indexing
 * POST /api/indexing?action=batch — submit all public URLs
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { submitUrl, submitBatch, getSynthexPublicUrls } from '@/lib/google/indexing';

const SubmitSchema = z.object({
  url: z.string().url().optional(),
  urls: z.array(z.string().url()).optional(),
  type: z.enum(['URL_UPDATED', 'URL_DELETED']).optional().default('URL_UPDATED'),
});

export async function POST(request: NextRequest) {
  // Admin-only endpoint
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE);
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const action = request.nextUrl.searchParams.get('action');

    // Batch submit all public URLs
    if (action === 'batch') {
      const urls = getSynthexPublicUrls();
      const results = await submitBatch(urls);
      const succeeded = results.filter((r) => r.success).length;
      return APISecurityChecker.createSecureResponse({
        success: true,
        message: `Submitted ${succeeded}/${urls.length} URLs`,
        results,
      });
    }

    // Single/multiple URL submission
    const body = await request.json();
    const validation = SubmitSchema.safeParse(body);
    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { success: false, error: 'Invalid request', details: validation.error.errors },
        400
      );
    }

    const { url, urls, type } = validation.data;

    if (urls && urls.length > 0) {
      const results = await submitBatch(urls, type);
      return APISecurityChecker.createSecureResponse({ success: true, results });
    }

    if (url) {
      const result = await submitUrl(url, type);
      return APISecurityChecker.createSecureResponse({ success: result.success, result });
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Provide either "url" or "urls" in the request body' },
      400
    );
  } catch (error) {
    console.error('Indexing API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to submit URL for indexing' },
      500
    );
  }
}
