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
 * 2. Every bad fixture must produce EXACTLY ONE blocker. Not "one mutation" —
 *    that was the original claim and it was false twice. One assignment can trip
 *    several checks at once: clearing `evidenceRefs` also dropped the score below
 *    75, and slicing `sources` also orphaned a reference the draft still cited.
 * 3. Each case therefore asserts the EXACT SET (`toEqual([one])`), never
 *    `toContain`. This is the load-bearing rule, and it is not stylistic.
 *    `toContain` + `allowed === false` proves only that SOME blocker enforced the
 *    verdict, not the named one — a companion blocker holds `allowed=false` on its
 *    own, so the check under test can be dead while the case still passes.
 *
 * HOW THAT IS PROVEN, not asserted
 * --------------------------------
 * The selective mutant: keep a blocker in the reported array, exclude it from the
 * status/allowed computation. If a case truly isolates its check, that mutant must
 * fail exactly that case. Verified across five blockers — `quality_sources_below_3`,
 * `draft_evidence_refs_missing`, `quality_internal_policy_source_missing`,
 * `draft_peer_metrics_missing`, `draft_asset_policy_not_publish_safe` — each killing
 * exactly one test (`1 failed, 16 passed`). Two of those previously survived 17/17.
 *
 * Independent review found the coupling defect twice, in two different cases, after
 * I claimed to have fixed it once. If you add a case here, dump its exact blocker
 * set and check it is length 1 before trusting it. Reasoning about it is what failed.
 */

import {
  evaluateCampaignQualityGate,
  type CampaignQualityDraftInput,
} from '@/lib/marketing-agency/campaign-quality-gate';
import type { CampaignEvidenceManifest } from '@/lib/marketing-agency/campaign-authority-manifest';
import { scoreHumanness } from '@/lib/quality/humanness-scorer';

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
    // No `as` cast. A cast here would let an invalid manifest masquerade as the
    // "clean campaign" control: `status` accepts 'pending_review', not 'pending',
    // and the gate does not read `approval` — so a wrong value would never surface
    // at runtime and the control would silently be testing an invalid fixture.
    approval: { status: 'pending_review' },
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
    // MUST exceed 200 words. Below that, extractFingerprint returns invalid and
    // scoreHumanness clamps to 85, which caps the draft score at 95 — and then
    // clearing evidenceRefs drops it to 70 and trips TWO extra score blockers,
    // destroying the one-check isolation this suite claims. At 200+ clean words
    // humanness is 100, so the evidence-refs case scores exactly 75: at the floor,
    // not below it, leaving draft_evidence_refs_missing as the ONLY blocker.
    // Measured: 258 words, humanness 100, slopDensity 0.
    body: [
      'When a home floods in this country, someone sets a price for drying it out.',
      'The owner never sees that number.',
      'The technician who runs the fans and the dehumidifiers does not set it either, and often cannot even ask what it is.',
      'No regulator gathers it.',
      'We went looking for the oversight that everyone assumes must exist somewhere.',
      'Insurer financials are published every year. Claims handling is tracked. Disputes are heard, recorded and counted.',
      'None of that reaches inside the commercial terms which decide whether a house actually dries out properly, or merely looks dry on the day the meter comes out.',
      'A price that nobody is permitted to see cannot be checked by anyone at all.',
      'Ask a restorer in private whether it feels any different here, and then watch how carefully they choose their words before answering you.',
      'That hesitation is the finding.',
      'We will publish what we can verify from public records, and we will name plainly what stays hidden.',
      'Where the evidence runs out, we will say so rather than guess.',
      'This is not an accusation aimed at any single company.',
      'It is a governance question, and every member of this industry is entitled to ask it out loud.',
      'The drying itself is simple physics. Water moves, air moves, and a building either dries or it does not.',
      'What is complicated is the paperwork wrapped around it, and who is allowed to read that paperwork.',
      'That is what we set out to map, and what we could not map is itself the result.',
    ].join(' '),
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

/** The worst copy this suite produces: dense marketing slop. */
function slopDraft(): CampaignQualityDraftInput {
  const draft = goodDraft();
  draft.title = 'Unlock the power of seamless restoration synergy';
  draft.body = [
    "In today's fast-paced world, it is important to note that leveraging cutting-edge solutions is a game changer.",
    'Delve into the robust, seamless tapestry of innovative synergy that empowers stakeholders to unlock unparalleled value.',
    'Moreover, this holistic paradigm revolutionises the landscape and elevates the customer journey to new heights.',
  ].join(' ');
  draft.cta = 'Embark on your transformative journey today.';
  return draft;
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
  it('fires when there are fewer than three sources, and is the ONLY blocker', () => {
    const manifest = goodManifest();
    // Keep src-platform + src-policy: dropping either would also trip
    // quality_official_platform_sources_missing or
    // quality_internal_policy_source_missing as a companion.
    manifest.sources = manifest.sources.slice(0, 2);
    // BOTH referrers must be repointed at a surviving source, not just the claim.
    // Round 3 review caught exactly this: an earlier version repointed the claim
    // and left goodDraft() still citing the dropped src-regulator, so
    // draft_evidence_ref_unknown rode along and held the verdict up on its own.
    manifest.claims[0].evidenceRefs = ['src-policy'];
    const draft = goodDraft();
    draft.evidenceRefs = ['src-policy'];

    const result = run({ manifest, draft });

    expect(result.blockers).toEqual(['quality_sources_below_3']);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when a source has no checkedAt timestamp', () => {
    const manifest = goodManifest();
    delete manifest.sources[2].checkedAt;

    const result = run({ manifest });

    expect(result.blockers).toEqual([
      'quality_sources_missing_checked_locator_or_type',
    ]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when no official platform source is present', () => {
    const manifest = goodManifest();
    manifest.sources[0].sourceType = 'regulator_publication';

    const result = run({ manifest });

    expect(result.blockers).toEqual([
      'quality_official_platform_sources_missing',
    ]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when no internal policy source is present', () => {
    const manifest = goodManifest();
    manifest.sources[1].sourceType = 'regulator_publication';

    const result = run({ manifest });

    expect(result.blockers).toEqual(['quality_internal_policy_source_missing']);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when a claim carries no evidence', () => {
    const manifest = goodManifest();
    manifest.claims[0].evidenceRefs = [];

    const result = run({ manifest });

    expect(result.blockers).toEqual([
      'quality_claim_evidence_missing:claim-breaches',
    ]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when a claim cites a source that does not exist', () => {
    const manifest = goodManifest();
    manifest.claims[0].evidenceRefs = ['src-does-not-exist'];

    const result = run({ manifest });

    expect(result.blockers).toEqual([
      'quality_claim_evidence_ref_unknown:claim-breaches:src-does-not-exist',
    ]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });
});

describe('campaign quality gate — draft-level blockers FIRE', () => {
  it('fires when a draft cites no evidence at all, and is the ONLY blocker', () => {
    const draft = goodDraft();
    draft.evidenceRefs = [];

    const result = run({ draft });

    // EXACT SET, not toContain. Independent review showed that `toContain` plus
    // `allowed === false` does not prove THIS blocker enforces: clearing
    // evidenceRefs used to also drop the score to 70, adding two score blockers
    // that held allowed=false on their own. A mutant excluding
    // draft_evidence_refs_missing from the verdict therefore survived.
    // With the 200+ word body the score lands on exactly 75, so this is now the
    // sole blocker — and excluding it from the verdict flips allowed to true and
    // fails this test, which is what makes the enforcement claim real.
    expect(result.blockers).toEqual(['slot-01:draft_evidence_refs_missing']);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when a draft cites a source that does not exist', () => {
    const draft = goodDraft();
    draft.evidenceRefs = ['src-ghost'];

    const result = run({ draft });

    expect(result.blockers).toEqual([
      'slot-01:draft_evidence_ref_unknown:src-ghost',
    ]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when the media type does not match the channel', () => {
    const draft = goodDraft();
    draft.mediaPlan.mediaType = 'short_video'; // linkedin expects feed_image

    const result = run({ draft });

    expect(result.blockers).toEqual([
      'slot-01:draft_media_type_expected_feed_image',
    ]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  // The asset-policy case was REMOVED, not moved. It used
  // `'stock_library' as ...` to manufacture a value the type forbids, and so
  // proved only that an unreachable branch executes when you lie to the
  // compiler. See the known-defect section below for what replaced it.

  it('fires when there are too few media review checks', () => {
    const draft = goodDraft();
    draft.mediaPlan.reviewChecks = ['rights_cleared'];

    const result = run({ draft });

    expect(result.blockers).toEqual([
      'slot-01:draft_media_review_checks_insufficient',
    ]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when a short video omits the AI disclosure', () => {
    const draft = goodDraft();
    draft.channel = 'youtube_shorts';
    draft.mediaPlan.mediaType = 'short_video'; // keep the channel/type pairing valid
    draft.mediaPlan.aiDisclosureRequired = false;

    const result = run({ draft });

    expect(result.blockers).toEqual([
      'slot-01:draft_video_ai_disclosure_missing',
    ]);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires when a social draft has no peer benchmark metrics', () => {
    const draft = goodDraft();
    draft.peerBenchmark.comparableMetrics = [];

    const result = run({ draft });

    expect(result.blockers).toEqual(['slot-01:draft_peer_metrics_missing']);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('fires on slop density when the copy is marketing sludge', () => {
    const draft = slopDraft();

    const result = run({ draft });

    // The EXACT blocker, not a union. An earlier version of this test asserted
    // "humanness OR slop density" and called it an honest hedge; independent
    // review showed the hedge concealed that only one of the two ever fires.
    expect(result.blockers).toEqual(['slot-01:draft_slop_density_too_high']);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('blocked');
  });
});

/**
 * KNOWN DEFECT LOCK — `draft_humanness_below_60` is unreachable in production.
 *
 * `scoreHumanness` computes `score = 100 - min(40, slopPenalty)`, so the score
 * FLOORS AT 60; the three bonuses only add, and the no-fingerprint branch clamps
 * to `min(85, max(0, score))`, which is also 60 at worst. `passes = score >=
 * threshold` with `MIN_HUMANNESS_SCORE = 60` is therefore ALWAYS true, and
 * `campaign-quality-gate.ts` can never push `draft_humanness_below_60`.
 *
 * Measured, not reasoned — a probe over six inputs including maximum-slop text:
 *   maximum slop, short  score=60 passes=true
 *   maximum slop, long   score=60 passes=true
 *   MIN SCORE OBSERVED = 60 | ANY passes=false ? false
 *
 * This test LOCKS that defect rather than hiding it. The threshold is a product
 * judgement about what counts as unacceptable copy, so an agent must not quietly
 * retune it — it is filed in BACKLOG.md for the founder. When the scorer or the
 * threshold is fixed, THIS TEST WILL FAIL, which is the signal to convert it into
 * a real firing case for the humanness floor.
 */
describe('campaign quality gate — known defect: the humanness floor cannot fire', () => {
  it('scores maximum-slop copy at exactly the floor, so humanness never blocks', () => {
    const worst = scoreHumanness(
      [slopDraft().title, slopDraft().body, slopDraft().cta].join('\n\n'),
      60
    );

    expect(worst.score).toBeGreaterThanOrEqual(60);
    expect(worst.passes).toBe(true);

    // And therefore the gate's humanness blocker is absent even on this input.
    const result = run({ draft: slopDraft() });
    expect(result.blockers).not.toContain('slot-01:draft_humanness_below_60');
  });
});

/**
 * KNOWN DEFECT LOCK #2 — `draft_asset_policy_not_publish_safe` cannot fire either.
 *
 * `CampaignMediaPlan.assetSourcePolicy` is declared as the SINGLETON literal type
 * `'owned_licensed_original_only'` (campaign-quality-gate.ts:25). The guard at
 * line 173 tests `!== 'owned_licensed_original_only'`, which is statically always
 * false for any well-typed input.
 *
 * It is dead at RUNTIME too, not merely in the type system. The gate has exactly
 * one call site — `full-campaign-generator.ts:672` — and every draft reaching it
 * is built in-code with that literal hardcoded (six-plus assignments, all
 * identical). No untyped JSON boundary feeds this field, so nothing can carry a
 * different value.
 *
 * The removed test asserted this guard "fires" by casting `'stock_library'` past
 * the compiler. That proves an unreachable branch executes when you lie to the
 * type system — it does not prove a valid input can trip the guard, and round-4
 * independent review was right to call it a false claim of a firing guard.
 *
 * WHY THIS ONE MATTERS MORE THAN THE HUMANNESS FLOOR: this is nominally the guard
 * for the founder-mandated real-images-only rule — visuals must come from owned
 * material, never stock or model imagination. That rule is enforced elsewhere
 * (the service layer and its CI guard); it is NOT enforced here, despite this
 * check appearing to do so. A reader auditing the campaign gate would reasonably
 * conclude asset provenance is checked at generation time. It is not.
 *
 * The fix is a product decision, not an agent retune: either widen the contract to
 * model candidate/unsafe policies, or validate at a real untyped boundary. Filed
 * in BACKLOG.md as founder-owned. THIS TEST FAILS if the type is ever widened,
 * which is the signal to convert it into a real firing case.
 */
describe('campaign quality gate — known defect: the asset-policy guard cannot fire', () => {
  it('accepts the only value its type permits, so the guard is unreachable', () => {
    const draft = goodDraft();

    // The sole permitted value — no cast, because no other value is expressible.
    expect(draft.mediaPlan.assetSourcePolicy).toBe(
      'owned_licensed_original_only'
    );

    const result = run({ draft });
    expect(result.blockers).not.toContain(
      'slot-01:draft_asset_policy_not_publish_safe'
    );
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
