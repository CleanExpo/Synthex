/**
 * Route-side glue for the AI Governor (P5, spec M10 "one spend gate").
 *
 * Routes call `governedCall` themselves (mode: GOVERNOR_MODE) so the spend gate
 * is visible at the call site. This module holds only what every such route
 * would otherwise copy: who the organisation is, which GovernorProvider a
 * route's provider really is, how an enforcing refusal is shown to the caller,
 * and how a governed result is turned back into the route's own data or error.
 */

import { NextResponse } from 'next/server';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import {
  GovernorRefusedError,
  type GovernedCallResult,
  type GovernorProvider,
} from '@/lib/ai/governor';
import {
  governorRefusalStatus,
  resolveOrgBrandSlug,
} from '@/lib/ai/governor-route-support';

export interface GovernorScope {
  organizationId: string;
  /** The organisation's brand, from resolveOrgBrandSlug. */
  brandSlug: string;
}

/** Map an AIProvider.name ("OpenRouter", "Anthropic"...) to what really runs. Every provider is governed; an unknown one fails closed. */
export function governorProviderFor(providerName: string): GovernorProvider {
  switch (providerName.toLowerCase()) {
    case 'openrouter':
      return 'openrouter';
    case 'anthropic':
      return 'anthropic';
    case 'openai':
      return 'openai';
    case 'google':
      return 'google';
    default:
      throw new Error(
        `Unknown AI provider "${providerName}": no Governor provider to bill it to`
      );
  }
}

/** Organisation from the authenticated user (never the request body), plus its brand slug. */
export async function resolveGovernorScope(
  userId: string
): Promise<GovernorScope | null> {
  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) return null;
  return {
    organizationId,
    brandSlug: await resolveOrgBrandSlug(organizationId),
  };
}

/** Rough token count for a pre-spend estimate (about four characters a token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Data on success; the provider's own error if it threw; GovernorRefusedError otherwise. */
export function unwrapGoverned<T>(
  result: GovernedCallResult<T>,
  providerError: { error: unknown } | null
): T {
  if (result.ok) return result.data;
  if (providerError) throw providerError.error;
  throw new GovernorRefusedError(result.outcome, result.reason);
}

/**
 * Honest refusal for an enforcing Governor: a code and a 4xx/503, never a 500.
 * The status comes from the same table as governor-route-support, so a budget
 * or build-cap refusal is a 429 here too (it fell through to 403 before).
 */
export function governorRefusalResponse(
  error: GovernorRefusedError
): NextResponse {
  return NextResponse.json(
    {
      error: 'AI call refused by the spend governor',
      code: error.outcome,
      message: error.reason,
    },
    { status: governorRefusalStatus(error.outcome) }
  );
}
