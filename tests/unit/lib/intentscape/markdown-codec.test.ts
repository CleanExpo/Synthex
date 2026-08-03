import {
  parseAcceptedVisionMarkdown,
  parseContextFieldMarkdown,
  parseGoalContractMarkdown,
  parseVisionAttemptMarkdown,
  renderAcceptedVisionMarkdown,
  renderContextFieldMarkdown,
  renderGoalContractMarkdown,
  renderVisionAttemptMarkdown,
  IntentScapeMarkdownParseError,
} from '@/lib/intentscape/markdown-codec';
import type {
  AcceptedVisionRecord,
  ContextField,
  GoalContract,
  VisionAttemptRecord,
  VisionMap,
} from '@/lib/intentscape';
import { VISION_LENSES } from '@/lib/intentscape';

const NOW = '2026-08-03T00:00:00.000Z';

const context: ContextField = {
  workspaceId: 'workspace-1',
  organizationId: 'org-1',
  version: 1,
  originSignal: 'We may need a new image tool.',
  signals: [
    {
      id: 'signal-1',
      kind: 'origin-signal',
      label: 'Initial thought',
      content: 'We may need a new image tool.',
      evidenceState: 'opinion',
      capturedAt: NOW,
      provenance: 'Human intake <!-- intentscape-payload:start -->',
    },
  ],
  contradictions: ['The current image workflow has not been measured.'],
  unknowns: ['The customer bottleneck is unknown.'],
  createdAt: NOW,
};

const visionMap: VisionMap = {
  contextVersion: 1,
  lensFindings: VISION_LENSES.map(lens => ({
    lens,
    findings: [`The ${lens} lens reveals a distinct condition.`],
    evidenceRefs: ['context/field.md#signal-1'],
    unknowns: [`The contribution of ${lens} is unknown.`],
  })),
  researchBranches: VISION_LENSES.map((lens, index) => ({
    id: `branch-${index}`,
    lens,
    question: `Which observed condition would establish the contribution of ${lens}?`,
    decisionCouldChange: `Whether to prioritise the direction derived from ${lens}.`,
    contextGap: `No evidence currently isolates the effect of ${lens}.`,
    usefulDistance:
      'This investigates a causal condition rather than the requested output.',
    supportSignals: ['The outcome moves when this condition changes.'],
    weakenSignals: ['The outcome is stable when this condition changes.'],
    stopCondition: 'Stop after two independent sources converge or conflict.',
  })),
  hypotheses: [
    {
      id: 'hypothesis-trust',
      version: 1,
      title: 'Resolve comparison uncertainty',
      causalMechanism:
        'Missing comparison evidence prevents qualified customers from resolving uncertainty.',
      desiredChange:
        'Increase qualified-customer confidence by closing decision-critical evidence gaps.',
      affectedStakeholders: ['Prospective customer'],
      evidenceFor: ['Customers revisit comparison material.'],
      evidenceAgainst: ['Some customers purchase without comparison.'],
      invalidatingAssumption:
        'Conversion remains unchanged after decision evidence improves.',
      mainRisk: 'Evidence work may not address the actual purchase barrier.',
      adjacentValue: 'The evidence can improve sales enablement.',
      researchBranchIds: ['branch-1'],
      confidence: 0.62,
    },
    {
      id: 'hypothesis-offer',
      version: 1,
      title: 'Repair outcome alignment',
      causalMechanism:
        'The active promise attracts attention but does not match the frequent customer job.',
      desiredChange:
        'Align the offer around an observed customer job before adding acquisition assets.',
      affectedStakeholders: ['Target buyer'],
      evidenceFor: ['High attention does not progress to intent.'],
      evidenceAgainst: ['Some audience segments already progress.'],
      invalidatingAssumption:
        'Intent remains unchanged after the offer matches the observed job.',
      mainRisk:
        'Repositioning could reduce relevance for a profitable segment.',
      adjacentValue: 'The learning can improve campaign qualification.',
      researchBranchIds: ['branch-2'],
      confidence: 0.58,
    },
    {
      id: 'hypothesis-delivery',
      version: 1,
      title: 'Remove delivery friction',
      causalMechanism:
        'Slow operational hand-offs weaken the experienced outcome and downstream advocacy.',
      desiredChange:
        'Shorten the delivery hand-off cycle before increasing demand generation.',
      affectedStakeholders: ['Existing customer'],
      evidenceFor: ['Advocacy declines after delayed delivery.'],
      evidenceAgainst: ['Some delays do not affect satisfaction.'],
      invalidatingAssumption:
        'Advocacy remains unchanged when hand-off time falls.',
      mainRisk: 'Operational investment may not influence acquisition quality.',
      adjacentValue: 'The workflow improvement can reduce support load.',
      researchBranchIds: ['branch-3'],
      confidence: 0.55,
    },
  ],
  synthesis:
    'The evidence supports three causally distinct intervention points requiring comparison.',
};

const accepted: AcceptedVisionRecord = {
  organizationId: 'org-1',
  workspaceId: 'workspace-1',
  contextField: context,
  visionMap,
  deterministicAudit: { passed: true, issues: [], checkedAt: NOW },
  independentEvaluation: {
    passed: true,
    confidence: 0.91,
    reasons: ['The directions are causally distinct.'],
  },
  acceptedAt: NOW,
};

const goal: GoalContract = {
  id: 'goal-1',
  organizationId: 'org-1',
  workspaceId: 'workspace-1',
  hypothesisId: 'hypothesis-trust',
  hypothesisVersion: 1,
  primaryStakeholder: 'Prospective customer',
  acceptanceCriteria: ['Qualified comparison completion increases.'],
  exclusions: ['No publishing without a separate approval.'],
  authorityBoundaries: ['Research and draft only.'],
  approvedBy: 'user-1',
  approvedAt: NOW,
  contextVersion: 1,
  desiredChange:
    'Increase qualified-customer confidence by closing decision-critical evidence gaps.',
  evidenceRefs: ['context/field.md#signal-1'],
  status: 'approved',
};

describe('IntentScape canonical Markdown codecs', () => {
  it('round-trips a human-readable Context Field despite marker-like evidence', () => {
    const markdown = renderContextFieldMarkdown(context);
    expect(markdown).toContain('Origin Signal — provenance only');
    expect(markdown).toContain(
      'has no goal, search, capability, or action authority'
    );
    expect(parseContextFieldMarkdown(markdown)).toEqual(context);
  });

  it('round-trips rejected Vision Attempts with durable gate reasons', () => {
    const attempt: VisionAttemptRecord = {
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      contextVersion: 1,
      attempt: 1,
      status: 'rejected',
      visionMap,
      deterministicAudit: {
        passed: false,
        issues: [
          {
            code: 'near-copy',
            path: 'hypotheses.0.desiredChange',
            message: 'The direction copies the origin signal.',
          },
        ],
        checkedAt: NOW,
      },
      independentEvaluation: null,
      generatorMetadata: {
        provider: 'TestProvider',
        model: 'generator-model',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      evaluatorMetadata: null,
      rejectionReasons: ['The direction copies the origin signal.'],
      createdAt: NOW,
    };
    const markdown = renderVisionAttemptMarkdown(attempt);
    expect(markdown).toContain('Deterministic anti-anchoring: failed');
    expect(parseVisionAttemptMarkdown(markdown)).toEqual(attempt);
  });

  it('round-trips accepted Vision Maps while keeping goal authority at none', () => {
    const markdown = renderAcceptedVisionMarkdown(accepted);
    expect(markdown).toContain('Goal authority: **none**');
    expect(markdown).toContain('Seven independent lenses');
    expect(parseAcceptedVisionMarkdown(markdown)).toEqual(accepted);
  });

  it('round-trips the exact approved Goal Contract', () => {
    const markdown = renderGoalContractMarkdown(goal);
    expect(markdown).toContain('Approved Goal Contract');
    expect(markdown).toContain('Research and draft only.');
    expect(parseGoalContractMarkdown(markdown)).toEqual(goal);
  });

  it('fails closed when canonical payload markers are missing or invalid', () => {
    expect(() => parseContextFieldMarkdown('# Context only')).toThrow(
      IntentScapeMarkdownParseError
    );
    expect(() =>
      parseContextFieldMarkdown(
        '<!-- intentscape-payload:start -->\n```json\n{}\n```\n<!-- intentscape-payload:end -->'
      )
    ).toThrow('failed validation');
  });
});
