import type { CampaignClaim, GateResult } from './types';

/**
 * Claim types that MUST carry evidence.
 *
 * SYN-MCP-001: exported so lib/marketing-agency/evidence-policy.ts (the
 * per-claim evidenceStatus derivation) shares the exact same set as this
 * campaign export gate — the two verdicts must never drift.
 */
export const EVIDENCE_REQUIRED = new Set([
  'factual',
  'outcome',
  'comparative',
  'testimonial',
]);

export function evaluateClaimEvidence(claims: CampaignClaim[]): GateResult {
  const blockedReasons = claims
    .filter(
      claim =>
        EVIDENCE_REQUIRED.has(claim.type) && claim.evidenceRefs.length === 0
    )
    .map(claim => `Claim ${claim.id} requires evidence before export.`);

  return {
    status: blockedReasons.length > 0 ? 'blocked' : 'pass',
    blockedReasons,
    warnings: [],
  };
}
