/**
 * verify-claim job (SYN-MCP-006 wiring, Wave 3).
 *
 * Job type `evidence:verify-claim` — for ONE claimId:
 *   retrieve (retriever registry) → entailment score → ClaimEvidenceScore
 *   upserts → re-run the policy evaluator → append an audit entry to the
 *   claim's metadata.reviewLog.
 *
 * Follows the queue-handler patterns of lib/ai/calendar-job-handler.ts and
 * lib/marketing-agency/agent/queue-handler.ts (once-flag registration,
 * maxAttempts: 1 enqueue helper).
 *
 * SECURITY (bench must_fix `org-from-auth`): VerifyClaimJobData
 * `{claimId, organizationId, userId}` comes ONLY from a withAuth context +
 * org-scoped claim lookup at the enqueue site (the verify route / the
 * rescore script's trusted DB read) — NEVER from a request body. Every query
 * in the handler re-scopes by jobData.organizationId; the evidenceStatus
 * write itself is delegated to `evaluateAndApplyEvidencePolicy` →
 * `applyEvidenceVerdict` (org-scoped updateMany). This handler NEVER writes
 * evidenceStatus — its only claim write is the metadata reviewLog append.
 *
 * DI (bench must_fix `handler-di`): the handler core `runVerifyClaim`
 * accepts injected `{db, retrievers, scorer, now}` so the sandbox
 * integration profile runs it with mocks and zero HTTP. The thin registered
 * wrapper binds runtime deps (runtime prisma via lazy import — the
 * Supabase-tuned singleton must never load in the sandbox profile —
 * getAvailableRetrievers(), createLlmEntailmentScorer()).
 *
 * Naturally idempotent: re-running the same claimId converges — SourceRef
 * rows are matched on (organizationId, campaignId, url), scores go through
 * the (claimId, sourceRefId, scorer) upsert, and evidenceStatus is derived.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import {
  enqueue,
  registerHandler,
  JobTypes,
  type Job,
  type JobOptions,
} from '@/lib/queue';
import { logger } from '@/lib/logger';
import { evaluateAndApplyEvidencePolicy } from '@/lib/marketing-agency/evidence-policy';
import {
  createLlmEntailmentScorer,
  upsertClaimEvidenceScore,
  MAX_SCORED_SOURCES_PER_CLAIM,
  type EntailmentScorer,
} from './entailment';
import { getAvailableRetrievers, type EvidenceRetriever } from './retriever';
import type {
  EvidenceProviderId,
  ScoredSourceEvidence,
  SourceEvidence,
} from './types';

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export interface VerifyClaimJobData {
  claimId: string;
  /** From the enqueuing withAuth context ONLY — never from a request body. */
  organizationId: string;
  /** Enqueuing user — createdById provenance for SourceRefs the job creates. */
  userId: string;
}

export interface VerifyClaimDeps {
  db: PrismaClient;
  retrievers: EvidenceRetriever[];
  scorer: EntailmentScorer;
  /** Clock injection for deterministic tests. */
  now?: () => Date;
}

export interface VerifyClaimResult {
  status: 'completed' | 'claim_not_found';
  claimId: string;
  previousEvidenceStatus?: string;
  evidenceStatus?: string;
  verdict?: string;
  sourcesRetrieved?: number;
  scoresPersisted?: number;
}

/** reviewLog action for entries this job appends (bench must_fix
 * `reviewlog-additive-shape`): ADDITIVE alongside 'approve' | 'reject' —
 * consumers must not assume the approve|reject union. */
export const EVIDENCE_VERIFICATION_REVIEW_ACTION = 'evidence-verification';

// ---------------------------------------------------------------------------
// Handler core (DI — sandbox-provable with zero HTTP)
// ---------------------------------------------------------------------------

interface SourceRefScope {
  organizationId: string;
  campaignId: string;
  createdById: string;
}

/**
 * Find-or-create the SourceRef row for one retrieved source (bench must_fix
 * `retrieved-source-persistence`): freshly searched SourceEvidence has no
 * sourceRefId, but ClaimEvidenceScore requires the FK. Matched on
 * organizationId + url within the claim's campaign; provenance fields
 * (contentHash/retrievedAt/provider/excerpt) refreshed on every run.
 */
async function ensureSourceRef(
  db: PrismaClient,
  scope: SourceRefScope,
  source: ScoredSourceEvidence
): Promise<string> {
  const provenance = {
    contentHash: source.contentHash,
    retrievedAt: new Date(source.retrievedAt),
    provider: source.provider,
    excerpt: source.excerpt,
  };
  const existing = await db.marketingAgencySourceRef.findFirst({
    where: {
      organizationId: scope.organizationId,
      campaignId: scope.campaignId,
      url: source.url,
    },
    select: { id: true },
  });
  if (existing) {
    await db.marketingAgencySourceRef.update({
      where: { id: existing.id },
      data: provenance,
    });
    return existing.id;
  }
  const created = await db.marketingAgencySourceRef.create({
    data: {
      organizationId: scope.organizationId,
      createdById: scope.createdById,
      campaignId: scope.campaignId,
      label: source.title || source.url,
      url: source.url,
      sourceType: 'web',
      ...provenance,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * The verify-claim pipeline for one claim. NEVER writes evidenceStatus —
 * that write happens only inside `evaluateAndApplyEvidencePolicy` →
 * `applyEvidenceVerdict`.
 */
export async function runVerifyClaim(
  deps: VerifyClaimDeps,
  data: VerifyClaimJobData,
  jobId: string
): Promise<VerifyClaimResult> {
  const { db } = deps;
  const nowFn = deps.now ?? (() => new Date());
  const { claimId, organizationId, userId } = data;

  // Org-scoped lookup — a cross-tenant claimId is dropped, never processed.
  const claim = await db.marketingAgencyClaim.findFirst({
    where: { id: claimId, organizationId },
    include: { sourceRef: { select: { url: true } } },
  });
  if (!claim) {
    logger.warn('[evidence:verify-claim] claim not found in org — dropped', {
      jobId,
      claimId,
    });
    return { status: 'claim_not_found', claimId };
  }
  const previousEvidenceStatus = claim.evidenceStatus;

  // 1. RETRIEVE — search every injected retriever that can search, plus a
  //    fetch of the linked sourceRef URL when present.
  const collected: SourceEvidence[] = [];
  const retrieversUsed: EvidenceProviderId[] = [];
  for (const retriever of deps.retrievers) {
    if (!retriever.capabilities.canSearch) continue;
    try {
      const results = await retriever.search(claim.statement, {
        limit: MAX_SCORED_SOURCES_PER_CLAIM,
      });
      if (results.length > 0 && !retrieversUsed.includes(retriever.id)) {
        retrieversUsed.push(retriever.id);
      }
      collected.push(...results);
    } catch (err) {
      logger.warn('[evidence:verify-claim] retriever search failed', {
        jobId,
        retriever: retriever.id,
        error: String(err),
      });
    }
  }
  if (claim.sourceRef?.url) {
    const fetcher = deps.retrievers.find(r => r.capabilities.canFetch);
    if (fetcher) {
      try {
        const fetched = await fetcher.fetch(claim.sourceRef.url);
        if (fetched) {
          if (!retrieversUsed.includes(fetcher.id)) {
            retrieversUsed.push(fetcher.id);
          }
          collected.push(fetched);
        }
      } catch (err) {
        logger.warn('[evidence:verify-claim] sourceRef fetch failed', {
          jobId,
          url: claim.sourceRef.url,
          error: String(err),
        });
      }
    }
  }

  // Dedupe by URL — a search hit may duplicate the linked source.
  const seen = new Set<string>();
  const sources = collected.filter(s =>
    seen.has(s.url) ? false : (seen.add(s.url), true)
  );

  // 2. SCORE (entailment; scorer applies its own per-claim source cap).
  const scored =
    sources.length > 0
      ? await deps.scorer.scoreSources({
          orgId: organizationId,
          claimId,
          claimStatement: claim.statement,
          sources,
        })
      : [];

  // 3. PERSIST — SourceRef find-or-create, then idempotent score upserts.
  let scoresPersisted = 0;
  for (const source of scored) {
    const sourceRefId = await ensureSourceRef(
      db,
      { organizationId, campaignId: claim.campaignId, createdById: userId },
      source
    );
    await upsertClaimEvidenceScore(db, {
      organizationId,
      claimId,
      sourceRefId,
      stance: source.stance,
      confidence: source.confidence,
      scorer: source.scorer,
      rationale: source.rationale ?? null,
    });
    scoresPersisted++;
  }

  // 4. POLICY — the single orchestrator/writer chain decides evidenceStatus.
  const evaluation = await evaluateAndApplyEvidencePolicy(
    db,
    { organizationId, claimId },
    {
      now: nowFn(),
      retrieversAvailable: deps.retrievers
        .filter(r => r.available())
        .map(r => r.id),
      retrieversUsed,
    }
  );
  const newEvidenceStatus = evaluation.written ?? previousEvidenceStatus;

  // 5. AUDIT — additive reviewLog entry (metadata-only write; evidenceStatus
  //    is never touched here).
  const fresh = await db.marketingAgencyClaim.findFirst({
    where: { id: claimId, organizationId },
    select: { metadata: true },
  });
  const currentMetadata = (fresh?.metadata ?? {}) as {
    reviewLog?: unknown[];
    [key: string]: unknown;
  };
  const entry = {
    action: EVIDENCE_VERIFICATION_REVIEW_ACTION,
    jobId,
    reviewedAt: nowFn().toISOString(),
    previousEvidenceStatus,
    newEvidenceStatus,
    verdict: evaluation.decision?.bundle.aggregate.verdict ?? null,
    policyId: evaluation.decision?.bundle.aggregate.policyId ?? null,
    scoredAt: evaluation.decision?.bundle.aggregate.scoredAt ?? null,
  };
  const reviewLog = Array.isArray(currentMetadata.reviewLog)
    ? [...currentMetadata.reviewLog, entry]
    : [entry];
  await db.marketingAgencyClaim.updateMany({
    where: { id: claimId, organizationId },
    data: {
      metadata: {
        ...currentMetadata,
        reviewLog,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info('[evidence:verify-claim] transition logged', {
    jobId,
    claimId,
    previousEvidenceStatus,
    newEvidenceStatus,
    verdict: entry.verdict,
  });

  return {
    status: 'completed',
    claimId,
    previousEvidenceStatus,
    evidenceStatus: newEvidenceStatus,
    verdict: entry.verdict ?? undefined,
    sourcesRetrieved: sources.length,
    scoresPersisted,
  };
}

// ---------------------------------------------------------------------------
// Queue wiring (enqueue helper + once-flag handler registration)
// ---------------------------------------------------------------------------

/**
 * Enqueue a verify-claim run. Returns the job record immediately; the run
 * happens on a worker. maxAttempts: 1 — the pipeline is upsert-idempotent
 * but LLM scoring is expensive; the caller re-submits deliberately.
 */
export async function queueVerifyClaim(
  data: VerifyClaimJobData,
  options?: JobOptions
): Promise<Job<VerifyClaimJobData>> {
  return enqueue(JobTypes.EVIDENCE_VERIFY_CLAIM, data, {
    maxAttempts: 1,
    ...options,
  });
}

let handlerRegistered = false;

/**
 * Register the EVIDENCE_VERIFY_CLAIM handler exactly once. Idempotent —
 * safe to call from multiple entry points (same pattern as
 * registerCalendarGenerationHandler / registerMarketingAgentHandler).
 */
export function registerVerifyClaimHandler(): void {
  if (handlerRegistered) return;
  handlerRegistered = true;

  registerHandler<VerifyClaimJobData>(
    JobTypes.EVIDENCE_VERIFY_CLAIM,
    async job => {
      // Runtime deps resolved lazily per run: the Supabase-tuned prisma
      // singleton must not load at module scope (the sandbox integration
      // profile imports this module with its own injected client), and the
      // available retriever set depends on env at run time.
      const { default: prisma } = await import('@/lib/prisma');
      const result = await runVerifyClaim(
        {
          db: prisma,
          retrievers: getAvailableRetrievers(),
          scorer: createLlmEntailmentScorer(),
        },
        job.data,
        job.id
      );
      logger.info('[evidence:verify-claim] handler completed', {
        jobId: job.id,
        claimId: job.data.claimId,
        status: result.status,
        evidenceStatus: result.evidenceStatus,
      });
      return result;
    }
  );
}
