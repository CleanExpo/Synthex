import { render, screen, waitFor } from '@testing-library/react';
import AnalyticsPage from '@/app/dashboard/analytics/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/hooks/use-dashboard', () => ({
  usePerformanceAnalytics: jest.fn(),
  useRealtimeAnalytics: () => ({ data: null }),
  useFollowerGrowth: () => ({
    data: {
      series: [],
      growth: { current: 0, previous: 0, change: 0, changePercent: 0 },
      hasEnoughData: false,
      pointCount: 0,
    },
  }),
}));

jest.mock('@/components/analytics', () => {
  const actual = jest.requireActual('@/components/analytics');
  return {
    ...actual,
    EngagementChart: ({ data }: { data: Array<{ engagement: number }> }) => (
      <div>Engagement {data.reduce((n, d) => n + d.engagement, 0)}</div>
    ),
    PlatformChart: () => <div>Platforms</div>,
    GrowthChart: () => <div>Growth</div>,
    TopPosts: () => <div>Top posts</div>,
    MetricsTable: ({
      engagementData,
    }: {
      engagementData?: Array<{ likes: number }>;
    }) => (
      <div>Likes {engagementData?.reduce((n, r) => n + r.likes, 0) ?? 0}</div>
    ),
    PostDetailSheet: () => null,
    AnalyticsHeader: () => <div>Filters</div>,
    AnalyticsStats: actual.AnalyticsStats,
  };
});

const { usePerformanceAnalytics } = jest.requireMock(
  '@/hooks/use-dashboard'
) as {
  usePerformanceAnalytics: jest.Mock;
};

describe('AnalyticsPage', () => {
  it('keeps filters visible when there are no published numbers', async () => {
    usePerformanceAnalytics.mockReturnValue({
      data: {
        data: {
          overview: {
            totalPosts: 0,
            totalEngagement: 0,
            averageEngagementRate: 0,
            totalReach: 0,
            totalImpressions: 0,
          },
          growth: {
            engagementChange: 0,
            reachChange: 0,
            postsChange: 0,
            trend: 'stable',
          },
          timeline: [],
          platforms: [],
          topContent: [],
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AnalyticsPage />);
    expect(
      await screen.findByRole('heading', { name: /^analytics$/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/nothing published/i)).toBeInTheDocument();
    expect(screen.getByText(/write a post/i)).toBeInTheDocument();
  });

  it('shows real likes from the performance payload, not a guessed split', async () => {
    usePerformanceAnalytics.mockReturnValue({
      data: {
        data: {
          overview: {
            totalPosts: 1,
            totalEngagement: 40,
            averageEngagementRate: 2,
            totalReach: 200,
            totalImpressions: 200,
          },
          growth: {
            engagementChange: 10,
            reachChange: 5,
            postsChange: 0,
            trend: 'up',
          },
          timeline: [
            {
              date: '2026-09-01',
              engagement: 40,
              reach: 200,
              impressions: 200,
              posts: 1,
            },
          ],
          platforms: [
            {
              platform: 'instagram',
              engagement: 40,
              engagementRate: 2,
              posts: 1,
              likes: 30,
              comments: 8,
              shares: 2,
              clicks: 4,
              reach: 200,
              bestTime: '9:00',
              growthPercent: 0,
            },
          ],
          topContent: [
            {
              id: 'p1',
              content: 'Pickup stop',
              platform: 'instagram',
              engagement: 40,
              engagementRate: 2,
              publishedAt: '2026-09-01',
            },
          ],
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AnalyticsPage />);
    await waitFor(() =>
      expect(screen.getByText(/likes 30/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/engagement 40/i)).toBeInTheDocument();
  });
});
