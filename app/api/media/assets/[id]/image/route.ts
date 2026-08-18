/**
 * Media Asset Image Serving API
 *
 * @description Serve a stored `media_assets.base64_data` row as a binary
 * image response. Batch generation responses carry no base64 (Vercel 4.5MB
 * response cap), so base64-provider variants render via this path instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/platform/noop-client';

let _platform: any = null;
function getSupabase() {
  if (!_platform) {
    _platform = createClient();
  }
  return _platform;
}

/**
 * GET /api/media/assets/[id]/image
 * Serve a media asset's base64_data as a binary image response.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;

  try {
    const { id } = await params;

    // Validate ID format
    if (!z.string().uuid().safeParse(id).success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid asset id' },
        400
      );
    }

    const { data: row, error } = await getSupabase()
      .from('media_assets')
      .select('user_id, base64_data, type')
      .eq('id', id)
      .single();

    // Ownership + shape check: missing row, null base64_data, non-image type,
    // and wrong owner all collapse to an identical 404 to avoid leaking
    // whether a resource exists for a given ID (media_assets is user-scoped
    // today, #433 ledger).
    if (
      error ||
      !row ||
      !row.base64_data ||
      row.type !== 'image' ||
      row.user_id !== userId
    ) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Not found' },
        404
      );
    }

    return new NextResponse(Buffer.from(row.base64_data, 'base64'), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error: unknown) {
    logger.error('Media asset image serving error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}
