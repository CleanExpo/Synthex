/**
 * Shared plumbing for routes that wrap a paid text generation in the AI
 * Governor (P5 / M10, spec "one spend gate").
 *
 * The governedCall itself stays in each route file: the J9 detector reads the
 * route source, and the route is where the call happens. What lives here is
 * what every such route needs around it: which provider pays, which brand the
 * receipt is for, the pre-spend estimate, the generator's real model and
 * usage, the credential to call with, and the honest refusal response.
 */

import { NextResponse } from 'next/server';
import { resolvePlatformProviderName } from '@/lib/ai/providers';
import type {
  GeneratedContent,
  UserProviderCredentials,
} from '@/lib/ai/content-generator';
import {
  GOVERNOR_PROVIDERS,
  GovernorRefusedError,
  type GovernedCallResult,
  type GovernorProvider,
  type ProviderCallResult,
  type ResolvedCallContext,
} from '@/lib/ai/governor';

/**
 * The provider a generation is billed to: the user's own key's provider when
 * they have one, else the platform provider getAIProvider() would use.
 */
export function generationProvider(
  credentials?: UserProviderCredentials | null
): GovernorProvider {
  const name = credentials?.provider ?? resolvePlatformProviderName();
  return (GOVERNOR_PROVIDERS as readonly string[]).includes(name)
    ? (name as GovernorProvider)
    : 'openai';
}

/** Prompt-side tokens per provider call (system + brand context + prompt). */
const INPUT_TOKENS_PER_CALL = 1500;
/** generateContent makes the main call plus two style-variation calls. */
const CALLS_PER_GENERATION = 3;

/**
 * Pre-spend token estimate for one AIContentGenerator.generateContent: every
 * call at its max_tokens (3000 for an article main call, else 1000) — the
 * same worst case estimateContentGenerationCostUsd prices.
 */
export function generationEstimate(type?: string): {
  inputTokens: number;
  outputTokens: number;
} {
  return {
    inputTokens: INPUT_TOKENS_PER_CALL * CALLS_PER_GENERATION,
    outputTokens: (type === 'article' ? 3000 : 1000) + 2 * 1000,
  };
}

/** A finished generation as the Governor's receipt needs it. */
export function generatorCallResult(
  generated: GeneratedContent
): ProviderCallResult<GeneratedContent> {
  const usage = generated.metadata?.usage;
  return {
    data: generated,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    modelId: generated.metadata?.model,
  };
}

/**
 * The credential to call with: the brand key the Governor resolved, or —
 * when it resolved none (shadow mode before BYOK passes) — the caller's own.
 */
export function governorCredentials(
  ctx: ResolvedCallContext,
  fallback?: UserProviderCredentials | null
): UserProviderCredentials | undefined {
  if (ctx.apiKey) return { apiKey: ctx.apiKey, provider: ctx.provider };
  return fallback ?? undefined;
}

/**
 * Unwrap a route's governedCall result: the data when served, the route's
 * own provider error when the provider threw (so existing error handling is
 * unchanged), and GovernorRefusedError when an enforcing Governor refused.
 */
export function governedData<T>(
  result: GovernedCallResult<T>,
  providerError: { error: unknown } | undefined
): T {
  if (result.ok) return result.data;
  if (providerError) throw providerError.error;
  throw new GovernorRefusedError(result.outcome, result.reason);
}

/** The honest HTTP answer to an enforcing refusal: 403 with the outcome code. */
export function governorRefusalResponse(
  error: GovernorRefusedError
): NextResponse {
  return NextResponse.json(
    {
      error: 'AI call refused by the spend governor',
      code: error.outcome,
      message: error.reason,
    },
    { status: 403 }
  );
}
