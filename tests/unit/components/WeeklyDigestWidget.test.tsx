/**
 * DOM render tests for the Weekly Performance Digest dashboard widget (SYN-495).
 *
 * The widget surfaces the client's latest ai_weekly_digests row (the same digest
 * emailed each Monday) via GET /api/ai/pm/digest. These tests cover the pure
 * presentational card plus the container's loading and empty states — the
 * worktree has no DB/secrets to run the authenticated fetch.
 */
import { render, screen } from '@testing-library/react';
import useSWR from 'swr';
import {
  WeeklyDigestCard,
  WeeklyDigestWidget,
  type WeeklyDigest,
} from '@/components/dashboard/WeeklyDigestWidget';

jest.mock('swr');
const mockUseSWR = useSWR as unknown as jest.Mock;

afterEach(() => {
  mockUseSWR.mockReset();
});

function digest(over: Partial<WeeklyDigest> = {}): WeeklyDigest {
  return {
    id: 'digest-1',
    weekStart: '2026-06-30T00:00:00.000Z',
    weekEnd: '2026-07-06T00:00:00.000Z',
    summary: 'Engagement rose this week off the back of your video posts.',
    highlights: [
      { metric: 'Total reach', value: '12,400', change: '+18%', trend: 'up' },
      { metric: 'Engagement rate', value: '4.2%', change: '-0.3%', trend: 'down' },
      { metric: 'Posts published', value: '9', change: 'steady', trend: 'flat' },
    ],
    actionItems: [
      {
        title: 'Reply to 3 pending comments',
        description: 'Responses within 24h lift reach on Instagram.',
        priority: 'high',
      },
    ],
    opportunities: [
      {
        title: 'Double down on short-form video',
        description: 'Video posts outperformed images by 2.4x this week.',
        potentialImpact: 'Higher reach',
      },
    ],
    createdAt: '2026-07-07T08:00:00.000Z',
    ...over,
  };
}

describe('WeeklyDigestCard (presentational)', () => {
  it('renders the summary, highlights, action item and opportunity', () => {
    render(<WeeklyDigestCard digest={digest()} />);

    expect(screen.getByText(/Weekly Performance Digest/i)).toBeInTheDocument();
    expect(screen.getByText(/Engagement rose this week/i)).toBeInTheDocument();
    // Highlight metric + value
    expect(screen.getByText('Total reach')).toBeInTheDocument();
    expect(screen.getByText('12,400')).toBeInTheDocument();
    // Top action item
    expect(screen.getByText('Reply to 3 pending comments')).toBeInTheDocument();
    // Top opportunity
    expect(
      screen.getByText('Double down on short-form video')
    ).toBeInTheDocument();
    // Ties back to the emailed digest
    expect(
      screen.getByText(/Delivered to your inbox every Monday/i)
    ).toBeInTheDocument();
  });

  it('renders without highlights, action items or opportunities', () => {
    render(
      <WeeklyDigestCard
        digest={digest({ highlights: [], actionItems: [], opportunities: [] })}
      />
    );
    expect(screen.getByText(/Engagement rose this week/i)).toBeInTheDocument();
    expect(screen.queryByText(/Performance highlights/i)).not.toBeInTheDocument();
  });
});

describe('WeeklyDigestWidget (container)', () => {
  it('shows a skeleton while loading', () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<WeeklyDigestWidget />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows the empty state when there is no digest yet', () => {
    mockUseSWR.mockReturnValue({
      data: { success: true, digest: null },
      isLoading: false,
    });
    render(<WeeklyDigestWidget />);
    expect(screen.getByText(/No digest yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/first weekly performance digest will appear here/i)
    ).toBeInTheDocument();
  });

  it('shows the empty state when the request is not successful (plan-gated)', () => {
    mockUseSWR.mockReturnValue({
      data: { success: false, digest: null },
      isLoading: false,
    });
    render(<WeeklyDigestWidget />);
    expect(screen.getByText(/No digest yet/i)).toBeInTheDocument();
  });

  it('renders the digest card when data is present', () => {
    mockUseSWR.mockReturnValue({
      data: { success: true, digest: digest() },
      isLoading: false,
    });
    render(<WeeklyDigestWidget />);
    expect(screen.getByText(/Engagement rose this week/i)).toBeInTheDocument();
  });
});
