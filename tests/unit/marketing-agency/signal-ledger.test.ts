import {
  buildSignalApprovalGate,
  convertSignalsToOpportunities,
  evaluateSignalRisk,
  rankGovernedSignals,
  scoreGovernedSignal,
  type GovernedSignal,
} from '@/lib/marketing-agency/intelligence/signal-ledger';

const baseSignal: GovernedSignal = {
  id: 'signal-restoreassist-reporting-video',
  source: {
    id: 'source-google-serp-001',
    kind: 'search',
    label: 'Google search result: restoration reporting software video',
    sourceUrl: 'https://example.com/search-result',
    capturedAt: '2026-05-21T09:15:00.000Z',
    permissionContext: 'public',
  },
  capturedAt: '2026-05-21T09:16:00.000Z',
  business: 'Synthex',
  client: 'RestoreAssist',
  product: 'RestoreAssist reporting workflow',
  audienceSegment: 'Restoration business owners',
  narrative: 'Owners are looking for faster evidence-backed reporting workflows',
  content: 'Competitor and search data show repeated demand for reporting proof.',
  freshness: 0.9,
  confidence: 0.82,
  commercialImpact: 0.78,
  creativePotential: 0.74,
  risk: 0.18,
  status: 'captured',
  evidenceRefs: ['docs/marketing-agency/RESTOREASSIST-REPORT-READINESS-CHECKLIST.md'],
};

describe('governed signal ledger', () => {
  it('scores a governed signal with risk lowering the total', () => {
    const score = scoreGovernedSignal(baseSignal);

    expect(score.signalId).toBe(baseSignal.id);
    expect(score.total).toBeGreaterThan(0.7);
    expect(score.risk).toBe(0.18);
  });

  it('blocks weak signals that lack evidence and source references', () => {
    const weakSignal: GovernedSignal = {
      ...baseSignal,
      id: 'signal-unsupported-claim',
      source: {
        ...baseSignal.source,
        sourceUrl: undefined,
      },
      confidence: 0.3,
      risk: 0.88,
      evidenceRefs: [],
    };

    const riskState = evaluateSignalRisk(weakSignal);
    const approvalGate = buildSignalApprovalGate(weakSignal);

    expect(riskState.state).toBe('blocked');
    expect(riskState.reasons).toEqual(
      expect.arrayContaining([
        'Signal has no linked evidence references.',
        'Signal source is missing a URL or Wiki path reference.',
        'Signal confidence is below the opportunity threshold.',
        'Signal risk is too high for opportunity conversion.',
      ])
    );
    expect(approvalGate.status).toBe('blocked');
  });

  it('keeps medium-risk signals as draft intelligence with a warning', () => {
    const mediumRiskSignal: GovernedSignal = {
      ...baseSignal,
      id: 'signal-medium-risk',
      risk: 0.52,
    };

    const gate = buildSignalApprovalGate(mediumRiskSignal);

    expect(gate.status).toBe('warn');
    expect(gate.blockedReasons).toHaveLength(0);
    expect(gate.warnings[0]).toContain('draft intelligence');
  });

  it('ranks strong evidence-backed signals ahead of weaker signals', () => {
    const lowerImpactSignal: GovernedSignal = {
      ...baseSignal,
      id: 'signal-lower-impact',
      commercialImpact: 0.32,
      creativePotential: 0.3,
    };

    const ranked = rankGovernedSignals([lowerImpactSignal, baseSignal]);

    expect(ranked[0].signal.id).toBe(baseSignal.id);
    expect(ranked[0].canConvertToOpportunity).toBe(true);
    expect(ranked[1].signal.id).toBe(lowerImpactSignal.id);
  });

  it('converts only governed and approved signals into opportunities', () => {
    const blockedSignal: GovernedSignal = {
      ...baseSignal,
      id: 'signal-blocked',
      confidence: 0.1,
      evidenceRefs: [],
    };

    const opportunities = convertSignalsToOpportunities([blockedSignal, baseSignal]);

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      id: `opportunity-${baseSignal.id}`,
      signalId: baseSignal.id,
      title: baseSignal.narrative,
      approvalGate: { status: 'pass' },
    });
    expect(opportunities[0].nextAction).toContain('draft scenario');
  });
});
