/**
 * Evidence policy gate (SYN-MCP-006).
 *
 * SELF-CONTAINED (bench must_fix `define-evidence-policy-locally`):
 * SYN-MCP-001 is NOT merged, so EvidencePolicy is DEFINED here — 001 later
 * imports FROM this module, never vice versa.
 *
 * `evaluateEvidencePolicy` is a PURE function: (claim, scored sources,
 * policy) → EvidenceBundle + the evidenceStatus it maps to. The ONLY place
 * `MarketingAgencyClaim.evidenceStatus` may be written from the evidence
 * pipeline is `applyEvidenceVerdict()` below — Wave 3 wires callers through
 * it, so "evidenceStatus written ONLY in policy.ts" holds by construction.
 *
 * Age handling (per SYN-1083): `publishedAt: null` is UNKNOWN age — the
 * policy then applies `maxSourceAgeDays` against `retrievedAt` and records
 * `ageBasis: 'retrieved'` in the bundle (honestly auditable, must_fix
 * `bundle-honesty-fields`).
 *
 * Domain diversity uses normalized hostnames (strip `www.`, lower-case) —
 * NOT eTLD+1 (that needs a public-suffix dep; none allowed). Documented
 * limitation: subdomains of one registrable domain count as distinct.
 */

import type { PrismaClient } from '@prisma/client';
import {
  domainOf,
  type EvidenceBundle,
  type EvidenceProviderId,
  type EvidenceVerdict,
  type ScoredSourceEvidence,
  type SourceAgeBasis,
} from './types';

// ---------------------------------------------------------------------------
// Policy definition
// ---------------------------------------------------------------------------

export interface EvidencePolicy {
  /** Recorded on every bundle as aggregate.policyId. */
  id: string;
  /** Minimum qualifying supporting sources (distinct domains when
   * requireDomainDiversity). */
  minSources: number;
  /** Minimum scorer confidence for a source to qualify (0..1). */
  minSupportConfidence: number;
  /** Optional freshness window in days. Unset = no age limit. */
  maxSourceAgeDays?: number;
  /** When true, qualifying sources are counted per distinct domain. */
  requireDomainDiversity: boolean;
  /** Claim types that REQUIRE evidence verification. Other types → 'not_required'. */
  requiredForClaimTypes: string[];
}

/**
 * Default policy v1. `requiredForClaimTypes` mirrors the existing export
 * gate's EVIDENCE_REQUIRED set (lib/marketing-agency/evidence.ts).
 */
export const DEFAULT_EVIDENCE_POLICY: EvidencePolicy = {
  id: 'evidence-policy-v1',
  minSources: 2,
  minSupportConfidence: 0.7,
  requireDomainDiversity: true,
  requiredForClaimTypes: ['factual', 'outcome', 'comparative', 'testimonial'],
};

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** evidenceStatus values on MarketingAgencyClaim (see claims action route):
 * 'verified' | 'blocked' | 'disputed'. null = leave the claim unchanged. */
export type EvidenceStatusUpdate = 'verified' | 'blocked' | 'disputed' | null;

export interface PolicyEvaluationContext {
  /** Honesty fields for the bundle — which retrievers COULD have run vs DID run. */
  retrieversAvailable?: EvidenceProviderId[];
  retrieversUsed?: EvidenceProviderId[];
  /** Clock injection for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
}

export interface PolicyDecision {
  bundle: EvidenceBundle;
  /** The claim update this verdict maps to (null = no change). */
  evidenceStatus: EvidenceStatusUpdate;
}

const VERDICT_TO_STATUS: Record<EvidenceVerdict, EvidenceStatusUpdate> = {
  verified: 'verified',
  refuted: 'disputed',
  insufficient: 'blocked',
  not_required: null,
};

interface AgedSource {
  source: ScoredSourceEvidence;
  basis: SourceAgeBasis;
  fresh: boolean;
}

function ageSource(
  source: ScoredSourceEvidence,
  policy: EvidencePolicy,
  now: Date
): AgedSource {
  const basis: SourceAgeBasis =
    source.publishedAt !== null ? 'published' : 'retrieved';
  if (policy.maxSourceAgeDays === undefined) {
    return { source, basis, fresh: true };
  }
  const anchor =
    basis === 'published' ? source.publishedAt! : source.retrievedAt;
  const anchorMs = Date.parse(anchor);
  if (Number.isNaN(anchorMs)) {
    // Fail closed: an unparseable timestamp never qualifies as fresh.
    return { source, basis, fresh: false };
  }
  const maxAgeMs = policy.maxSourceAgeDays * 86_400_000;
  return { source, basis, fresh: now.getTime() - anchorMs <= maxAgeMs };
}

/**
 * PURE policy evaluation — no I/O, no clock reads beyond the injectable `now`.
 */
export function evaluateEvidencePolicy(
  claim: { id: string; claimType: string },
  sources: ScoredSourceEvidence[],
  policy: EvidencePolicy = DEFAULT_EVIDENCE_POLICY,
  context: PolicyEvaluationContext = {}
): PolicyDecision {
  const now = context.now ?? new Date();
  const reasons: string[] = [];

  const aged = sources.map(s => ageSource(s, policy, now));
  const sourceAgeBasis = aged.map(a => ({
    url: a.source.url,
    basis: a.basis,
  }));

  const buildBundle = (verdict: EvidenceVerdict): PolicyDecision => ({
    bundle: {
      claimId: claim.id,
      sources,
      aggregate: {
        verdict,
        policyId: policy.id,
        scoredAt: now.toISOString(),
        sourceAgeBasis,
        retrieversAvailable: context.retrieversAvailable ?? [],
        retrieversUsed: context.retrieversUsed ?? [],
        reasons,
      },
    },
    evidenceStatus: VERDICT_TO_STATUS[verdict],
  });

  // 1. Claim types outside the policy's scope need no evidence verification.
  if (!policy.requiredForClaimTypes.includes(claim.claimType)) {
    reasons.push(
      `Claim type '${claim.claimType}' does not require evidence verification under policy '${policy.id}'.`
    );
    return buildBundle('not_required');
  }

  // 2. A confident, fresh refutation blocks immediately.
  const refuting = aged.filter(
    a =>
      a.fresh &&
      a.source.stance === 'refutes' &&
      a.source.confidence >= policy.minSupportConfidence
  );
  if (refuting.length > 0) {
    reasons.push(
      `Refuted by ${refuting.length} source(s): ${refuting
        .map(a => a.source.url)
        .join(', ')}`
    );
    return buildBundle('refuted');
  }

  // 3. Count qualifying support.
  const qualifying = aged.filter(
    a =>
      a.fresh &&
      a.source.stance === 'supports' &&
      a.source.confidence >= policy.minSupportConfidence
  );

  const staleSupport = aged.filter(
    a =>
      !a.fresh &&
      a.source.stance === 'supports' &&
      a.source.confidence >= policy.minSupportConfidence
  );
  if (staleSupport.length > 0) {
    reasons.push(
      `${staleSupport.length} supporting source(s) exceeded maxSourceAgeDays=${policy.maxSourceAgeDays} and were excluded.`
    );
  }

  const effectiveCount = policy.requireDomainDiversity
    ? new Set(qualifying.map(a => a.source.domain || domainOf(a.source.url)))
        .size
    : qualifying.length;

  if (effectiveCount >= policy.minSources) {
    return buildBundle('verified');
  }

  reasons.push(
    policy.requireDomainDiversity
      ? `Insufficient evidence: ${effectiveCount} qualifying distinct domain(s) of ${policy.minSources} required (confidence >= ${policy.minSupportConfidence}).`
      : `Insufficient evidence: ${effectiveCount} qualifying source(s) of ${policy.minSources} required (confidence >= ${policy.minSupportConfidence}).`
  );
  return buildBundle('insufficient');
}

// ---------------------------------------------------------------------------
// Persistence — the ONLY evidenceStatus writer in the evidence pipeline
// ---------------------------------------------------------------------------

/**
 * Apply a policy decision to the claim row. Org-scoped: the update matches on
 * BOTH id and organizationId, so a cross-tenant claimId can never be flipped.
 *
 * Returns the status written, or null when the decision required no change
 * ('not_required') or the claim was not found in the org.
 *
 * `db` is injected — the sandbox integration profile passes its own client;
 * Wave 3 passes the runtime client. This module never imports the Supabase-
 * tuned singleton.
 */
export async function applyEvidenceVerdict(
  db: PrismaClient,
  organizationId: string,
  decision: PolicyDecision
): Promise<EvidenceStatusUpdate> {
  if (decision.evidenceStatus === null) return null;

  const result = await db.marketingAgencyClaim.updateMany({
    where: { id: decision.bundle.claimId, organizationId },
    data: {
      evidenceStatus: decision.evidenceStatus,
      evidenceNotes: JSON.stringify(decision.bundle.aggregate),
    },
  });

  return result.count > 0 ? decision.evidenceStatus : null;
}
