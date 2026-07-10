/**
 * GenerationContext — mandatory actor/tenant context for AI generation (SYN-MCP-003).
 *
 * Every AI generation entry point (content, variations, calendar, image) now
 * takes a GenerationContext so that:
 *   - brand/org context can never be silently dropped (the defect-D regression:
 *     A/B variations lost the 3-layer brand prompt because org/taskType were
 *     undefined on the variations path),
 *   - every generation is attributable (org, user, trace) in the cost ledger,
 *   - cost containment (maxCostUsd preflight) and idempotent replay
 *     (tenant-scoped Redis keys) have a single enforcement surface.
 *
 * SECURITY: contexts must be built SERVER-SIDE from the authenticated user
 * (route org lookup) — never from request-body fields. Request schemas must
 * not accept organizationId/brandId.
 *
 * Internal/cron/system callers that have no authenticated user use
 * systemGenerationContext(). No migrations: the cost ledger reuses the
 * existing PipelineCostLedger model (clientId = organizationId) and the
 * idempotency store is Redis (SETNX-equivalent + 24h TTL), not a table.
 */

import { createHash, randomUUID } from 'crypto';
import { calculatePipelineCost } from '@/lib/pipelines/track-cost';
import { getRedisClient } from '@/lib/redis-client';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How autonomous the actor driving this generation is. */
export type AutonomyLevel = 'manual' | 'assisted' | 'autonomous' | 'system';

/**
 * Target social platform for a piece of generated content. Single source for
 * image-generation's platform option (the provider-as-platform fix: trend
 * lookups take a PLATFORM, never an ImageProvider like 'stability'/'dalle').
 */
export type SupportedPlatform =
  | 'twitter'
  | 'instagram'
  | 'linkedin'
  | 'tiktok'
  | 'facebook'
  | 'youtube';

export const SUPPORTED_PLATFORMS: readonly SupportedPlatform[] = [
  'twitter',
  'instagram',
  'linkedin',
  'tiktok',
  'facebook',
  'youtube',
] as const;

/** Per-request cost containment hints (enforced, not just recorded). */
export interface GenerationBudget {
  /** Hard ceiling for this request's estimated spend, in USD. */
  maxCostUsd?: number;
  /** Client-supplied replay key — deduped per user (Redis, 24h TTL). */
  idempotencyKey?: string;
}

export interface GenerationContext {
  /**
   * Owning organisation. Required — use systemGenerationContext() for
   * internal callers with no tenant (value becomes SYSTEM_ORGANIZATION_ID).
   */
  organizationId: string;
  /** Specific brand within the organisation, when applicable. */
  brandId?: string;
  /** Acting user ('system' for internal/cron callers). */
  userId: string;
  /** Upstream task/job id, when the generation runs inside one. */
  taskId?: string;
  /** Correlates every call + ledger row of one logical run. */
  traceId: string;
  /** Cost containment hints for this request. */
  budget?: GenerationBudget;
  /** How autonomous the actor is. */
  autonomyLevel: AutonomyLevel;
}

// ---------------------------------------------------------------------------
// Construction + runtime guard
// ---------------------------------------------------------------------------

/**
 * Sentinel organisation for platform-internal generations (cron, system
 * pipelines, users without an organisation). Ledger rows for this sentinel
 * are written with clientId = null (the PipelineCostLedger convention for
 * board-level pipelines).
 */
export const SYSTEM_ORGANIZATION_ID = 'system';

export function isSystemOrganization(organizationId: string): boolean {
  return organizationId === SYSTEM_ORGANIZATION_ID;
}

export class GenerationContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationContextError';
  }
}

/**
 * Runtime guard — throws when the context is absent or has no
 * organizationId. Call at every generation entry point.
 */
export function requireGenerationContext(
  ctx: GenerationContext | null | undefined,
  source: string
): GenerationContext {
  if (!ctx || typeof ctx !== 'object') {
    throw new GenerationContextError(
      `${source}: GenerationContext is required — build it server-side from the authenticated user, or use systemGenerationContext() for internal callers.`
    );
  }
  if (!ctx.organizationId) {
    throw new GenerationContextError(
      `${source}: GenerationContext.organizationId is required — use systemGenerationContext() when no organisation applies.`
    );
  }
  return ctx;
}

/**
 * Factory for internal/cron/system callers (and authed users without an
 * organisation). Never build this from request-body input.
 */
export function systemGenerationContext(
  organizationId?: string,
  overrides: Partial<Omit<GenerationContext, 'organizationId'>> = {}
): GenerationContext {
  return {
    organizationId: organizationId || SYSTEM_ORGANIZATION_ID,
    userId: 'system',
    traceId: randomUUID(),
    autonomyLevel: 'system',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Budget preflight (maxCostUsd — enforced BEFORE any LLM call)
// ---------------------------------------------------------------------------

export class GenerationBudgetExceededError extends Error {
  constructor(
    public readonly estimatedCostUsd: number,
    public readonly maxCostUsd: number
  ) {
    super(
      `Estimated generation cost $${estimatedCostUsd.toFixed(4)} exceeds the remaining request budget $${maxCostUsd.toFixed(4)} (maxCostUsd). Reduce the request size or raise maxCostUsd.`
    );
    this.name = 'GenerationBudgetExceededError';
  }
}

/**
 * Rate anchor for preflight estimates. Content generation routes through
 * mixed providers; MODEL_RATES (lib/pipelines/track-cost.ts) is the repo's
 * canonical rate table and Sonnet is its median-priced entry — a deliberately
 * conservative anchor for a pre-spend ceiling check.
 */
const ESTIMATE_MODEL = 'claude-sonnet-4-6';
/** Conservative prompt-side estimate (system + brand context + user prompt). */
const ESTIMATED_INPUT_TOKENS = 1500;
/** generateContent always makes 2 style-variation calls after the main call. */
const VARIATION_CALLS = 2;
/** max_tokens the generator uses per call (see content-generator.callAI). */
const MAIN_MAX_TOKENS_ARTICLE = 3000;
const MAIN_MAX_TOKENS_DEFAULT = 1000;
const VARIATION_MAX_TOKENS = 1000;

/**
 * Estimate the worst-case USD cost of one generateContent request
 * (main call + 2 variation calls, at max_tokens).
 */
export function estimateContentGenerationCostUsd(request: {
  type?: string;
}): number {
  const mainMaxTokens =
    request.type === 'article'
      ? MAIN_MAX_TOKENS_ARTICLE
      : MAIN_MAX_TOKENS_DEFAULT;
  const main = calculatePipelineCost(
    ESTIMATE_MODEL,
    ESTIMATED_INPUT_TOKENS,
    mainMaxTokens
  );
  const variations =
    VARIATION_CALLS *
    calculatePipelineCost(
      ESTIMATE_MODEL,
      ESTIMATED_INPUT_TOKENS,
      VARIATION_MAX_TOKENS
    );
  return parseFloat((main + variations).toFixed(6));
}

/**
 * Enforce a maxCostUsd ceiling BEFORE any LLM call. No-op when the caller
 * supplied no budget; throws GenerationBudgetExceededError when the estimate
 * exceeds it (routes map this to HTTP 402).
 */
export function enforceBudgetPreflight(
  maxCostUsd: number | undefined,
  estimatedCostUsd: number
): void {
  if (typeof maxCostUsd !== 'number') return;
  if (estimatedCostUsd > maxCostUsd) {
    throw new GenerationBudgetExceededError(estimatedCostUsd, maxCostUsd);
  }
}

// ---------------------------------------------------------------------------
// Idempotency (Redis SETNX-equivalent + 24h TTL, tenant-scoped)
// ---------------------------------------------------------------------------

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const PENDING_SENTINEL = '__synthex_idem_pending__';

/**
 * Tenant-scoped key: hashing userId INTO the key means one user can never
 * replay (or read the cached response of) another user's idempotencyKey.
 */
function idempotencyRedisKey(
  scope: string,
  userId: string,
  idempotencyKey: string
): string {
  const digest = createHash('sha256')
    .update(`${userId}:${idempotencyKey}`)
    .digest('hex');
  return `idem:${scope}:${digest}`;
}

export type IdempotencyAcquisition =
  | { state: 'acquired' }
  | { state: 'pending' }
  | { state: 'replayed'; payload: string };

/**
 * Try to claim an idempotency key for this user.
 *  - 'acquired'  → first request; proceed and storeIdempotentResponse() after.
 *  - 'pending'   → an identical request is currently in flight (409).
 *  - 'replayed'  → a completed response exists; return its payload verbatim.
 *
 * The redis-client wrapper exposes no SETNX, so the atomic INCR on a lock key
 * arbitrates the race (only the first caller ever sees 1) — same guarantee.
 */
export async function acquireIdempotencyKey(
  scope: string,
  userId: string,
  idempotencyKey: string
): Promise<IdempotencyAcquisition> {
  const redis = getRedisClient();
  const key = idempotencyRedisKey(scope, userId, idempotencyKey);

  const existing = await redis.get(key);
  if (existing !== null && existing !== PENDING_SENTINEL) {
    return {
      state: 'replayed',
      payload: Buffer.from(String(existing), 'base64').toString('utf8'),
    };
  }
  if (existing === PENDING_SENTINEL) {
    return { state: 'pending' };
  }

  const lockKey = `${key}:lock`;
  const count = await redis.incr(lockKey);
  await redis.expire(lockKey, IDEMPOTENCY_TTL_SECONDS);
  if (count !== 1) {
    return { state: 'pending' };
  }
  await redis.set(key, PENDING_SENTINEL, IDEMPOTENCY_TTL_SECONDS);
  return { state: 'acquired' };
}

/**
 * Store the successful response payload for later replay.
 * Base64-encoded so the Upstash SDK's automatic JSON deserialisation can
 * never mangle the stored envelope.
 */
export async function storeIdempotentResponse(
  scope: string,
  userId: string,
  idempotencyKey: string,
  payload: string
): Promise<void> {
  const redis = getRedisClient();
  await redis.set(
    idempotencyRedisKey(scope, userId, idempotencyKey),
    Buffer.from(payload, 'utf8').toString('base64'),
    IDEMPOTENCY_TTL_SECONDS
  );
}

/**
 * Release a claimed key after a FAILED generation so the client can retry
 * with the same idempotencyKey.
 */
export async function releaseIdempotencyKey(
  scope: string,
  userId: string,
  idempotencyKey: string
): Promise<void> {
  const redis = getRedisClient();
  const key = idempotencyRedisKey(scope, userId, idempotencyKey);
  await redis.del([key, `${key}:lock`]);
}

// ---------------------------------------------------------------------------
// Cost ledger (org-attributed, post-hoc actuals)
// ---------------------------------------------------------------------------

export interface RecordGenerationCostParams {
  /** e.g. 'content-generation', 'calendar-generation', 'marketing-agency-claim' */
  pipelineName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Pre-computed cost; derived from MODEL_RATES when omitted. */
  costUsd?: number;
}

/**
 * Write an org-attributed row to the EXISTING pipeline_cost_ledger
 * (PipelineCostLedger — clientId = ctx.organizationId; null for the system
 * sentinel, matching the model's board-level convention). Goes through
 * Prisma (not the supabase-js util) so it is assertable in the Docker
 * verification sandbox. NEVER throws — a ledger failure must not break
 * generation (mirrors trackPipelineCost's belt-and-suspenders contract).
 */
export async function recordGenerationCost(
  ctx: GenerationContext,
  params: RecordGenerationCostParams
): Promise<void> {
  try {
    const costUsd =
      params.costUsd ??
      calculatePipelineCost(
        params.model,
        params.inputTokens,
        params.outputTokens
      );
    const { default: prisma } = await import('@/lib/prisma');
    await prisma.pipelineCostLedger.create({
      data: {
        pipelineName: params.pipelineName,
        clientId: isSystemOrganization(ctx.organizationId)
          ? null
          : ctx.organizationId,
        runId: ctx.traceId,
        model: params.model,
        inputTokens: Math.max(0, Math.round(params.inputTokens)),
        outputTokens: Math.max(0, Math.round(params.outputTokens)),
        costUsd,
      },
    });
  } catch (error) {
    try {
      logger.warn('generation-context: cost-ledger write failed', {
        pipelineName: params.pipelineName,
        organizationId: ctx.organizationId,
        traceId: ctx.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      // Logging must never throw either.
    }
  }
}
