import {
  mapApifyRecordToGovernedSignal,
  mapApifyRecordsToGovernedSignals,
  type ApifySignalContext,
} from '@/lib/marketing-agency/intelligence/apify-signal-adapter';
import { convertSignalsToOpportunities } from '@/lib/marketing-agency/intelligence/signal-ledger';
import type { ApifyCreativeRecord } from '@/lib/marketing-agency/research/apify-intelligence';

const context: ApifySignalContext = {
  business: 'Synthex',
  client: 'RestoreAssist',
  product: 'RestoreAssist reporting workflow',
  audienceSegment: 'Restoration business owners',
  narrative: 'Owners are searching for evidence-backed reporting proof',
  capturedAt: '2026-05-22T08:30:00.000Z',
  evidenceRefs: ['docs/marketing-agency/APIFY-LIVE-INTELLIGENCE-2026-05-16.md'],
};

const strongRecord: ApifyCreativeRecord = {
  platform: 'google',
  sourceUrl: 'https://example.com/restore-reporting-video',
  author: 'Search result',
  content:
    'Restoration operators are searching for field reporting software that turns site evidence into client-ready reports.',
  postedAt: '2026-05-20T00:00:00.000Z',
  impressions: 2400,
  views: 900,
  likes: 120,
  comments: 18,
  shares: 9,
  saves: 7,
  engagement: 154,
  rawMetricKeys: ['impressions', 'views', 'likes', 'comments', 'shares'],
};

describe('Apify governed signal adapter', () => {
  it('maps an Apify creative record into a governed signal with source evidence', () => {
    const signal = mapApifyRecordToGovernedSignal(strongRecord, context);

    expect(signal.id).toContain('signal-apify-google');
    expect(signal.source.kind).toBe('search');
    expect(signal.source.sourceUrl).toBe(strongRecord.sourceUrl);
    expect(signal.business).toBe('Synthex');
    expect(signal.client).toBe('RestoreAssist');
    expect(signal.evidenceRefs).toEqual(context.evidenceRefs);
    expect(signal.confidence).toBeGreaterThan(0.55);
    expect(signal.risk).toBeLessThan(0.45);
  });

  it('keeps weak Apify records blocked once they reach the signal ledger', () => {
    const weakSignal = mapApifyRecordToGovernedSignal(
      {
        platform: 'facebook',
        content: '',
        engagement: 0,
        rawMetricKeys: [],
      },
      context
    );

    const opportunities = convertSignalsToOpportunities([weakSignal]);

    expect(weakSignal.source.kind).toBe('social');
    expect(weakSignal.confidence).toBeLessThan(0.55);
    expect(weakSignal.risk).toBeGreaterThanOrEqual(0.75);
    expect(opportunities).toHaveLength(0);
  });

  it('adds a record discriminator so repeated Apify content maps to unique ids', () => {
    const signals = mapApifyRecordsToGovernedSignals([strongRecord, strongRecord], context);

    expect(signals[0].id).not.toBe(signals[1].id);
    expect(signals[0].source.id).not.toBe(signals[1].source.id);
  });

  it('converts strong Apify signals into governed opportunities', () => {
    const signals = mapApifyRecordsToGovernedSignals([strongRecord], context);
    const opportunities = convertSignalsToOpportunities(signals);

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      signalId: signals[0].id,
      title: context.narrative,
      approvalGate: { status: 'pass' },
    });
    expect(opportunities[0].evidenceRefs).toEqual(context.evidenceRefs);
  });
});
