/**
 * GBP Insights API
 *
 * GET — Performance insights for a location (from snapshots + live API)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { notObserved } from '@/lib/ree/evidence-state';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
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

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');

  if (!locationId) {
    return NextResponse.json(
      { error: 'Missing locationId parameter' },
      { status: 400 }
    );
  }

  try {
    // Verify org scoping
    const location = await prisma.gBPLocation.findFirst({
      where: { id: locationId, organizationId },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...notObserved(
        'PARTIAL',
        'gbp-snapshots',
        'Historical performance withheld: snapshot grain and provenance unresolved'
      ),
      data: null,
    });
  } catch (error) {
    logger.error('GBP insights error:', error);
    return NextResponse.json(
      {
        ...notObserved('UNAVAILABLE', 'gbp-snapshots', 'Insights unavailable'),
        data: null,
      },
      { status: 500 }
    );
  }
}
