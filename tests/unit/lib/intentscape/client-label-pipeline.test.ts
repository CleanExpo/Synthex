import {
  applyClientAutoLabels,
  buildClientLabelPolicy,
} from '@/lib/intentscape/client-label-pipeline';

describe('client-specific Auto Label Pipeline', () => {
  it('uses each tenant profile instead of applying one global taxonomy', () => {
    const safetyPolicy = buildClientLabelPolicy({
      organizationId: 'org-safety',
      clientName: 'Safety Client',
      clientProfile: {
        offers: ['warehouse safety labels'],
        goals: ['reduce picking errors'],
      },
    });
    const recoveryPolicy = buildClientLabelPolicy({
      organizationId: 'org-recovery',
      clientName: 'Recovery Client',
      clientProfile: {
        offers: ['emergency property restoration'],
        goals: ['increase insurer referrals'],
      },
    });
    const signal = {
      kind: 'note' as const,
      label: 'Customer request',
      content:
        'The operations team needs warehouse safety labels to reduce picking errors.',
    };

    const safetyLabels = applyClientAutoLabels(signal, safetyPolicy);
    const recoveryLabels = applyClientAutoLabels(signal, recoveryPolicy);

    expect(safetyLabels.map(label => label.label)).toEqual(
      expect.arrayContaining([
        'Client context',
        'Offer · warehouse safety labels',
        'Goal · reduce picking errors',
      ])
    );
    expect(recoveryLabels.map(label => label.label)).toEqual([
      'Client context',
    ]);
  });

  it('marks risk and goal labels for checking rather than granting authority', () => {
    const policy = buildClientLabelPolicy({
      organizationId: 'org-1',
      clientName: 'Regulated Client',
      clientProfile: {
        goals: ['grow tax advice leads'],
        constraints: { legal: ['no personalised tax advice'] },
      },
    });
    const labels = applyClientAutoLabels(
      {
        kind: 'constraint',
        label: 'Authority boundary',
        content:
          'Grow tax advice leads, but provide no personalised tax advice.',
      },
      policy
    );

    expect(labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Constraint',
          dimension: 'risk',
          status: 'check',
          routeTo: 'risk-review',
        }),
        expect.objectContaining({
          label: 'Goal · grow tax advice leads',
          dimension: 'goal',
          status: 'check',
        }),
      ])
    );
  });

  it('accepts an explicit client workflow taxonomy from organisation settings', () => {
    const policy = buildClientLabelPolicy({
      organizationId: 'org-1',
      clientName: 'Specialist Client',
      organizationSettings: {
        autoLabelPipeline: {
          name: 'Specialist intake v3',
          version: 3,
          autoApplyThreshold: 0.8,
          suggestThreshold: 0.55,
          labels: [
            {
              id: 'process-site-assessment',
              name: 'Site assessment',
              dimension: 'workflow',
              matchAny: ['moisture inspection', 'site assessment'],
              sourceKinds: [],
              routeTo: 'assessment-queue',
              requiresReview: false,
            },
          ],
        },
      },
    });
    const labels = applyClientAutoLabels(
      {
        kind: 'note',
        label: 'Field note',
        content: 'A moisture inspection must happen before restoration begins.',
      },
      policy
    );

    expect(labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Site assessment',
          status: 'applied',
          routeTo: 'assessment-queue',
          policyName: 'Specialist intake v3',
          policyVersion: 3,
        }),
      ])
    );
  });

  it('does not invent a specialist match when only the source type is known', () => {
    const policy = buildClientLabelPolicy({
      organizationId: 'org-1',
      clientName: 'Client',
      clientProfile: { offers: ['commercial refrigeration maintenance'] },
    });
    const labels = applyClientAutoLabels(
      {
        kind: 'website',
        label: 'Business website',
        content: 'A general company homepage.',
        sourceUrl: 'https://example.com',
      },
      policy
    );

    expect(labels).toEqual([
      expect.objectContaining({
        label: 'Website',
        dimension: 'source',
        status: 'applied',
      }),
    ]);
  });
});
