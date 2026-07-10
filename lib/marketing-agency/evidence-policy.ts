/**
 * Evidence policy — the SINGLE writer of MarketingAgencyClaim.evidenceStatus
 * (SYN-MCP-001).
 *
 * evidenceStatus is DERIVED-ONLY. No route, runner, or script may assign an
 * evidenceStatus literal; every write must come from this module. Human
 * approval lives on a separate axis (`approvalStatus`, written by the
 * approve/reject verbs) and never implies evidence verification.
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
