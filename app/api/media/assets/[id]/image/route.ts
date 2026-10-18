/**
 * Media Asset Image Serving API
 *
 * @description Serve a stored `media_assets.base64_data` row as a binary
 * image response. Batch generation responses carry no base64 (Vercel 4.5MB
 * response cap), so base64-provider variants render via this path instead.
 *
 * NOT_PROVISIONED: prisma/schema.prisma has no media_assets model, so after
 * auth and id validation this answers 501 rather than a 404 that would claim
 * the asset does not exist.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';
import { notProvisionedBody } from '@/lib/api/not-provisioned';

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

  try {
    const { id } = await params;

    // Validate ID format
    if (!z.string().uuid().safeParse(id).success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid asset id' },
        400
      );
    }

    return APISecurityChecker.createSecureResponse(
      notProvisionedBody('media_assets', 'Media asset serving'),
      501
    );
  } catch (error: unknown) {
    logger.error('Media asset image serving error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}
