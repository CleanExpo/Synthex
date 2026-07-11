/**
 * Media Asset Image Serving API
 *
 * @description Serve a stored `media_assets.base64_data` row as a binary
 * image response. Batch generation responses carry no base64 (Vercel 4.5MB
 * response cap), so base64-provider variants render via this path instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';

let _supabase: any = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
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

    const { data: row, error } = await getSupabase()
      .from('media_assets')
      .select('user_id, base64_data, type')
      .eq('id', id)
      .single();

    if (error || !row || !row.base64_data) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Not found' },
        404
      );
    }

    // media_assets is user-scoped today (#433 ledger)
    if (row.user_id !== userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Forbidden' },
        403
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
