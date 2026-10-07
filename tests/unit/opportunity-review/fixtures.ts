export const proposalFixture = {
  title: 'Test operator proposal',
  targetProject: { name: 'Synthex', repository: 'CleanExpo/Synthex' },
  targetBusiness: 'Unite Group',
  customerProblemHypothesis:
    'Operators need to connect observed signals to validation.',
  sources: [
    {
      url: 'https://example.com/source',
      capturedAt: '2026-10-07T00:00:00.000Z',
      claims: ['Creator describes a possible problem.'],
    },
  ],
  uniteEvidence: [
    {
      reference: 'Operator interview notes 07/10/2026',
      observation: 'Operator manually reported repeated review friction.',
      capturedAt: '2026-10-07T00:00:00.000Z',
    },
  ],
  confidence: 0.4,
  assumptions: ['Manual observations are representative.'],
  uncertainties: ['Demand has not been validated.'],
  suggestedOwner: 'Portfolio operator',
  kpi: {
    name: 'Completed validation interviews',
    unit: 'interviews',
    baselineRequirement: 'Establish baseline before any experiment.',
  },
  successCriteria: 'Three independent interviews describe the problem.',
  stopCriteria: 'Stop if interviews do not support the problem.',
  nextValidationStep: 'Interview three operators manually.',
};
