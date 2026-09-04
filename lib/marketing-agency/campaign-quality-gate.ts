import type {
  CampaignEvidenceManifest,
  CampaignManifestSource,
} from './campaign-authority-manifest';
import { scoreHumanness } from '@/lib/quality/humanness-scorer';

export type CampaignMediaType =
  | 'source_card'
  | 'email_graphic'
  | 'feed_image'
  | 'carousel'
  | 'short_video'
  | 'discussion_prompt';

export type CampaignQualityStatus = 'pass' | 'blocked';
export type CampaignPeerDataStatus =
  | 'ready'
  | 'data_required_until_credentials'
  | 'not_applicable';

export interface CampaignMediaPlan {
  mediaType: CampaignMediaType;
  format: string;
  visualRequirement: string;
  assetSourcePolicy: 'owned_licensed_original_only';
  aiDisclosureRequired: boolean;
  reviewChecks: string[];
}

/**
 * COMPILE-TIME CONTRACT LOCK — `draft_asset_policy_not_publish_safe` is DEAD.
 *
 * The guard below tests `assetSourcePolicy !== 'owned_licensed_original_only'`,
 * which is statically always false while the field is the singleton literal type
 * declared above. The check cannot fire for any well-typed input, so the campaign
 * gate does NOT enforce the founder's real-images-only rule despite appearing to.
 * That rule is enforced in the image service layer and its CI guard, not here.
 * Filed as founder-owned in BACKLOG.md (item 0a).
 *
 * This alias is that defect's alarm. Widen `assetSourcePolicy` to admit any second
 * value and `PolicyIsSingleton` resolves `false`, which does not satisfy
 * `extends true`, so `npm run type-check` FAILS here (TS2344) — the signal to turn
 * the dead guard into a real firing case and give it a test.
 *
 * It lives in this file, not in the test suite, because a type-level assertion is
 * unfalsifiable under `tests/`: tsconfig.json excludes test files from `tsc`, and
 * `isolatedModules: true` makes ts-jest transpile without type-checking. A lock
 * placed there could never fail. Round 5's review caught exactly that class of
 * dead alarm; do not move this back.
 */
type IsExactly<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

type Assert<T extends true> = T;

type PolicyIsSingleton = IsExactly<
  CampaignMediaPlan['assetSourcePolicy'],
  'owned_licensed_original_only'
>;

export type AssetSourcePolicyContractLock = Assert<PolicyIsSingleton>;

export interface CampaignPeerBenchmarkPlan {
  status: CampaignPeerDataStatus;
  comparableMetrics: string[];
  benchmarkSource: string;
  testMethod: string;
}

export interface CampaignQualityDraftInput {
  slotId: string;
  channel: string;
  title: string;
  body: string;
  cta: string;
  evidenceRefs: string[];
  assetBrief: string;
  mediaPlan: CampaignMediaPlan;
  peerBenchmark: CampaignPeerBenchmarkPlan;
}

export interface CampaignQualityDraftResult {
  slotId: string;
  channel: string;
  status: CampaignQualityStatus;
  score: number;
  humannessScore: number;
  humannessGrade: string;
  slopDensity: number;
  evidenceRefCount: number;
  mediaType: CampaignMediaType;
  peerDataStatus: CampaignPeerDataStatus;
  blockers: string[];
  warnings: string[];
}

export interface CampaignQualityGateResult {
  status: CampaignQualityStatus;
  allowed: boolean;
  checkedAt: string;
  overallScore: number;
  blockers: string[];
  warnings: string[];
  sourceSummary: {
    totalSources: number;
    checkedSources: number;
    officialPlatformSources: number;
    internalPolicySources: number;
  };
  draftResults: CampaignQualityDraftResult[];
}

const SOCIAL_CHANNELS = new Set([
  'linkedin',
  'facebook',
  'instagram',
  'youtube_shorts',
  'reddit',
]);

const MEDIA_CHANNELS = new Set([
  'blog',
  'newsletter',
  'linkedin',
  'facebook',
  'instagram',
  'youtube_shorts',
  'reddit',
]);

const MIN_DRAFT_SCORE = 75;
/**
 * Exported so the known-defect lock in
 * `tests/unit/marketing-agency/campaign-quality-gate-fires.test.ts` can observe
 * the REAL threshold rather than a copy of it. A copied `60` is what made the
 * previous lock dead: raising this constant left the alarm green because the
 * alarm was asserting against its own duplicate. Behaviour is unchanged.
 */
export const MIN_HUMANNESS_SCORE = 60;
const MIN_SOURCES = 3;

function sourceHasLocator(source: CampaignManifestSource): boolean {
  return Boolean(source.url || source.path);
}

function sourceIds(sources: CampaignManifestSource[]): Set<string> {
  return new Set(sources.map(source => source.id));
}

function isChecked(source: CampaignManifestSource): boolean {
  return Boolean(
    source.checkedAt && source.sourceType && sourceHasLocator(source)
  );
}

function expectedMediaType(channel: string): CampaignMediaType {
  switch (channel) {
    case 'blog':
      return 'source_card';
    case 'newsletter':
      return 'email_graphic';
    case 'instagram':
      return 'carousel';
    case 'youtube_shorts':
      return 'short_video';
    case 'reddit':
      return 'discussion_prompt';
    case 'linkedin':
    case 'facebook':
      return 'feed_image';
    default:
      return 'source_card';
  }
}

function channelNeedsPeerPlan(channel: string): boolean {
  return SOCIAL_CHANNELS.has(channel);
}

function scoreDraft(
  draft: CampaignQualityDraftInput,
  availableSourceIds: Set<string>
): CampaignQualityDraftResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!draft.evidenceRefs.length) {
    blockers.push('draft_evidence_refs_missing');
  }

  for (const evidenceRef of draft.evidenceRefs) {
    if (!availableSourceIds.has(evidenceRef)) {
      blockers.push(`draft_evidence_ref_unknown:${evidenceRef}`);
    }
  }

  const humanness = scoreHumanness(
    [draft.title, draft.body, draft.cta].join('\n\n'),
    MIN_HUMANNESS_SCORE
  );
  if (!humanness.passes) {
    blockers.push(`draft_humanness_below_${MIN_HUMANNESS_SCORE}`);
  }
  if (humanness.slopScan.slopDensity >= 3) {
    blockers.push('draft_slop_density_too_high');
  }

  const expected = expectedMediaType(draft.channel);
  if (MEDIA_CHANNELS.has(draft.channel) && !draft.mediaPlan) {
    blockers.push('draft_media_plan_missing');
  } else {
    if (draft.mediaPlan.mediaType !== expected) {
      blockers.push(`draft_media_type_expected_${expected}`);
    }
    if (draft.mediaPlan.assetSourcePolicy !== 'owned_licensed_original_only') {
      blockers.push('draft_asset_policy_not_publish_safe');
    }
    if (draft.mediaPlan.reviewChecks.length < 3) {
      blockers.push('draft_media_review_checks_insufficient');
    }
    if (
      draft.channel === 'youtube_shorts' &&
      draft.mediaPlan.aiDisclosureRequired !== true
    ) {
      blockers.push('draft_video_ai_disclosure_missing');
    }
  }

  if (channelNeedsPeerPlan(draft.channel)) {
    if (!draft.peerBenchmark.comparableMetrics.length) {
      blockers.push('draft_peer_metrics_missing');
    }
    if (!draft.peerBenchmark.benchmarkSource) {
      blockers.push('draft_peer_benchmark_source_missing');
    }
    if (!draft.peerBenchmark.testMethod) {
      blockers.push('draft_peer_test_method_missing');
    }
    if (draft.peerBenchmark.status === 'not_applicable') {
      blockers.push('draft_peer_plan_not_applicable');
    }
  }

  if (draft.peerBenchmark.status === 'data_required_until_credentials') {
    warnings.push('peer_data_waiting_for_oauth_or_platform_analytics');
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        humanness.score * 0.35 +
          (draft.evidenceRefs.length > 0 ? 25 : 0) +
          (draft.mediaPlan.reviewChecks.length >= 3 ? 20 : 0) +
          (draft.peerBenchmark.comparableMetrics.length > 0 ? 20 : 0)
      )
    )
  );

  if (score < MIN_DRAFT_SCORE) {
    blockers.push(`draft_quality_score_below_${MIN_DRAFT_SCORE}`);
  }

  return {
    slotId: draft.slotId,
    channel: draft.channel,
    status: blockers.length ? 'blocked' : 'pass',
    score,
    humannessScore: humanness.score,
    humannessGrade: humanness.grade,
    slopDensity: humanness.slopScan.slopDensity,
    evidenceRefCount: draft.evidenceRefs.length,
    mediaType: draft.mediaPlan.mediaType,
    peerDataStatus: draft.peerBenchmark.status,
    blockers,
    warnings,
  };
}

export function evaluateCampaignQualityGate(input: {
  evidenceManifest: CampaignEvidenceManifest;
  drafts: CampaignQualityDraftInput[];
}): CampaignQualityGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const sources = input.evidenceManifest.sources;
  const ids = sourceIds(sources);
  const checkedSources = sources.filter(isChecked).length;
  const officialPlatformSources = sources.filter(
    source => source.sourceType === 'official_platform_documentation'
  ).length;
  const internalPolicySources = sources.filter(
    source => source.sourceType === 'internal_policy'
  ).length;

  if (sources.length < MIN_SOURCES) {
    blockers.push(`quality_sources_below_${MIN_SOURCES}`);
  }
  if (checkedSources !== sources.length) {
    blockers.push('quality_sources_missing_checked_locator_or_type');
  }
  if (officialPlatformSources === 0) {
    blockers.push('quality_official_platform_sources_missing');
  }
  if (internalPolicySources === 0) {
    blockers.push('quality_internal_policy_source_missing');
  }

  for (const claim of input.evidenceManifest.claims) {
    if (claim.requiresEvidence !== false && !claim.evidenceRefs?.length) {
      blockers.push(`quality_claim_evidence_missing:${claim.id}`);
    }
    for (const evidenceRef of claim.evidenceRefs ?? []) {
      if (!ids.has(evidenceRef)) {
        blockers.push(
          `quality_claim_evidence_ref_unknown:${claim.id}:${evidenceRef}`
        );
      }
    }
  }

  const draftResults = input.drafts.map(draft => scoreDraft(draft, ids));
  for (const result of draftResults) {
    blockers.push(
      ...result.blockers.map(blocker => `${result.slotId}:${blocker}`)
    );
    warnings.push(
      ...result.warnings.map(warning => `${result.slotId}:${warning}`)
    );
  }

  const overallScore =
    draftResults.length > 0
      ? Math.round(
          draftResults.reduce((sum, result) => sum + result.score, 0) /
            draftResults.length
        )
      : 0;

  if (overallScore < MIN_DRAFT_SCORE) {
    blockers.push(`quality_overall_score_below_${MIN_DRAFT_SCORE}`);
  }

  return {
    status: blockers.length ? 'blocked' : 'pass',
    allowed: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    overallScore,
    blockers,
    warnings,
    sourceSummary: {
      totalSources: sources.length,
      checkedSources,
      officialPlatformSources,
      internalPolicySources,
    },
    draftResults,
  };
}
