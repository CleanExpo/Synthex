export const CAMPAIGN_AUTHORITY_MANIFEST_KEY = 'campaignAuthorityManifest';

export type CampaignManifestClaimStatus =
  | 'allowed'
  | 'approved'
  | 'verified'
  | 'needs_evidence'
  | 'restricted'
  | 'blocked'
  | 'unsupported'
  | 'rejected';

export interface CampaignManifestSource {
  id: string;
  label: string;
  url?: string;
  path?: string;
  sourceType?: string;
  role?: 'supporting' | 'opposing' | 'expert' | 'consumer_objection';
  checkedAt?: string;
}

export interface CampaignManifestClaim {
  id: string;
  statement: string;
  status: CampaignManifestClaimStatus;
  evidenceRefs?: string[];
  requiresEvidence?: boolean;
  humanApprovalRequired?: boolean;
  notes?: string;
}

export interface CampaignManifestAsset {
  id: string;
  title: string;
  origin: string;
  rightsStatus: string;
  publishable: boolean;
  licenceUrl?: string;
  attributionRequired?: boolean;
}

export interface CampaignManifestPlatformOutput {
  platform: string;
  status: 'draft' | 'reviewed' | 'approved' | 'ready' | 'blocked';
  contentRef?: string;
  notes?: string;
}

/**
 * Approval state for a campaign manifest.
 *
 * `humanApproved` is OPTIONAL and absent by default. Only a human-initiated
 * approval path (see `approveCampaignAuthorityManifest`) may set it. Generators
 * must emit `{ status: 'pending_review' }` and nothing else — a generator that
 * writes `humanApproved`, `approvedBy` or `approvedAt` is recording an approval
 * no human gave. See Gruen Standard v1.1 hard fail `hf-approval`.
 */
export interface CampaignManifestApproval {
  status:
    | 'draft'
    | 'pending_review'
    | 'review'
    | 'approved'
    | 'blocked'
    /**
     * A human authored and scheduled this, and nothing in it requires evidence.
     * DISTINCT from 'approved', which means a human reviewed the content against
     * its evidence. Conflating the two is what SYN-1157 found on the live publish
     * path: the minimal manifest asserted `humanApproved: true` for an act nobody
     * performed, so the gate was satisfied by a value the system wrote about
     * itself. A self_authored manifest must carry the real scheduler and the real
     * scheduling time, must NOT assert human approval, and must NOT carry
     * evaluation scores. Enforced in `evaluateSelfAuthored`.
     */
    | 'self_authored';
  humanApproved?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  /** self_authored only: who scheduled it. A real user id, never a constant. */
  scheduledBy?: string;
  /**
   * self_authored only: when they scheduled it. NOT publish time — the cron
   * stamping `now` recorded a moment at which nobody did anything.
   */
  scheduledAt?: string;
}

export interface CampaignEvaluationScores {
  evidenceQuality: number;
  accuracy: number;
  balance: number;
  usefulness: number;
  brandFit: number;
  seoAeoGeoValue: number;
  platformFit: number;
  riskLevel: number;
  approvalReadiness: number;
}

export interface CampaignEvidenceManifest {
  manifestId: string;
  campaignId?: string;
  topic: string;
  audience: string;
  businessGoal: string;
  sources: CampaignManifestSource[];
  opposingEvidence?: CampaignManifestSource[];
  expertNotes?: string[];
  consumerObjections?: string[];
  claims: CampaignManifestClaim[];
  seoAeoGeoTargets?: string[];
  requiredVisuals?: string[];
  assets?: CampaignManifestAsset[];
  platformOutputs: CampaignManifestPlatformOutput[];
  approval: CampaignManifestApproval;
  /**
   * OPTIONAL and absent by default. Scores must come from a real evaluation of
   * the output, never from the process that produced it. A manifest with no
   * evaluation is blocked by `evaluateCampaignEvidenceManifest` with
   * `campaign_evaluation_missing`, which is the correct outcome.
   */
  evaluation?: CampaignEvaluationScores;
  publishLinks?: string[];
  results?: Record<string, unknown>;
  lessons?: string[];
}

export interface CampaignAuthorityGateResult {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
  manifestId?: string;
  checkedAt: string;
}

export interface CampaignManifestEvaluationInput {
  platforms?: string[];
  requestedAction?: string;
  minScore?: number;
  maxRiskLevel?: number;
}

const ALLOWED_CLAIM_STATUSES = new Set(['allowed', 'approved', 'verified']);
const APPROVED_PLATFORM_STATUSES = new Set(['approved', 'ready']);
const APPROVED_RIGHTS_STATUSES = new Set([
  'approved',
  'cleared',
  'licensed',
  'owned',
  'original',
  'public_domain',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalisePlatform(platform: string): string {
  return platform.trim().toLowerCase();
}

function hasMeaningfulArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function isManifestLike(value: unknown): value is CampaignEvidenceManifest {
  if (!isRecord(value)) return false;
  return (
    typeof value.manifestId === 'string' ||
    typeof value.topic === 'string' ||
    hasMeaningfulArray(value.sources) ||
    hasMeaningfulArray(value.claims) ||
    hasMeaningfulArray(value.platformOutputs) ||
    isRecord(value.approval)
  );
}

function findManifestCandidate(
  value: unknown
): CampaignEvidenceManifest | null {
  if (!isRecord(value)) return null;
  if (isManifestLike(value)) return value;

  const keys = [
    CAMPAIGN_AUTHORITY_MANIFEST_KEY,
    'authorityManifest',
    'campaignEvidenceManifest',
    'evidenceManifest',
  ];

  for (const key of keys) {
    const candidate = value[key];
    if (isManifestLike(candidate)) return candidate;
  }

  return null;
}

export function extractCampaignAuthorityManifest(
  ...sources: unknown[]
): CampaignEvidenceManifest | null {
  for (const source of sources) {
    const candidate = findManifestCandidate(source);
    if (candidate) return candidate;
  }
  return null;
}

function getEvidenceRefs(claim: CampaignManifestClaim): string[] {
  return Array.isArray(claim.evidenceRefs) ? claim.evidenceRefs : [];
}

function formatClaimId(claim: CampaignManifestClaim, index: number): string {
  return claim.id || `claim_${index + 1}`;
}

function evaluateScores(
  scores: CampaignEvaluationScores | undefined,
  minScore: number,
  maxRiskLevel: number
): string[] {
  if (!scores || !isRecord(scores)) {
    return ['campaign_evaluation_missing'];
  }

  const blockers: string[] = [];
  const requiredScoreKeys: (keyof Omit<
    CampaignEvaluationScores,
    'riskLevel'
  >)[] = [
    'evidenceQuality',
    'accuracy',
    'balance',
    'usefulness',
    'brandFit',
    'seoAeoGeoValue',
    'platformFit',
    'approvalReadiness',
  ];

  for (const key of requiredScoreKeys) {
    const score = scores[key];
    if (typeof score !== 'number' || score < minScore) {
      blockers.push(`campaign_evaluation_${key}_below_${minScore}`);
    }
  }

  if (typeof scores.riskLevel !== 'number') {
    blockers.push('campaign_evaluation_riskLevel_missing');
  } else if (scores.riskLevel > maxRiskLevel) {
    blockers.push(`campaign_evaluation_riskLevel_above_${maxRiskLevel}`);
  }

  return blockers;
}

/**
 * Preconditions for the `self_authored` approval state (SYN-1157).
 *
 * This state exists so an ordinary post the owner wrote and scheduled can
 * publish without a reviewer, while the record stops asserting a review that
 * never happened. It is narrow ON PURPOSE, and it fails closed: anything that
 * makes "a human wrote this and it needs no evidence" untrue is a blocker, so
 * the state cannot become a general-purpose bypass.
 *
 * Phase 0.1's bar is not "the self-approval is gone" but "its cause is gone AND
 * CANNOT SILENTLY RETURN". The first two checks are that second half: they
 * refuse the exact shapes the old defect had, so re-adding `humanApproved: true`
 * or a block of invented scores turns the gate red instead of publishing.
 */
function evaluateSelfAuthored(manifest: CampaignEvidenceManifest): string[] {
  const blockers: string[] = [];
  const approval = manifest.approval;

  // The defect, returning. A self-authored post asserts authorship, never review.
  if (
    approval.humanApproved !== undefined ||
    approval.approvedBy !== undefined ||
    approval.approvedAt !== undefined
  ) {
    blockers.push('campaign_self_authored_claims_human_approval');
  }

  // The other half of the defect: nine constants presented as an assessment.
  // No evaluation ran, so the honest manifest carries no scores at all.
  if (manifest.evaluation !== undefined) {
    blockers.push('campaign_self_authored_carries_evaluation');
  }

  // The claim being made is "a specific human scheduled this at a specific
  // time". Unnamed or untimed, that claim is not checkable, so it is refused.
  if (!approval.scheduledBy || !approval.scheduledAt) {
    blockers.push('campaign_self_authored_scheduler_missing');
  }

  // Authorship is not a licence to publish an evidence-bearing claim, nor to
  // skip a sign-off a claim explicitly demands. `requiresEvidence !== false`
  // mirrors the main ledger check: absent means required.
  const claims = manifest.claims ?? [];
  if (
    claims.some(
      claim => claim.requiresEvidence !== false || claim.humanApprovalRequired
    )
  ) {
    blockers.push('campaign_self_authored_requires_evidence');
  }

  return blockers;
}

export function evaluateCampaignEvidenceManifest(
  manifest: CampaignEvidenceManifest | null,
  input: CampaignManifestEvaluationInput = {}
): CampaignAuthorityGateResult {
  const checkedAt = new Date().toISOString();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const minScore = input.minScore ?? 75;
  const maxRiskLevel = input.maxRiskLevel ?? 35;
  const requestedPlatforms = (input.platforms ?? []).map(normalisePlatform);

  if (!manifest) {
    return {
      allowed: false,
      blockers: ['campaign_authority_manifest_missing'],
      warnings,
      checkedAt,
    };
  }

  if (!manifest.manifestId) blockers.push('campaign_manifest_id_missing');
  if (!manifest.topic) blockers.push('campaign_topic_missing');
  if (!manifest.audience) blockers.push('campaign_audience_missing');
  if (!manifest.businessGoal) blockers.push('campaign_business_goal_missing');

  if (!hasMeaningfulArray(manifest.sources)) {
    blockers.push('campaign_sources_missing');
  }

  if (!hasMeaningfulArray(manifest.claims)) {
    blockers.push('campaign_claims_ledger_missing');
  } else {
    manifest.claims.forEach((claim, index) => {
      const claimId = formatClaimId(claim, index);
      if (!ALLOWED_CLAIM_STATUSES.has(claim.status)) {
        blockers.push(`${claimId}_status_${claim.status}`);
      }
      const requiresEvidence = claim.requiresEvidence !== false;
      if (requiresEvidence && getEvidenceRefs(claim).length === 0) {
        blockers.push(`${claimId}_evidence_missing`);
      }
      if (
        claim.humanApprovalRequired &&
        manifest.approval?.humanApproved !== true
      ) {
        blockers.push(`${claimId}_human_approval_required`);
      }
    });
  }

  if (!manifest.assets || manifest.assets.length === 0) {
    warnings.push('campaign_assets_missing');
  } else {
    manifest.assets.forEach(asset => {
      if (!asset.publishable) {
        blockers.push(`${asset.id || 'asset'}_not_publishable`);
      }
      if (!APPROVED_RIGHTS_STATUSES.has(asset.rightsStatus)) {
        blockers.push(`${asset.id || 'asset'}_rights_${asset.rightsStatus}`);
      }
    });
  }

  if (!hasMeaningfulArray(manifest.platformOutputs)) {
    blockers.push('campaign_platform_outputs_missing');
  } else {
    for (const platform of requestedPlatforms) {
      const output = manifest.platformOutputs.find(
        item => normalisePlatform(item.platform) === platform
      );
      if (!output) {
        blockers.push(`campaign_platform_output_${platform}_missing`);
        continue;
      }
      if (!APPROVED_PLATFORM_STATUSES.has(output.status)) {
        blockers.push(`campaign_platform_output_${platform}_${output.status}`);
      }
    }
  }

  if (manifest.approval?.status === 'self_authored') {
    // An ordinary post the account owner wrote and scheduled themselves. It
    // carries no evidence-bearing claim, so there is nothing for a reviewer to
    // check against and no evaluation to run. Every condition that would make
    // that description untrue is a blocker - see `evaluateSelfAuthored`.
    blockers.push(...evaluateSelfAuthored(manifest));
  } else {
    if (
      manifest.approval?.status !== 'approved' ||
      manifest.approval.humanApproved !== true
    ) {
      blockers.push('campaign_human_approval_missing');
    }

    blockers.push(
      ...evaluateScores(manifest.evaluation, minScore, maxRiskLevel)
    );
  }

  if (!manifest.seoAeoGeoTargets || manifest.seoAeoGeoTargets.length === 0) {
    warnings.push('campaign_seo_aeo_geo_targets_missing');
  }
  if (!manifest.requiredVisuals || manifest.requiredVisuals.length === 0) {
    warnings.push('campaign_required_visuals_missing');
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
    manifestId: manifest.manifestId,
    checkedAt,
  };
}
