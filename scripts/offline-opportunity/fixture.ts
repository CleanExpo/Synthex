import type { SyntheticFixture, FixtureSession } from './workflow';

export const fixtureSession: FixtureSession = {
  mode: 'synthetic',
  userId: 'synthetic-operator',
  organizationId: 'synthetic-org-a',
};

export const syntheticFixture: SyntheticFixture = {
  mode: 'synthetic',
  id: 'synthetic-checklist-v1',
  organizationId: 'synthetic-org-a',
  source: {
    url: 'https://creator.example.invalid/field-checklist',
    publishedAt: '2026-10-01T00:00:00.000Z',
    capturedAt: '2026-10-07T00:00:00.000Z',
  },
  creatorClaims: [
    'SYNTHETIC creator claims a checklist makes field handovers quicker.',
  ],
  portfolioEvidence: [
    {
      mode: 'synthetic',
      ref: 'synthetic:operator-exercise-1',
      observation:
        'SYNTHETIC tabletop exercise: operators repeated handover questions; no real customer evidence.',
    },
  ],
  targetBusiness: 'Unite Group field services',
  audience: 'Field-services operators across the Unite portfolio',
  customerProblemHypothesis:
    'A repeatable handover checklist may reduce clarification time for field-services operators.',
  confidence: 0.6,
  assumptions: [
    'The tabletop pattern may reflect a real operator problem; this has not been validated.',
  ],
  uncertainties: [
    'Real demand, current clarification time and checklist usefulness are unknown.',
  ],
  suggestedOwner: 'Portfolio operations lead (proposed)',
  kpi: {
    name: 'Handover clarification time',
    unit: 'minutes',
    baselineRequirement:
      'Measure the current median before setting a numeric target.',
  },
  successCriteria:
    'After primary evidence and a measured baseline exist, agree a numeric reduction target and comparison period with the owner.',
  stopCriteria:
    'Stop if primary evidence contradicts the problem, the baseline is unavailable, or an external action or spend would be required.',
  nextValidationStep:
    'Prepare an internal interview guide for review; do not contact anyone in this demonstration.',
};
