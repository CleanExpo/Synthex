import {
  deriveApifyDesignInsights,
  normalizeApifyCreativeRecord,
  rankApifyCreativeRecords,
} from '@/lib/marketing-agency/research/apify-intelligence';

describe('marketing agency Apify intelligence', () => {
  it('normalizes mixed Apify actor metrics into comparable creative records', () => {
    const record = normalizeApifyCreativeRecord('tiktok', {
      text: 'Stop rebuilding restoration reports from scattered site notes.',
      author: { username: 'fieldops' },
      url: 'https://example.com/video',
      playCount: '12.4k',
      likesCount: '1.2k',
      commentsCount: 34,
      sharesCount: 12,
      averageWatchTime: '8',
    });

    expect(record.content).toContain('restoration reports');
    expect(record.author).toBe('fieldops');
    expect(record.views).toBe(12400);
    expect(record.likes).toBe(1200);
    expect(record.engagement).toBe(1246);
    expect(record.averageWatchTimeSec).toBe(8);
  });

  it('ranks records by impressions, views, watch signals, and engagement', () => {
    const records = [
      normalizeApifyCreativeRecord('facebook', {
        content: 'A',
        impressions: 1000,
        views: 200,
        likes: 10,
      }),
      normalizeApifyCreativeRecord('linkedin', {
        content: 'B',
        impressions: 500,
        views: 2000,
        averageWatchTime: 12,
        likes: 50,
      }),
    ];

    const ranked = rankApifyCreativeRecords(records);

    expect(ranked.highestImpressions[0].content).toBe('A');
    expect(ranked.highestViews[0].content).toBe('B');
    expect(ranked.longestWatchSignals[0].content).toBe('B');
    expect(ranked.highestEngagement[0].content).toBe('B');
    expect(deriveApifyDesignInsights(ranked).length).toBeGreaterThan(0);
  });
});
