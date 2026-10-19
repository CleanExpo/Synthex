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
import prisma from '@/lib/prisma';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import {
  GovernorRefusedError,
  type GovernedCallResult,
  type GovernorProvider,
  type GovernorRefusal,
} from '@/lib/ai/governor';

export interface GovernorScope {
  organizationId: string;
  /** The organisation's slug: orgs carry no separate brand slug of their own. */
  brandSlug: string;
}

/** Map an AIProvider.name ("OpenRouter", "Anthropic"...) to what really runs. Ollama is local and ungoverned. */
export function governorProviderFor(
  providerName: string
): GovernorProvider | null {
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
      return null;
  }
}

/** Organisation from the authenticated user (never the request body), plus its brand slug. */
export async function resolveGovernorScope(
  userId: string
): Promise<GovernorScope | null> {
  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) return null;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });
  return { organizationId, brandSlug: org?.slug ?? organizationId };
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

const REFUSAL_STATUS: Partial<Record<GovernorRefusal, number>> = {
  refused_budget_exhausted: 429,
  refused_control_plane_error: 503,
  refused_model_unavailable: 503,
};

/** Honest refusal for an enforcing Governor: a code and a 4xx/503, never a 500. */
export function governorRefusalResponse(
  error: GovernorRefusedError
): NextResponse {
  return NextResponse.json(
    {
      error: 'AI call refused by the spend governor',
      code: error.outcome,
      message: error.reason,
    },
    { status: REFUSAL_STATUS[error.outcome] ?? 403 }
  );
}
