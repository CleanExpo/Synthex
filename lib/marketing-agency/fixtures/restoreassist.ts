import type { CampaignFixture } from '../types';

export const restoreAssistFixture: CampaignFixture = {
  clientBrand: {
    id: 'restoreassist',
    slug: 'ra',
    displayName: 'RestoreAssist',
    legalName: 'RestoreAssist Pty Ltd',
    websiteUrl: 'https://restoreassist.app',
    primaryAudience: 'Australian water-damage restoration tradies',
    secondaryAudience: 'Insurance claims teams and assessor networks',
    voiceRules: [
      'Australian-direct',
      'grounded',
      'informed',
      'short cadence',
      'client problem before product',
    ],
    forbiddenClaims: [
      'guaranteed time saved',
      'guaranteed claim approval',
      'guaranteed cost reduction',
      'fake testimonials',
    ],
    colors: {
      primary: '#1C2E47',
      secondary: '#8A6B4E',
      accent: '#D4A574',
    },
  },
  productProfile: {
    id: 'restoreassist-launch',
    name: 'RestoreAssist.app Launch',
    primaryOffer: 'Start with 3 free reports.',
    valueProposition:
      'RestoreAssist helps Australian restoration teams connect inspection, scoping, estimating, and reporting from verified site data.',
    proofPoints: [
      'inspection workflow',
      'scoping workflow',
      'estimating workflow',
      'verified site data',
      'transparent auditable reports',
      'PDF and Excel export',
    ],
    blockedClaims: [
      'guaranteed time saved',
      'guaranteed claim approval',
      'guaranteed re-inspection reduction',
    ],
  },
  personas: [
    {
      id: 'restoration-owner',
      name: 'Restoration Company Owner',
      platformPriority: 'LinkedIn first, Facebook retargeting second',
      coreProblem: 'Jobs move faster than admin capacity.',
      messageAngle: 'Inspection, scoping, and estimating in one repeatable process.',
      proofNeeded: ['workflow screenshots', 'pricing page', 'export proof'],
      primaryCta: 'Start with 3 reports.',
    },
    {
      id: 'field-technician',
      name: 'Field Technician / Supervisor',
      platformPriority: 'Facebook and LinkedIn',
      coreProblem: 'Site notes become office rework.',
      messageAngle: 'Capture the job once. Keep the report tied to the evidence.',
      proofNeeded: ['capture flow', 'photo fields', 'report export'],
      primaryCta: 'Try the workflow on the next job.',
    },
    {
      id: 'insurance-assessor',
      name: 'Insurance Adjuster / Assessor',
      platformPriority: 'LinkedIn',
      coreProblem: 'Reports arrive in inconsistent formats.',
      messageAngle: 'Transparent, auditable restoration reports from verified site data.',
      proofNeeded: ['sample report', 'compliance references', 'privacy statement'],
      primaryCta: 'Review a sample report.',
    },
  ],
  sourceRefs: [
    {
      id: 'restoreassist-site',
      label: 'RestoreAssist.app',
      url: 'https://restoreassist.app',
      verifiedAt: '2026-05-16',
    },
    {
      id: 'ra-brand-config',
      label: 'RestoreAssist brand config',
      path: 'packages/brand-config/src/brands/ra.ts',
      verifiedAt: '2026-05-16',
    },
  ],
};
