/**
 * Unit tests for the agentic-marketing-intelligence GSC→scoring pipeline (INFRA-2)
 * and the crawl-adapter contract (INFRA-1).
 *
 * Verifies the integrity guarantee: real GSC data produces meaningful priorities,
 * while pages with no data are marked DATA_REQUIRED and blocked from auto-execution.
 */

import {
  gscRowsToPageRows,
  gscToPageMetrics,
  type GscAnalyticsRow,
  type PageClassification,
} from '../../lib/marketing-intelligence/gsc-adapter';
import { buildBacklog } from '../../lib/marketing-intelligence/pipeline';
import {
  cwvVerdict,
  mergeCrawlIntoMetrics,
} from '../../lib/marketing-intelligence/crawl-adapter';
import type { PageMetrics } from '../../lib/marketing-intelligence/types';

// --- Fixtures: GSC SearchAnalyticsRow shape (dimensions: ['page']) ---

const currentRows: GscAnalyticsRow[] = [
  // pricing page: CTR collapsed + position worsened vs previous period (decay candidate)
  {
    keys: ['https://synthex.social/pricing'],
    clicks: 50,
    impressions: 5000,
    ctr: 0.01,
    position: 8,
  },
  // home: healthy + stable
  {
    keys: ['https://synthex.social/'],
    clicks: 300,
    impressions: 6000,
    ctr: 0.05,
    position: 3,
  },
];

const previousRows: GscAnalyticsRow[] = [
  {
    keys: ['https://synthex.social/pricing'],
    clicks: 150,
    impressions: 5200,
    ctr: 0.0288,
    position: 6,
  },
  {
    keys: ['https://synthex.social/'],
    clicks: 300,
    impressions: 6000,
    ctr: 0.05,
    position: 3,
  },
];

const classify = (page: string): PageClassification | undefined => {
  if (page.endsWith('/pricing')) {
    return {
      pageType: 'service',
      funnelStage: 'transactional',
      serpDominantIntent: 'transactional',
      intentMatch: 0.8,
      authorityGap: 0.6,
      businessImportance: 0.9,
    };
  }
  return {
    pageType: 'home',
    funnelStage: 'navigational',
    businessImportance: 0.5,
  };
};

describe('gsc-adapter', () => {
  it('maps page-dimension rows to GscPageRow using keys[0]', () => {
    const rows = gscRowsToPageRows(currentRows);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      page: 'https://synthex.social/pricing',
      impressions: 5000,
    });
  });

  it('drops rows with no page key', () => {
    const rows = gscRowsToPageRows([
      { keys: [], clicks: 1, impressions: 1, ctr: 1, position: 1 },
    ]);
    expect(rows).toHaveLength(0);
  });

  it('merges current + previous into PageMetrics with prev* fields populated', () => {
    const metrics = gscToPageMetrics({
      project: 'Synthex',
      current: gscRowsToPageRows(currentRows),
      previous: gscRowsToPageRows(previousRows),
      classify,
    });
    const pricing = metrics.find(m => m.url.endsWith('/pricing'))!;
    expect(pricing.project).toBe('Synthex');
    expect(pricing.ctr).toBe(0.01);
    expect(pricing.prevCtr).toBeCloseTo(0.0288);
    expect(pricing.prevAvgPosition).toBe(6);
    expect(pricing.funnelStage).toBe('transactional');
  });
});

describe('pipeline.buildBacklog', () => {
  const metrics = gscToPageMetrics({
    project: 'Synthex',
    current: gscRowsToPageRows(currentRows),
    previous: gscRowsToPageRows(previousRows),
    classify,
  });

  it('ranks the decaying high-value page above the healthy page', () => {
    const { prioritised } = buildBacklog(metrics);
    expect(prioritised[0].url).toBe('https://synthex.social/pricing');
    expect(prioritised[0].confidenceAdjustedAction).toBeGreaterThan(
      prioritised[1].confidenceAdjustedAction
    );
  });

  it('marks GSC-backed items PARTIAL (real metrics + rubric, some inputs missing) and does not block them', () => {
    const { prioritised, summary } = buildBacklog(metrics);
    expect(summary.partial).toBe(2);
    expect(summary.dataRequired).toBe(0);
    expect(prioritised.every(a => !a.blockedReason)).toBe(true);
  });

  it('marks a page with NO data DATA_REQUIRED and blocks it from auto-execution', () => {
    const bare: PageMetrics = {
      url: 'https://synthex.social/new',
      project: 'Synthex',
    };
    const { prioritised, summary } = buildBacklog([bare]);
    expect(summary.dataRequired).toBe(1);
    expect(prioritised[0].dataStatus).toBe('DATA_REQUIRED');
    expect(prioritised[0].blockedReason).toMatch(/placeholder/i);
  });

  it('blocks high-risk actions regardless of impact', () => {
    const { summary } = buildBacklog(metrics, { riskScore: 0.85 });
    expect(summary.blocked).toBe(metrics.length);
  });
});

describe('crawl-adapter', () => {
  it('non-destructively fills structural fields the GSC adapter left undefined', () => {
    const metrics: PageMetrics[] = [
      { url: 'https://synthex.social/pricing', project: 'Synthex' },
    ];
    const merged = mergeCrawlIntoMetrics(metrics, [
      {
        url: 'https://synthex.social/pricing',
        monthsSinceUpdate: 20,
        inboundInternalLinks: 4,
        clickDepthFromHome: 2,
      },
    ]);
    expect(merged[0].monthsSinceUpdate).toBe(20);
    expect(merged[0].inboundInternalLinks).toBe(4);
  });

  it('computes a CWV verdict against the A2 thresholds; null when unmeasured', () => {
    expect(
      cwvVerdict({ url: 'x', lcpSeconds: 2.0, inpMs: 150, cls: 0.05 }).allPass
    ).toBe(true);
    expect(
      cwvVerdict({ url: 'x', lcpSeconds: 3.0, inpMs: 150, cls: 0.05 }).allPass
    ).toBe(false);
    expect(cwvVerdict({ url: 'x' }).allPass).toBeNull();
  });
});
