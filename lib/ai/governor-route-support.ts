/**
 * Shared glue for routes that run their paid text call through the Governor
 * (P5, spec M10). The route keeps its own `governedCall(...)` so the call site
 * stays greppable; this file holds only what every such route repeats.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  GovernorRefusedError,
  type GovernedCallResult,
  type GovernorRefusal,
  type ProviderCallResult,
  type ResolvedCallContext,
} from '@/lib/ai/governor';

/**
 * The one organisation -> brand rule every governed call uses (RunnerFlag
 * kill-switches and budgets key on it): HermesConfig.brandSlug when the org
 * runs HERMES, otherwise the organisation's own slug (no other per-org brand
 * field exists), otherwise the id. Always the org's server-side record, never
 * input. A read error propagates: a guessed brand would dodge its kill-switch.
 */
export async function resolveOrgBrandSlug(
  organizationId: string
): Promise<string> {
  const hermes = await prisma.hermesConfig.findUnique({
    where: { organizationId },
    select: { brandSlug: true },
  });
  if (hermes?.brandSlug) return hermes.brandSlug;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });
  return org?.slug ?? organizationId;
}

/** Pre-spend estimate: ~4 characters per token in, the route's max_tokens out. */
export function estimateTextTokens(
  promptChars: number,
  maxTokens: number
): { inputTokens: number; outputTokens: number } {
  return { inputTokens: Math.ceil(promptChars / 4), outputTokens: maxTokens };
}

const REFUSAL_STATUS: Partial<Record<GovernorRefusal, number>> = {
  refused_budget_exhausted: 429,
  refused_budget_unconfigured: 429,
  refused_budget_invalid_estimate: 429,
  refused_budget_untrusted_input: 429,
  refused_build_cap_exceeded: 429,
  refused_byok_missing: 402,
  refused_byok_revoked: 402,
  refused_byok_inactive: 402,
  refused_byok_undecryptable: 402,
  refused_flag_missing: 403,
  refused_flag_disabled: 403,
  refused_kill_switch: 403,
  refused_model_unavailable: 503,
  refused_control_plane_error: 503,
};

/**
 * The HTTP status for a Governor refusal. The one table both response
 * builders use (this module and lib/ai/route-governance.ts), so a refusal
 * answers the same status from every route: a spend ceiling is a 429, a
 * missing brand key a 402, a closed flag a 403.
 */
export function governorRefusalStatus(outcome: GovernorRefusal): number {
  return REFUSAL_STATUS[outcome] ?? 403;
}

/**
 * An enforcing-mode refusal as an honest HTTP response (never a 500). Returns
 * null for any other error so the caller's own handling stays unchanged. Only
 * reachable once GOVERNOR_MODE is 'enforcing'.
 */
export function governorRefusalResponse(error: unknown): NextResponse | null {
  if (!(error instanceof GovernorRefusedError)) return null;
  return NextResponse.json(
    { error: 'AI call refused by spend governor', code: error.outcome },
    { status: governorRefusalStatus(error.outcome) }
  );
}

/**
 * Wrap a route's provider call for `governedCall`. The Governor turns a
 * provider error into a receipt plus a failed result; `unwrap` rethrows that
 * original error (so the route's own handling is unchanged) or, for a refusal,
 * throws GovernorRefusedError. Mirrors governedRouteCall, but leaves the
 * `governedCall(...)` call in the route.
 */
export function governedRouteResult<T>(
  execute: (ctx: ResolvedCallContext) => Promise<ProviderCallResult<T>>
): {
  execute: (ctx: ResolvedCallContext) => Promise<ProviderCallResult<T>>;
  unwrap: (result: GovernedCallResult<T>) => T;
} {
  let providerError: { error: unknown } | null = null;
  return {
    execute: async ctx => {
      try {
        return await execute(ctx);
      } catch (error) {
        providerError = { error };
        throw error;
      }
    },
    unwrap: result => {
      if (result.ok) return result.data;
      if (providerError) throw (providerError as { error: unknown }).error;
      throw new GovernorRefusedError(result.outcome, result.reason);
    },
  };
}
