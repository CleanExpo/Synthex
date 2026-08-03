import {
  auditGoalCandidate,
  auditVisionMap,
  detectAnchorMatch,
} from '@/lib/intentscape/anchoring-guard';
import {
  type VisionMap,
  VISION_LENSES,
  VisionMapSchema,
} from '@/lib/intentscape/contracts';

const ORIGIN = 'I think we need better product images for our skincare range';

function validVisionMap(): VisionMap {
  const researchBranches = VISION_LENSES.map((lens, index) => ({
    id: `branch-${index + 1}`,
    lens,
    question: `Which observed condition would confirm or weaken ${lens} as the main intervention point?`,
    decisionCouldChange: `Whether the team should prioritise the intervention derived from ${lens}.`,
    contextGap: `The current context does not establish the strength of ${lens}.`,
    usefulDistance: `This tests a causal condition instead of repeating the requested creative deliverable.`,
    supportSignals: [
      'Observed behaviour changes when the condition is present.',
    ],
    weakenSignals: ['Outcomes remain unchanged when the condition is removed.'],
    stopCondition:
      'Stop when two independent sources agree or directly conflict.',
  }));

  return {
    contextVersion: 1,
    lensFindings: VISION_LENSES.map(lens => ({
      lens,
      findings: [`A material finding produced through the ${lens} lens.`],
      evidenceRefs: ['context/field.md#signal-1'],
      unknowns: [`The measured contribution of ${lens} is unknown.`],
    })),
    researchBranches,
    hypotheses: [
      {
        id: 'hypothesis-trust',
        version: 1,
        title: 'Reduce purchase uncertainty',
        causalMechanism:
          'Incomplete proof prevents buyers from confidently comparing the offer, so uncertainty blocks purchase progression.',
        desiredChange:
          'Increase the number of qualified buyers who can confidently compare the offer and proceed.',
        affectedStakeholders: ['Prospective customer', 'Sales operator'],
        evidenceFor: [
          'Customer questions concentrate on proof and comparison.',
        ],
        evidenceAgainst: ['Some buyers already understand the offer clearly.'],
        invalidatingAssumption:
          'Conversion remains unchanged after missing proof is supplied.',
        mainRisk: 'Proof improvements may not address an uncompetitive offer.',
        adjacentValue: 'Reusable evidence can support sales and onboarding.',
        researchBranchIds: ['branch-2'],
        confidence: 0.64,
      },
      {
        id: 'hypothesis-offer',
        version: 1,
        title: 'Repair offer-to-audience fit',
        causalMechanism:
          'The offer promises an outcome that the active audience does not prioritise, so attention cannot convert into intent.',
        desiredChange:
          'Align the offer with a frequent and valuable customer job before producing new acquisition assets.',
        affectedStakeholders: ['Target buyer', 'Product owner'],
        evidenceFor: ['Interest is strongest around a different customer job.'],
        evidenceAgainst: [
          'Existing customers cite the current promise as decisive.',
        ],
        invalidatingAssumption:
          'The current audience consistently ranks the existing promise first.',
        mainRisk: 'Repositioning can confuse retained customers.',
        adjacentValue: 'A clearer offer can improve every acquisition channel.',
        researchBranchIds: ['branch-4'],
        confidence: 0.58,
      },
      {
        id: 'hypothesis-workflow',
        version: 1,
        title: 'Remove fulfilment friction',
        causalMechanism:
          'Operational hand-offs delay the promised outcome, causing weak advocacy and reducing the quality of downstream demand.',
        desiredChange:
          'Shorten the hand-off cycle so customers experience the promised outcome and create stronger advocacy.',
        affectedStakeholders: ['Existing customer', 'Operations team'],
        evidenceFor: ['Delays cluster at repeated operational hand-offs.'],
        evidenceAgainst: ['Some delayed customers still advocate strongly.'],
        invalidatingAssumption:
          'Advocacy does not improve when hand-off time falls.',
        mainRisk:
          'Workflow changes can consume capacity without affecting demand.',
        adjacentValue: 'A better workflow can become a differentiated service.',
        researchBranchIds: ['branch-3'],
        confidence: 0.55,
      },
    ],
    synthesis:
      'The context supports three materially different intervention points: buyer uncertainty, offer alignment and operational delivery.',
  };
}

describe('IntentScape anchoring guard', () => {
  it('rejects an exact origin-signal search query', () => {
    expect(detectAnchorMatch(ORIGIN, ORIGIN)).toBe('exact');
  });

  it('rejects a padded near-copy of the origin signal', () => {
    expect(
      detectAnchorMatch(
        ORIGIN,
        'Research why we need better product images for the skincare range now'
      )
    ).toBe('near');
  });

  it('accepts a causally different research question', () => {
    expect(
      detectAnchorMatch(
        ORIGIN,
        'Which purchase objections prevent qualified buyers from comparing the offer?'
      )
    ).toBeNull();
  });

  it('passes a complete vision map with fixed lenses and distinct mechanisms', () => {
    const parsed = VisionMapSchema.parse(validVisionMap());
    const audit = auditVisionMap(ORIGIN, parsed, '2026-08-03T00:00:00.000Z');
    expect(audit).toEqual({
      passed: true,
      issues: [],
      checkedAt: '2026-08-03T00:00:00.000Z',
    });
  });

  it('rejects a vision map whose research question copies the human input', () => {
    const map = validVisionMap();
    map.researchBranches[0]!.question = ORIGIN;
    const audit = auditVisionMap(ORIGIN, map);
    expect(audit.passed).toBe(false);
    expect(audit.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'origin-copy',
          path: 'researchBranches.0.question',
        }),
      ])
    );
  });

  it('rejects a hypothesis whose desired change is a near-copy', () => {
    const map = validVisionMap();
    map.hypotheses[0]!.desiredChange =
      'We need much better product images for our skincare range';
    const audit = auditVisionMap(ORIGIN, map);
    expect(audit.passed).toBe(false);
    expect(audit.issues.some(issue => issue.code === 'near-copy')).toBe(true);
  });

  it('rejects duplicate lenses even when the response has seven entries', () => {
    const map = validVisionMap();
    map.lensFindings[6] = { ...map.lensFindings[0]! };
    const audit = auditVisionMap(ORIGIN, map);
    expect(audit.issues.some(issue => issue.code === 'duplicate-lens')).toBe(
      true
    );
    expect(audit.issues.some(issue => issue.code === 'missing-lens')).toBe(
      true
    );
  });

  it('rejects hypotheses that merely restate the same causal mechanism', () => {
    const map = validVisionMap();
    map.hypotheses[1]!.causalMechanism = map.hypotheses[0]!.causalMechanism;
    const audit = auditVisionMap(ORIGIN, map);
    expect(
      audit.issues.some(issue => issue.code === 'duplicate-mechanism')
    ).toBe(true);
  });

  it('rejects a goal candidate that copies the origin signal', () => {
    const audit = auditGoalCandidate(ORIGIN, ORIGIN);
    expect(audit.passed).toBe(false);
    expect(audit.issues[0]?.code).toBe('origin-copy');
  });

  it('accepts a goal candidate derived from a causal hypothesis', () => {
    const audit = auditGoalCandidate(
      ORIGIN,
      'Increase qualified buyer confidence by supplying evidence that resolves comparison uncertainty.',
      '2026-08-03T00:00:00.000Z'
    );
    expect(audit.passed).toBe(true);
    expect(audit.issues).toHaveLength(0);
  });

  it('schema rejects any pre-approval capability routing field', () => {
    const unsafe = {
      ...validVisionMap(),
      selectedCapabilities: ['image-generation'],
    };
    expect(() => VisionMapSchema.parse(unsafe)).toThrow();
  });
});
