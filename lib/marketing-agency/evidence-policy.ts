/**
 * Evidence policy — the SINGLE ORCHESTRATOR of MarketingAgencyClaim
 * .evidenceStatus derivation (SYN-MCP-001, upgraded by SYN-MCP-006 wiring).
 *
 * evidenceStatus is DERIVED-ONLY. No route, runner, or script may assign an
 * evidenceStatus literal; every derivation must come from this module. Human
 * approval lives on a separate axis (`approvalStatus`, written by the
 * approve/reject verbs) and never implies evidence verification.
 *
 * WRITER CHAIN (bench must_fix `single-writer-reconciliation`): this module
 * is the ONLY orchestrator; persistence is DELEGATED to
 * `applyEvidenceVerdict` (lib/evidence/policy.ts), the only evidence-pipeline
 * function that touches the column. The complete writer set is exactly:
 *   1. `evidenceStatusOnApprove` below, via the claims action route
 *      (approve verb, upgrade-only — unchanged by Wave 3);
 *   2. `applyEvidenceVerdict`, invoked only by
 *      `evaluateAndApplyEvidencePolicy` below.
 *
 * SYN-MCP-006 WIRING — `evaluateAndApplyEvidencePolicy`: when a claim has
 * ClaimEvidenceScore rows, the bundle-based policy
 * (lib/evidence/policy.ts, DEFAULT_EVIDENCE_POLICY) decides:
 *   verified → 'verified' · refuted → 'disputed' · insufficient → 'blocked'
 *   · not_required → no write (VERDICT_TO_STATUS, unchanged).
 * With ZERO score rows it falls back to the v1 sourceRef-presence rule below,
 * persisted through the same `applyEvidenceVerdict` writer with a v1-marked
 * bundle.
 *
 * v1 TRUTH TABLE (per-claim derivation):
 *
 *   | sourceRefId | claimType in EVIDENCE_REQUIRED | derived status       |
 *   |-------------|--------------------------------|----------------------|
 *   | present     | (any)                          | 'verified'           |
 *   | absent      | yes                            | 'blocked'            |
 *   | absent      | no                             | 'pending_evidence'   |
 *
 * `SourceRef.requiredForClaims` remains honored at the campaign export gate
 * (`evaluateClaimEvidence` in ./evidence.ts, unchanged) — that gate blocks
 * campaign export when evidence-required claims have no evidence refs. The
 * two layers share the same EVIDENCE_REQUIRED set so badge-level and
 * export-level verdicts cannot drift.
 *
 * GRANDFATHER EXCEPTION (backfill, SYN-MCP-001 migration): legacy rows whose
 * evidenceStatus was already 'verified' before the approval split are NOT
 * re-derived (a source-less legacy row would derive 'blocked'). They carry
 * `metadata.migratedLegacyVerified=true` as the sole provenance marker and
 * are re-scored by the bundle-based policy in SYN-MCP-006.
 */

import type { PrismaClient } from '@prisma/client';
import {
  applyEvidenceVerdict,
  DEFAULT_EVIDENCE_POLICY,
  evaluateEvidencePolicy,
  type EvidencePolicy,
  type EvidenceStatusUpdate,
  type PolicyDecision,
} from '@/lib/evidence/policy';
import {
  domainOf,
  type EvidenceProviderId,
  type EvidenceStance,
  type ScoredSourceEvidence,
} from '@/lib/evidence/types';
import { EVIDENCE_REQUIRED } from './evidence';

/** Statuses this v1 policy can derive. Legacy rows may also hold 'disputed'. */
export type DerivedEvidenceStatus = 'verified' | 'blocked' | 'pending_evidence';

export interface EvidencePolicyInput {
  /** Linked evidence source, if any (MarketingAgencyClaim.sourceRefId). */
  sourceRefId: string | null | undefined;
  /** Free-form claim type (see ClaimType in ./types for the canonical set). */
  claimType: string;
}

/**
 * Derive a claim's evidenceStatus from its evidence linkage (v1).
 * The only function allowed to produce an evidenceStatus value for a write.
 */
export function deriveEvidenceStatus(
  input: EvidencePolicyInput
): DerivedEvidenceStatus {
  if (input.sourceRefId) return 'verified';
  return EVIDENCE_REQUIRED.has(input.claimType)
    ? 'blocked'
    : 'pending_evidence';
}

/**
 * evidenceStatus write for the APPROVE verb — upgrade-only.
 *
 * Approve sets ONLY approvalStatus; evidenceStatus moves iff the policy is
 * satisfied ('verified'). Returning `undefined` means "leave evidenceStatus
 * untouched", which both:
 *   - keeps an unevidenced claim approved-but-unverified (the SYN-1079
 *     headline defect: approve must never confer 'verified' without a source);
 *   - preserves grandfathered legacy 'verified' rows (no downgrade re-derive).
 */
export function evidenceStatusOnApprove(
  input: EvidencePolicyInput
): DerivedEvidenceStatus | undefined {
  const derived = deriveEvidenceStatus(input);
  return derived === 'verified' ? derived : undefined;
}

// ---------------------------------------------------------------------------
// SYN-MCP-006 WIRING — bundle-based evaluator (v1 fallback when no scores)
// ---------------------------------------------------------------------------

/** policyId stamped on bundles produced by the v1 sourceRef-presence fallback. */
export const V1_FALLBACK_POLICY_ID = 'evidence-policy-v1-sourceref';

/** Structural shape of a ClaimEvidenceScore row joined with its SourceRef —
 * kept structural (not Prisma payload types) so tests can pass plain objects. */
export interface ScoreRowWithSourceRef {
  sourceRefId: string;
  stance: string;
  confidence: number;
  scorer: string;
  rationale: string | null;
  scoredAt: Date;
  sourceRef: {
    id: string;
    url: string | null;
    label: string;
    contentHash: string | null;
    retrievedAt: Date | null;
    provider: string | null;
    excerpt: string | null;
  } | null;
}

export interface RehydratedSources {
  sources: ScoredSourceEvidence[];
  /** Human-readable reasons for score rows that could not be rehydrated —
   * appended to the persisted bundle aggregate so exclusions are auditable. */
  skipped: string[];
}

/**
 * Rebuild ScoredSourceEvidence[] from persisted ClaimEvidenceScore rows +
 * joined SourceRef provenance (bench must_fix `bundle-rehydration-contract`).
 *
 * ClaimEvidenceScore rows do not carry SourceEvidence fields, so:
 *   - publishedAt is ALWAYS null (unknown age — the policy's ageSource then
 *     applies any freshness window against retrievedAt, basis 'retrieved');
 *   - domain is derived via domainOf(url) (no domain column exists);
 *   - retrievedAt falls back to the score row's scoredAt when the SourceRef
 *     has no retrieval provenance;
 *   - rows whose SourceRef has a null url are SKIPPED (a source without a URL
 *     can never qualify under the bundle policy) and recorded in `skipped`.
 */
export function rehydrateScoredSources(
  rows: ScoreRowWithSourceRef[]
): RehydratedSources {
  const sources: ScoredSourceEvidence[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const ref = row.sourceRef;
    if (!ref?.url) {
      skipped.push(
        `Score row (scorer '${row.scorer}') for sourceRef '${
          ref?.id ?? row.sourceRefId
        }' skipped: sourceRef has no URL and cannot qualify under the bundle policy.`
      );
      continue;
    }
    const retrievedAt = ref.retrievedAt ?? row.scoredAt;
    sources.push({
      url: ref.url,
      title: ref.label ?? '',
      publishedAt: null,
      retrievedAt: retrievedAt.toISOString(),
      // Display-only field on the bundle record — never used in verdict logic.
      provider: (ref.provider ?? 'firecrawl') as EvidenceProviderId,
      contentHash: ref.contentHash ?? '',
      excerpt: ref.excerpt ?? '',
      domain: domainOf(ref.url),
      stance: row.stance as EvidenceStance,
      confidence: row.confidence,
      scorer: row.scorer,
      rationale: row.rationale ?? undefined,
    });
  }

  return { sources, skipped };
}

export interface EvaluateAndApplyInput {
  organizationId: string;
  claimId: string;
}

export interface EvaluateAndApplyContext {
  /** Defaults to DEFAULT_EVIDENCE_POLICY. */
  policy?: EvidencePolicy;
  /** Clock injection for deterministic tests. */
  now?: Date;
  /** Honesty fields recorded on the bundle aggregate. */
  retrieversAvailable?: EvidenceProviderId[];
  retrieversUsed?: EvidenceProviderId[];
}

export interface EvidenceEvaluationResult {
  outcome: 'bundle' | 'v1_fallback' | 'not_found';
  /** evidenceStatus before this evaluation (null when the claim was not found). */
  previousEvidenceStatus: string | null;
  /** Status actually written by applyEvidenceVerdict (null = column untouched). */
  written: EvidenceStatusUpdate;
  /** The decision persisted (null when the claim was not found). */
  decision: PolicyDecision | null;
}

/**
 * THE evidenceStatus evaluator (SYN-MCP-006 wiring).
 *
 * Org-scoped end to end: the claim lookup, the score-row read, and the
 * delegated write (applyEvidenceVerdict's updateMany) all match on
 * organizationId — a cross-tenant claimId can never be evaluated or flipped.
 *
 * Bundle path (≥1 ClaimEvidenceScore row): rehydrate → evaluateEvidencePolicy
 * → applyEvidenceVerdict. Fallback path (0 rows): v1 sourceRef-presence rule,
 * persisted through the SAME writer with a V1_FALLBACK_POLICY_ID bundle.
 */
export async function evaluateAndApplyEvidencePolicy(
  db: PrismaClient,
  input: EvaluateAndApplyInput,
  context: EvaluateAndApplyContext = {}
): Promise<EvidenceEvaluationResult> {
  const claim = await db.marketingAgencyClaim.findFirst({
    where: { id: input.claimId, organizationId: input.organizationId },
    select: {
      id: true,
      claimType: true,
      sourceRefId: true,
      evidenceStatus: true,
    },
  });
  if (!claim) {
    return {
      outcome: 'not_found',
      previousEvidenceStatus: null,
      written: null,
      decision: null,
    };
  }

  const scoreRows = (await db.claimEvidenceScore.findMany({
    where: { claimId: input.claimId, organizationId: input.organizationId },
    include: { sourceRef: true },
  })) as unknown as ScoreRowWithSourceRef[];

  if (scoreRows.length > 0) {
    // Bundle-based verdict — bundle beats the v1 rule whenever scores exist.
    const { sources, skipped } = rehydrateScoredSources(scoreRows);
    const decision = evaluateEvidencePolicy(
      { id: claim.id, claimType: claim.claimType },
      sources,
      context.policy ?? DEFAULT_EVIDENCE_POLICY,
      {
        now: context.now,
        retrieversAvailable: context.retrieversAvailable,
        retrieversUsed: context.retrieversUsed,
      }
    );
    // Record un-rehydratable rows honestly on the persisted aggregate.
    decision.bundle.aggregate.reasons.push(...skipped);
    const written = await applyEvidenceVerdict(
      db,
      input.organizationId,
      decision
    );
    return {
      outcome: 'bundle',
      previousEvidenceStatus: claim.evidenceStatus,
      written,
      decision,
    };
  }

  // v1 FALLBACK — no scores exist; the sourceRef-presence rule decides,
  // persisted through the same single writer with a v1-marked bundle.
  const derived = deriveEvidenceStatus({
    sourceRefId: claim.sourceRefId,
    claimType: claim.claimType,
  });
  const now = context.now ?? new Date();
  const decision: PolicyDecision = {
    bundle: {
      claimId: claim.id,
      sources: [],
      aggregate: {
        // 'verified' maps 1:1; 'blocked'/'pending_evidence' both stem from an
        // absent source — 'insufficient' is the honest verdict for either.
        verdict: derived === 'verified' ? 'verified' : 'insufficient',
        policyId: V1_FALLBACK_POLICY_ID,
        scoredAt: now.toISOString(),
        sourceAgeBasis: [],
        retrieversAvailable: context.retrieversAvailable ?? [],
        retrieversUsed: context.retrieversUsed ?? [],
        reasons: [
          `v1 sourceRef-presence rule (no ClaimEvidenceScore rows): sourceRef ${
            claim.sourceRefId ? 'present' : 'absent'
          }, claimType '${claim.claimType}' → '${derived}'.`,
        ],
      },
    },
    evidenceStatus: derived,
  };
  const written = await applyEvidenceVerdict(
    db,
    input.organizationId,
    decision
  );
  return {
    outcome: 'v1_fallback',
    previousEvidenceStatus: claim.evidenceStatus,
    written,
    decision,
  };
}
