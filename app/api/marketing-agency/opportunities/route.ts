/**
 * Marketing Agency - Governed Opportunities API
 *
 * GET /api/marketing-agency/opportunities
 * Returns persisted, organisation-scoped governed opportunities.
 *
 * @module app/api/marketing-agency/opportunities/route
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { logger } from '@/lib/logger';
import { listMarketingAgencyOpportunities } from '@/lib/marketing-agency/intelligence/opportunity-reader';

export const runtime = 'nodejs';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      401,
      security.context
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid query parameters' },
      400,
      security.context
    );
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'No organisation found' },
      400,
      security.context
    );
  }

  try {
    const opportunities = await listMarketingAgencyOpportunities({
      organizationId,
      limit: parsed.data.limit,
    });

    return APISecurityChecker.createSecureResponse(
      {
        organizationId,
        opportunities,
        total: opportunities.length,
      },
      200,
      security.context
    );
  } catch (error) {
    logger.error('marketing-agency opportunities read failed', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to load governed opportunities' },
      500,
      security.context
    );
  }
}
