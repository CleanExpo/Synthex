import { VISION_LENSES, type VisionMap } from '@/lib/intentscape/contracts';

const FINDINGS: Record<(typeof VISION_LENSES)[number], string> = {
  'signal-separation':
    'The image request is an observable content need, but the purchase barrier has not yet been established.',
  'upstream-causes':
    'Customers may be missing comparison proof and usage certainty before creative quality becomes decisive.',
  'downstream-effects':
    'More assets without a learning structure could increase production cost while preserving the same uncertainty.',
  'stakeholder-shifts':
    'First-time buyers, repeat customers and the product team need different evidence from the same campaign.',
  'outside-analogies':
    'High-consideration retail uses guided comparison and proof sequencing, not isolated hero images.',
  counterfactuals:
    'If no new images could be made, message order and product proof could still change conversion behaviour.',
  'adjacent-value':
    'The experiment can create a reusable evidence library for ads, landing pages and sales conversations.',
};

export const INTENTSCAPE_DEMO_ORIGIN =
  'We need a tool that creates better product images for our skincare range.';

export const INTENTSCAPE_DEMO_MAP: VisionMap = {
  contextVersion: 2,
  lensFindings: VISION_LENSES.map(lens => ({
    lens,
    findings: [FINDINGS[lens]],
    evidenceRefs: [
      `context/field-v2.md#${lens}`,
      `research/${lens}.md#source-1`,
    ],
    unknowns: [`The measured contribution of ${lens} is not yet verified.`],
  })),
  researchBranches: VISION_LENSES.map((lens, index) => ({
    id: `demo-branch-${index + 1}`,
    lens,
    question: `Which observed condition would confirm or weaken ${lens} as the next intervention point?`,
    decisionCouldChange: `Whether the team invests in the intervention derived from ${lens}.`,
    contextGap: `Current evidence does not establish the contribution of ${lens}.`,
    usefulDistance:
      'This tests a causal condition instead of searching for the requested deliverable.',
    supportSignals: [
      'A source-backed pattern supports testing this condition.',
      'UNTRUSTED RETRIEVED EVIDENCE | Sample source | provider=demo-tour',
    ],
    weakenSignals: [
      'The customer outcome remains unchanged when the condition is removed.',
    ],
    stopCondition:
      'Stop when two independent sources agree or directly conflict.',
  })),
  hypotheses: [
    {
      id: 'demo-trust',
      version: 1,
      title: 'Resolve buyer uncertainty first',
      causalMechanism:
        'Incomplete comparison and usage proof prevents qualified buyers from resolving uncertainty before purchase.',
      desiredChange:
        'Increase first-time buyer confidence by resolving the evidence gaps that block product comparison.',
      affectedStakeholders: ['First-time buyer', 'Growth lead'],
      evidenceFor: [
        'Product-page behaviour shows repeated comparison activity.',
      ],
      evidenceAgainst: [
        'Existing buyers may already understand the product difference.',
      ],
      invalidatingAssumption:
        'Conversion remains unchanged after comparison proof is introduced.',
      mainRisk:
        'The real constraint may be offer relevance rather than information quality.',
      adjacentValue:
        'The evidence pattern can improve product pages and sales enablement.',
      researchBranchIds: ['demo-branch-1', 'demo-branch-2'],
      confidence: 0.78,
    },
    {
      id: 'demo-offer',
      version: 1,
      title: 'Repair offer-to-audience fit',
      causalMechanism:
        'The active audience prioritises a different outcome, so polished creative attracts attention without intent.',
      desiredChange:
        'Align the offer with the customer job that most reliably predicts qualified purchase intent.',
      affectedStakeholders: ['Target buyer', 'Product owner'],
      evidenceFor: [
        'Engagement is stronger than progression into product detail.',
      ],
      evidenceAgainst: ['The existing offer performs for returning customers.'],
      invalidatingAssumption:
        'A reframed offer does not change qualified progression behaviour.',
      mainRisk:
        'A broad positioning change could weaken current customer recall.',
      adjacentValue:
        'The finding can sharpen channel targeting and campaign segmentation.',
      researchBranchIds: ['demo-branch-4', 'demo-branch-6'],
      confidence: 0.69,
    },
    {
      id: 'demo-system',
      version: 1,
      title: 'Build a creative learning system',
      causalMechanism:
        'Disconnected asset production prevents the team from learning which proof, format and audience combination changes behaviour.',
      desiredChange:
        'Turn each creative variation into a traceable experiment that improves the next campaign decision.',
      affectedStakeholders: ['Marketing operator', 'Creative team'],
      evidenceFor: [
        'Past assets lack consistent hypothesis and outcome labels.',
      ],
      evidenceAgainst: [
        'The current sample may be too small for reliable learning.',
      ],
      invalidatingAssumption:
        'Structured variation produces no repeatable performance pattern.',
      mainRisk:
        'Instrumentation overhead could slow useful creative production.',
      adjacentValue:
        'The learning loop becomes reusable across products and channels.',
      researchBranchIds: ['demo-branch-3', 'demo-branch-7'],
      confidence: 0.73,
    },
  ],
  synthesis:
    'The original request points to creative production, but the decision could sit at three different layers: buyer evidence, offer relevance, or the learning system around creative work.',
};
