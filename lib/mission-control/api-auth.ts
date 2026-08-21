/**
 * Shared auth + org scope for Mission Control API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
  type SecurityPolicy,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';

export async function requireMissionOrg(
  request: NextRequest,
  policy: SecurityPolicy = DEFAULT_POLICIES.AUTHENTICATED_READ
): Promise<
  | { ok: true; userId: string; organizationId: string }
  | { ok: false; response: NextResponse }
> {
  const security = await APISecurityChecker.check(request, policy);
  if (!security.allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: security.error }, { status: 401 }),
    };
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No organisation found' },
        { status: 400 }
      ),
    };
  }

  return { ok: true, userId, organizationId };
}
