import {
  buildResearchBridge,
  dedupeTrendInsights,
  runResearchBridge,
  type BridgeTrendInsight,
  type BuildResearchBridgeContext,
} from '@/lib/auto-research/research-bridge';

const NOW = new Date('2026-06-16T00:00:00.000Z');

function insight(over: Partial<BridgeTrendInsight> = {}): BridgeTrendInsight {
  return {
    id: 'i1',
    platform: 'instagram',
    category: 'hook',
    insight: 'Short hooks under 3 seconds win',
    confidence: 0.8,
    dataPoints: 40,
    runId: 'run-1',
    createdAt: NOW,
    ...over,
  };
}

const ctx: BuildResearchBridgeContext = {
  runId: 'run-1',
  organizationId: 'org-1',
  orgLabel: 'Acme',
  now: NOW,
};

describe('dedupeTrendInsights', () => {
  it('collapses duplicates by platform+category+text, keeping highest confidence', () => {
    const out = dedupeTrendInsights([
      insight({ id: 'a', confidence: 0.6 }),
      insight({ id: 'b', confidence: 0.9 }),
      insight({ id: 'c', platform: 'tiktok' }),
    ]);

    expect(out).toHaveLength(2);
    const igniteIg = out.find(i => i.platform === 'instagram');
    expect(igniteIg?.id).toBe('b');
    expect(igniteIg?.confidence).toBe(0.9);
  });
});

describe('buildResearchBridge', () => {
  it('ranks higher-confidence signals first', () => {
    const build = buildResearchBridge(
      [
        insight({ id: 'low', confidence: 0.6, insight: 'A' }),
        insight({ id: 'high', confidence: 0.95, insight: 'B' }),
      ],
      ctx
    );

    expect(build.rankedSignals[0].signal.id).toBe('trend-high');
    expect(build.rankedSignals[0].score.total).toBeGreaterThanOrEqual(
      build.rankedSignals[1].score.total
    );
  });

  it('flags no_findings when there are no insights', () => {
    const build = buildResearchBridge([], ctx);

    expect(build.discovered).toBe(0);
    expect(build.opportunities).toHaveLength(0);
    expect(build.failureModes).toContain('no_findings');
  });

  it('flags low_confidence and creates no opportunity below threshold', () => {
    const build = buildResearchBridge(
      [insight({ confidence: 0.3 })],
      ctx
    );

    expect(build.discovered).toBe(1);
    expect(build.belowThreshold).toBe(1);
    expect(build.opportunities).toHaveLength(0);
    expect(build.failureModes).toContain('low_confidence');
  });

  it('creates a reviewable opportunity with evidence and a handoff packet', () => {
    const build = buildResearchBridge([insight({ id: 'h1' })], ctx);

    expect(build.opportunities).toHaveLength(1);
    const opp = build.opportunities[0];
    expect(opp.evidenceRefs).toEqual(
      expect.arrayContaining([
        'auto-research:run:run-1',
        'trend-insight:h1',
        'platform:instagram',
      ])
    );
    expect(opp.nextAction).toBeTruthy();

    const handoff = build.handoffs[0];
    expect(handoff.opportunityExternalId).toBe(opp.id);
    expect(handoff.signalExternalId).toBe('trend-h1');
    expect(handoff.ownerRoute).toBe('marketing-strategy'); // hook → strategy
    expect(handoff.sourceRunId).toBe('run-1');
    expect(handoff.approvalStatus).not.toBe('blocked');
    expect(handoff.linearEnabled).toBe(false);
  });

  it('routes creative categories to the creative-director', () => {
    const build = buildResearchBridge(
      [insight({ id: 'v', category: 'visual_style' })],
      ctx
    );

    expect(build.handoffs[0].ownerRoute).toBe('creative-director');
  });
});

describe('runResearchBridge', () => {
  it('persists ranked signals + opportunities with owner-route metadata', async () => {
    const persist = jest.fn().mockResolvedValue({
      signalsPersisted: 1,
      opportunitiesPersisted: 1,
    });
    const appendObsidian = jest
      .fn()
      .mockResolvedValue({ enabled: true, ok: true, status: 200 });

    const receipt = await runResearchBridge(
      {
        runId: 'run-1',
        organizationId: 'org-1',
        insights: [insight({ id: 'h1' })],
        obsidianEnabled: true,
        now: NOW,
      },
      { persist, appendObsidian }
    );

    expect(persist).toHaveBeenCalledTimes(1);
    const arg = persist.mock.calls[0][0];
    expect(arg.organizationId).toBe('org-1');
    expect(arg.rankedSignals).toHaveLength(1);
    expect(arg.opportunities).toHaveLength(1);
    expect(arg.metadata.source).toBe('auto-research');
    expect(arg.metadata.sourceRunId).toBe('run-1');
    expect(Object.values(arg.metadata.ownerRoutes)).toContain(
      'marketing-strategy'
    );

    expect(receipt.opportunitiesCreated).toBe(1);
    expect(receipt.waitingForApproval).toBe(1);
    expect(receipt.obsidian.ok).toBe(true);
    expect(receipt.failureModes).not.toContain('obsidian_unavailable');
  });

  it('records an obsidian_unavailable failure when the writeback fails', async () => {
    const persist = jest.fn().mockResolvedValue({
      signalsPersisted: 1,
      opportunitiesPersisted: 1,
    });
    const appendObsidian = jest
      .fn()
      .mockResolvedValue({ enabled: true, ok: false, error: 'HTTP 500' });

    const receipt = await runResearchBridge(
      {
        runId: 'run-1',
        organizationId: 'org-1',
        insights: [insight({ id: 'h1' })],
        obsidianEnabled: true,
        now: NOW,
      },
      { persist, appendObsidian }
    );

    expect(receipt.obsidian.ok).toBe(false);
    expect(receipt.failureModes).toContain('obsidian_unavailable');
  });

  it('does not attempt persistence or writeback when there are no opportunities', async () => {
    const persist = jest.fn();
    const appendObsidian = jest.fn();

    const receipt = await runResearchBridge(
      {
        runId: 'run-1',
        organizationId: 'org-1',
        insights: [insight({ confidence: 0.2 })],
        obsidianEnabled: true,
        now: NOW,
      },
      { persist, appendObsidian }
    );

    expect(persist).not.toHaveBeenCalled();
    expect(appendObsidian).not.toHaveBeenCalled();
    expect(receipt.opportunitiesCreated).toBe(0);
    expect(receipt.failureModes).toContain('low_confidence');
    expect(receipt.obsidian.enabled).toBe(false);
  });
});
