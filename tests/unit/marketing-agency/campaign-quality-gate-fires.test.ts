/**
 * Campaign quality gate — the bad-fixture control.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `evaluateCampaignQualityGate` had no test of any kind. Both campaign packs it
 * has ever produced record `status: "pass"` at an identical 95/100. A gate that
 * has only ever returned pass has never demonstrated it CAN block, so its pass
 * carries no information — First Ship Directive rule 6: "Run the bad fixture
 * before any real asset; a gate that has never fired is not a gate."
 *
 * DESIGN — why the fixtures are shaped this way
 * --------------------------------------------
 * 1. `goodInput()` must PASS. Without it, a suite of blocked fixtures is
 *    satisfied by a gate hardwired to `blocked`, which would be a control that
 *    cannot distinguish anything.
 * 2. Every bad fixture is `goodInput()` with EXACTLY ONE mutation. If a fixture
 *    broke five things at once, a block would not prove which check fired, and
 *    a later regression in four of them would stay invisible.
 * 3. Each case asserts the SPECIFIC blocker string, not merely `status ===
 *    'blocked'`. Asserting only the status lets any unrelated blocker satisfy
 *    the test — the gate would look alive while the check under test was dead.
 */

import {
  evaluateCampaignQualityGate,
  type CampaignQualityDraftInput,
} from '@/lib/marketing-agency/campaign-quality-gate';
import type { CampaignEvidenceManifest } from '@/lib/marketing-agency/campaign-authority-manifest';

const CHECKED_AT = '2026-09-03T00:00:00.000Z';

function goodManifest(): CampaignEvidenceManifest {
  return {
    manifestId: 'test-manifest',
    topic: 'Restoration drying rates and who sets them',
    audience: 'Australian restoration contractors',
    businessGoal: 'Establish CARSI as the evidence-led authority',
    sources: [
      {
        id: 'src-platform',
        label: 'LinkedIn official posting policy',
        url: 'https://www.linkedin.com/legal/professional-community-policies',
        sourceType: 'official_platform_documentation',
        checkedAt: CHECKED_AT,
      },
      {
        id: 'src-policy',
        label: 'CARSI internal publication policy',
        path: 'docs/marketing/synthex-rules-v1.md',
        sourceType: 'internal_policy',
        checkedAt: CHECKED_AT,
      },
      {
        id: 'src-regulator',
        label: 'Code Governance Committee annual report',
        url: 'https://insurancecode.org.au/',
        sourceType: 'regulator_publication',
        checkedAt: CHECKED_AT,
      },
    ],
    claims: [
      {
        id: 'claim-breaches',
        statement:
          'The Code Governance Committee recorded more than 70,000 breaches in a year.',
        status: 'verified',
        evidenceRefs: ['src-regulator'],
      },
    ],
    platformOutputs: [],
    approval: { status: 'pending' } as CampaignEvidenceManifest['approval'],
  };
}

/**
 * Body text is deliberately written like a person: varied sentence length, no
 * marketing-slop phrases. It has to clear humanness >= 60 and slop density < 3
 * or the "good" fixture would block for the wrong reason and the control would
 * be worthless.
 */
function goodDraft(): CampaignQualityDraftInput {
  return {
    slotId: 'slot-01',
    channel: 'linkedin',
    title: 'The hidden machine behind home restoration',
    body: [
      'When a home floods, a price is set for drying it.',
      'The homeowner never sees that price. The technician doing the work does not set it.',
      'No regulator in Australia collects it. That is the gap.',
      'We went looking for the oversight and found published financials, claims-handling data, and dispute records. None of it reaches inside the contract terms that decide whether a house actually dries.',
    ].join('\n\n'),
    cta: 'Read the white paper and send us what you have seen.',
    evidenceRefs: ['src-regulator'],
    assetBrief: 'Figure 1: premium flow diagram, owned original artwork',
    mediaPlan: {
      mediaType: 'feed_image',
      format: '1200x627 PNG',
      visualRequirement: 'Owned diagram, no stock imagery',
      assetSourcePolicy: 'owned_licensed_original_only',
      aiDisclosureRequired: false,
      reviewChecks: [
        'rights_cleared',
        'no_identifiable_persons',
        'claims_match_sources',
      ],
    },
    peerBenchmark: {
      status: 'data_required_until_credentials',
      comparableMetrics: ['impressions', 'saves'],
      benchmarkSource: 'LinkedIn native analytics',
      testMethod: 'Compare against trailing six-post median',
    },
  };
}

function run(
  overrides: {
    manifest?: CampaignEvidenceManifest;
    draft?: CampaignQualityDraftInput;
  } = {}
) {
  return evaluateCampaignQualityGate({
    evidenceManifest: overrides.manifest ?? goodManifest(),
    drafts: [overrides.draft ?? goodDraft()],
  });
}

describe('campaign quality gate — the good fixture passes (control for the control)', () => {
  it('returns pass and allowed for a clean campaign, so a block is informative', () => {
    const result = run();

    // If this ever fails, every "blocked" assertion below becomes meaningless:
    // a gate that blocks everything proves nothing when it blocks a bad input.
    expect(result.blockers).toEqual([]);
    expect(result.status).toBe('pass');
    expect(result.allowed).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(75);
  });
});

describe('campaign quality gate — manifest-level blockers FIRE', () => {
  it('fires when there are fewer than three sources', () => {
    const manifest = goodManifest();
    manifest.sources = manifest.sources.slice(0, 2);
    // Keep the claim's evidence ref resolvable so only the count differs.
    manifest.claims[0].evidenceRefs = ['src-platform'];

    const result = run({ manifest });

    expect(result.status).toBe('blocked');
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain('quality_sources_below_3');
  });

  it('fires when a source has no checkedAt timestamp', () => {
    const manifest = goodManifest();
    delete manifest.sources[2].checkedAt;

    const result = run({ manifest });

    expect(result.blockers).toContain(
      'quality_sources_missing_checked_locator_or_type'
    );
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when no official platform source is present', () => {
    const manifest = goodManifest();
    manifest.sources[0].sourceType = 'regulator_publication';

    const result = run({ manifest });

    expect(result.blockers).toContain(
      'quality_official_platform_sources_missing'
    );
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when no internal policy source is present', () => {
    const manifest = goodManifest();
    manifest.sources[1].sourceType = 'regulator_publication';

    const result = run({ manifest });

    expect(result.blockers).toContain('quality_internal_policy_source_missing');
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when a claim carries no evidence', () => {
    const manifest = goodManifest();
    manifest.claims[0].evidenceRefs = [];

    const result = run({ manifest });

    expect(result.blockers).toContain(
      'quality_claim_evidence_missing:claim-breaches'
    );
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when a claim cites a source that does not exist', () => {
    const manifest = goodManifest();
    manifest.claims[0].evidenceRefs = ['src-does-not-exist'];

    const result = run({ manifest });

    expect(result.blockers).toContain(
      'quality_claim_evidence_ref_unknown:claim-breaches:src-does-not-exist'
    );
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });
});

describe('campaign quality gate — draft-level blockers FIRE', () => {
  it('fires when a draft cites no evidence at all', () => {
    const draft = goodDraft();
    draft.evidenceRefs = [];

    const result = run({ draft });

    expect(result.blockers).toContain('slot-01:draft_evidence_refs_missing');
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when a draft cites a source that does not exist', () => {
    const draft = goodDraft();
    draft.evidenceRefs = ['src-ghost'];

    const result = run({ draft });

    expect(result.blockers).toContain(
      'slot-01:draft_evidence_ref_unknown:src-ghost'
    );
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when the media type does not match the channel', () => {
    const draft = goodDraft();
    draft.mediaPlan.mediaType = 'short_video'; // linkedin expects feed_image

    const result = run({ draft });

    expect(result.blockers).toContain(
      'slot-01:draft_media_type_expected_feed_image'
    );
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when the asset policy is not publish-safe — the stock-image guard', () => {
    const draft = goodDraft();
    draft.mediaPlan.assetSourcePolicy =
      'stock_library' as CampaignQualityDraftInput['mediaPlan']['assetSourcePolicy'];

    const result = run({ draft });

    expect(result.blockers).toContain(
      'slot-01:draft_asset_policy_not_publish_safe'
    );
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when there are too few media review checks', () => {
    const draft = goodDraft();
    draft.mediaPlan.reviewChecks = ['rights_cleared'];

    const result = run({ draft });

    expect(result.blockers).toContain(
      'slot-01:draft_media_review_checks_insufficient'
    );
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when a short video omits the AI disclosure', () => {
    const draft = goodDraft();
    draft.channel = 'youtube_shorts';
    draft.mediaPlan.mediaType = 'short_video'; // keep the channel/type pairing valid
    draft.mediaPlan.aiDisclosureRequired = false;

    const result = run({ draft });

    expect(result.blockers).toContain(
      'slot-01:draft_video_ai_disclosure_missing'
    );
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when a social draft has no peer benchmark metrics', () => {
    const draft = goodDraft();
    draft.peerBenchmark.comparableMetrics = [];

    const result = run({ draft });

    expect(result.blockers).toContain('slot-01:draft_peer_metrics_missing');
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when slop-laden copy drags humanness below the floor', () => {
    const draft = goodDraft();
    draft.title = 'Unlock the power of seamless restoration synergy';
    draft.body = [
      "In today's fast-paced world, it is important to note that leveraging cutting-edge solutions is a game changer.",
      'Delve into the robust, seamless tapestry of innovative synergy that empowers stakeholders to unlock unparalleled value.',
      'Moreover, this holistic paradigm revolutionises the landscape and elevates the customer journey to new heights.',
    ].join(' ');
    draft.cta = 'Embark on your transformative journey today.';

    const result = run({ draft });

    expect(result.allowed).toBe(false);
    // Either the humanness floor or the slop-density check must catch this.
    // Asserting the union rather than one exact string keeps the test honest if
    // the scorer is retuned, while still proving copy quality is enforced.
    const caught = result.blockers.some(
      b =>
        b === 'slot-01:draft_humanness_below_60' ||
        b === 'slot-01:draft_slop_density_too_high'
    );
    expect(caught).toBe(true);
  });
});

describe('campaign quality gate — the aggregate verdict reflects the blockers', () => {
  it('reports blocked and allowed=false whenever any blocker is present', () => {
    const manifest = goodManifest();
    manifest.claims[0].evidenceRefs = [];

    const result = run({ manifest });

    expect(result.status).toBe('blocked');
    expect(result.allowed).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });
});
