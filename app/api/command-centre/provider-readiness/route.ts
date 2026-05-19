/**
 * Command Centre — Provider Readiness API
 *
 * GET /api/command-centre/provider-readiness
 * Returns provider modes without exposing credential values.
 *
 * @module app/api/command-centre/provider-readiness/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { getCommandCentreProviderReadiness } from '@/lib/unite-command-center';

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

  return NextResponse.json({
    organizationId,
    providers: getCommandCentreProviderReadiness(process.env),
  });
}
