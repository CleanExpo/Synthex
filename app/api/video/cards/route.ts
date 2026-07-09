/**
 * GET /api/video/cards — the card registry + model tiers for the studio UI,
 * copilot, and MCP list_cards. Brand cards resolve per the caller's org.
 */
import { NextRequest } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { METHOD_CARDS } from '@/lib/services/ai/video/cards/method-cards';
import {
  VIRAL_METHOD_CARDS,
  VIRAL_SAFE_ZONE,
} from '@/lib/services/ai/video/cards/viral-method-cards';
import { MODIFIER_CHIPS } from '@/lib/services/ai/video/cards/modifier-chips';
import { getBrandFragment } from '@/lib/services/ai/video/cards/brand-cards';
import { VIDEO_MODELS } from '@/lib/services/ai/video/registry';
import { quotaSnapshot } from '@/lib/services/ai/video/quota';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed || !security.context.userId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'unauthorized' },
      401
    );
  }
  const organizationId = await getEffectiveOrganizationId(
    security.context.userId
  );
  const brandFragment = organizationId
    ? await getBrandFragment(organizationId)
    : null;

  return APISecurityChecker.createSecureResponse({
    methodCards: METHOD_CARDS,
    viralCards: VIRAL_METHOD_CARDS,
    viralSafeZone: VIRAL_SAFE_ZONE,
    modifierChips: MODIFIER_CHIPS,
    brandCard: brandFragment
      ? { organizationId, fragment: brandFragment }
      : null,
    models: VIDEO_MODELS,
    quota: organizationId ? await quotaSnapshot(organizationId) : null,
  });
}
