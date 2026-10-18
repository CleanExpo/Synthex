/**
 * Facebook Posting API (legacy direct route)
 *
 * @description Legacy per-platform Facebook publishing and post history.
 *
 * NOT PROVISIONED: this route recorded every publish in the `social_posts`
 * table and metered it in `usage_tracking`. Neither table exists in
 * prisma/schema.prisma, so publishing here would leave no record. Both
 * methods answer 501 FEATURE_NOT_PROVISIONED after auth instead of
 * publishing without a receipt or returning an empty history.
 *
 * Use /api/social/post — it publishes with organisation-scoped connections,
 * campaign authority gates and PlatformPost receipts.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { writeDefault } from '@/lib/rate-limit';

const NOT_PROVISIONED_REASON =
  'Direct Facebook post history is not provisioned: the social_posts and usage_tracking tables do not exist. Use /api/social/post to publish.';

function notProvisioned() {
  return NextResponse.json(
    {
      error: 'FEATURE_NOT_PROVISIONED',
      message: NOT_PROVISIONED_REASON,
      available: false,
      reason: NOT_PROVISIONED_REASON,
    },
    { status: 501 }
  );
}

/**
 * POST /api/social/facebook/post
 * Create a new Facebook post
 */
export async function POST(request: NextRequest) {
  return writeDefault(request, async () => {
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS !== 'true') {
      return NextResponse.json(
        {
          error: 'Direct Facebook publishing route disabled',
          message:
            'Use /api/social/post so Synthex can enforce organization-scoped page ownership, campaign authority gates, and platform receipts.',
        },
        { status: 409 }
      );
    }

    return notProvisioned();
  });
}

/**
 * GET /api/social/facebook/post
 * Get user's Facebook posts
 */
export async function GET(request: NextRequest) {
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

  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  return notProvisioned();
}
