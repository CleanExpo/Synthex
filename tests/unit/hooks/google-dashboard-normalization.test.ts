import { normalizeGBPInsightsTotals } from '@/hooks/useGBPInsights';
import {
  normalizeSearchAnalyticsData,
  type SearchAnalyticsData,
} from '@/hooks/useSearchConsole';

describe('Google dashboard data normalization', () => {
  it('preserves missing GBP totals without fabricating zeroes', () => {
    expect(
      normalizeGBPInsightsTotals({
        searchViews: 12,
        websiteClicks: undefined as unknown as number,
      })
    ).toEqual({
      searchViews: 12,
      mapsViews: null,
      websiteClicks: null,
      phoneClicks: null,
      directionClicks: null,
    });
  });

  it('withholds incomplete Search Console totals and rows', () => {
    expect(
      normalizeSearchAnalyticsData({
        totals: {
          clicks: 4,
        } as unknown as SearchAnalyticsData['totals'],
        rows: [
          {
            keys: ['restore assist'],
            impressions: 99,
          } as unknown as SearchAnalyticsData['rows'][number],
        ],
      })
    ).toBeNull();
  });

  it('withholds non-finite GBP numbers instead of displaying them', () => {
    const totals = normalizeGBPInsightsTotals({
      searchViews: NaN,
      mapsViews: Infinity,
      websiteClicks: -Infinity,
    });
    expect(totals.searchViews).toBeNull();
    expect(totals.mapsViews).toBeNull();
    expect(totals.websiteClicks).toBeNull();
  });

  it('preserves measured zero', () => {
    expect(normalizeGBPInsightsTotals({ phoneClicks: 0 }).phoneClicks).toBe(0);
    const totals = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    expect(normalizeSearchAnalyticsData({ totals, rows: [] })?.totals).toEqual(
      totals
    );
  });
});
