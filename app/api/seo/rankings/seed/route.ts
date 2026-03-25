/**
 * POST /api/seo/rankings/seed
 *
 * Manually trigger keyword target seeding from the org's primary GBP location.
 * Useful for existing clients who connected GBP before SYN-487 was deployed.
 *
 * SYN-487
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { seedKeywordsFromGBP } from '@/lib/seo/keyword-seeder';

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

  const result = await seedKeywordsFromGBP(organizationId);

  if (result.reason === 'no_primary_gbp_location') {
    return NextResponse.json(
      {
        error:
          'No primary Google Business Profile location found. Connect GBP first.',
      },
      { status: 422 }
    );
  }

  if (result.reason === 'missing_suburb_or_category') {
    return NextResponse.json(
      {
        error:
          'GBP location is missing suburb or category data. Ensure your GBP profile is complete.',
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    success: true,
    created: result.created,
    skipped: result.skipped,
    message:
      result.created > 0
        ? `Created ${result.created} keyword targets from your Google Business Profile.`
        : 'No new keyword targets needed — you already have targets for these keywords.',
  });
}
