/**
 * GET /api/auth/oauth/available
 *
 * Returns which social platforms are actually connectable right now — i.e. have
 * OAuth app credentials configured (DB or env). The connect UI should gate each
 * platform's "Connect" entrypoint on this so a user can't start an OAuth flow to
 * an app that isn't set up (which otherwise drops them on the provider's
 * "app unavailable" error, or — for a configured-but-unapproved app — a
 * permissions-denied page). The OAuth initiate route already fails closed with a
 * 400 for unconfigured platforms; this endpoint lets the UI avoid showing the
 * broken button in the first place.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getPlatformOAuthCredentials } from '@/lib/platform-credentials';
import { SUPPORTED_PLATFORMS } from '@/lib/social';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'You must be logged in.' },
      { status: 401 }
    );
  }

  const entries = await Promise.all(
    SUPPORTED_PLATFORMS.map(async (platform) => {
      let configured = false;
      try {
        configured = (await getPlatformOAuthCredentials(platform)) !== null;
      } catch {
        configured = false;
      }
      return [platform, { configured }] as const;
    })
  );

  const platforms = Object.fromEntries(entries);
  const available = entries
    .filter(([, v]) => v.configured)
    .map(([slug]) => slug);

  return NextResponse.json({ available, platforms });
}
