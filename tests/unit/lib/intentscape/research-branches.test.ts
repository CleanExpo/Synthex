import type { EvidenceRetriever } from '@/lib/evidence/retriever';
import { VISION_LENSES, type VisionMap } from '@/lib/intentscape/contracts';
import {
  createProductionVisionResearcher,
  INTENTSCAPE_RESEARCH_LIMITS,
} from '@/lib/intentscape/research-branches';

const ORIGIN = 'Make product images for the new skincare range';

function map(): VisionMap {
  return {
    contextVersion: 1,
    lensFindings: VISION_LENSES.map(lens => ({
      lens,
      findings: [`Finding for ${lens}.`],
      evidenceRefs: ['context/field.md#signal-1'],
      unknowns: [`Unknown for ${lens}.`],
    })),
    researchBranches: VISION_LENSES.map((lens, index) => ({
      id: `branch-${index}`,
      lens,
      question: `Which observed condition would establish ${lens} as the causal intervention point?`,
      decisionCouldChange: `Whether to prioritise the intervention derived from ${lens}.`,
      contextGap: `The evidence does not establish the contribution of ${lens}.`,
      usefulDistance:
        'This tests a cause rather than the requested deliverable.',
      supportSignals: ['A bounded signal supports investigation.'],
      weakenSignals: [
        'The outcome remains unchanged when the condition changes.',
      ],
      stopCondition: 'Stop when two independent sources agree or conflict.',
    })),
    hypotheses: [0, 1, 2].map(index => ({
      id: `hypothesis-${index}`,
      version: 1,
      title: `Causal option ${index}`,
      causalMechanism:
        'A distinct causal mechanism changes behaviour before any deliverable is selected.',
      desiredChange:
        'Change the measurable condition that blocks a stakeholder outcome.',
      affectedStakeholders: ['Customer'],
      evidenceFor: ['One current signal supports investigation.'],
      evidenceAgainst: ['One current signal could weaken the mechanism.'],
      invalidatingAssumption:
        'The outcome remains unchanged after the mechanism is removed.',
      mainRisk: 'The intervention may not change the measured outcome.',
      adjacentValue: 'The learning improves future prioritisation quality.',
      researchBranchIds: [`branch-${index}`],
      confidence: 0.5,
    })),
    synthesis:
      'The current evidence supports several causally different intervention points.',
  };
}

function retriever(search: jest.Mock): EvidenceRetriever {
  return {
    id: 'exa',
    capabilities: { canSearch: true, canFetch: true },
    available: () => true,
    search,
    fetch: jest.fn(),
  };
}

describe('IntentScape branch researcher', () => {
  it('searches causal questions and never the human Origin Signal', async () => {
    const search = jest.fn(async () => [
      {
        url: 'https://example.com/research',
        title: 'Observed buyer behaviour',
        publishedAt: null,
        retrievedAt: '2026-08-03T00:00:00.000Z',
        provider: 'exa' as const,
        contentHash: 'a'.repeat(64),
        excerpt: 'Independent evidence about the causal condition.',
        domain: 'example.com',
      },
    ]);
    const input = map();
    const result = await createProductionVisionResearcher({
      retrievers: [retriever(search)],
    }).research(input);

    expect(search).toHaveBeenCalledTimes(
      INTENTSCAPE_RESEARCH_LIMITS.maximumBranchesPerRun
    );
    expect(search.mock.calls.flat()).not.toContain(ORIGIN);
    expect(search.mock.calls.map(call => call[0])).toEqual(
      input.researchBranches.map(branch => branch.question)
    );
    expect(result.researchBranches[0]?.supportSignals.join(' ')).toContain(
      'UNTRUSTED RETRIEVED EVIDENCE'
    );
    expect(
      Math.max(
        ...result.researchBranches.flatMap(branch =>
          branch.supportSignals.map(signal => signal.length)
        )
      )
    ).toBeLessThanOrEqual(500);
  });

  it('fabricates no evidence when a search provider is unavailable', async () => {
    const input = map();
    const result = await createProductionVisionResearcher({
      retrievers: [],
    }).research(input);
    expect(result).toEqual(input);
  });
});
