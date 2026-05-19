import type { CampaignClaim, GateResult } from './types';

const EVIDENCE_REQUIRED = new Set(['factual', 'outcome', 'comparative', 'testimonial']);

export function evaluateClaimEvidence(claims: CampaignClaim[]): GateResult {
  const blockedReasons = claims
    .filter((claim) => EVIDENCE_REQUIRED.has(claim.type) && claim.evidenceRefs.length === 0)
    .map((claim) => `Claim ${claim.id} requires evidence before export.`);

  return {
    status: blockedReasons.length > 0 ? 'blocked' : 'pass',
    blockedReasons,
    warnings: [],
  };
}
