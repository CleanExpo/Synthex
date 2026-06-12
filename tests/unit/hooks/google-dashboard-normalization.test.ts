import { normalizeGBPInsightsTotals } from '@/hooks/useGBPInsights';
import {
  normalizeSearchAnalyticsData,
  type SearchAnalyticsData,
} from '@/hooks/useSearchConsole';

describe('Google dashboard data normalization', () => {
  it('fills missing GBP insight totals with zeroes', () => {
    expect(
      normalizeGBPInsightsTotals({
        searchViews: 12,
        websiteClicks: undefined as unknown as number,
      })
    ).toEqual({
      searchViews: 12,
      mapsViews: 0,
      websiteClicks: 0,
      phoneClicks: 0,
      directionClicks: 0,
    });
  });

  it('fills missing Search Console totals and rows with safe numbers', () => {
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
    ).toEqual({
      totals: {
        clicks: 4,
        impressions: 0,
        ctr: 0,
        position: 0,
      },
      rows: [
        {
          keys: ['restore assist'],
          clicks: 0,
          impressions: 99,
          ctr: 0,
          position: 0,
        },
      ],
    });
  });
});
