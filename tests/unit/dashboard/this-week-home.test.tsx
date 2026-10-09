import { render, screen } from '@testing-library/react';
import { DashboardThisWeekHome } from '@/components/dashboard/DashboardThisWeekHome';
import type { DashboardStats } from '@/components/dashboard/types';

jest.mock('@/hooks/useActiveBusiness', () => ({
  useActiveBusiness: () => ({ activeOrganizationId: 'org-1' }),
}));

jest.mock('@/hooks/use-brand-profile', () => ({
  useBrandProfile: () => ({ profile: { name: 'Acme Restorations' } }),
}));

jest.mock('@/components/dashboard/WelcomeCard', () => ({
  WelcomeCard: () => <div>welcome-card</div>,
}));

jest.mock('@/components/dashboard/get-started-checklist', () => ({
  GetStartedChecklist: () => <div>get-started</div>,
}));

jest.mock('swr', () => ({
  __esModule: true,
  default: () => ({
    data: {
      posts: [
        { id: 'fail-1', content: 'The reel did not go out', status: 'failed' },
      ],
    },
  }),
}));

const emptyStats: DashboardStats = {
  totalPosts: 0,
  scheduledPosts: 0,
  engagementRate: 0,
  followers: 0,
  connectedPlatforms: 0,
  activeCampaigns: 0,
  trendingTopics: [],
  recentActivity: [],
};

describe('DashboardThisWeekHome', () => {
  it('tells a new user to connect before they can publish', () => {
    render(<DashboardThisWeekHome stats={emptyStats} />);
    expect(screen.getByText('No accounts ready')).toBeInTheDocument();
    expect(screen.getByText('Connect an account')).toBeInTheDocument();
    expect(screen.getByText(/green check/i)).toBeInTheDocument();
    expect(screen.getByText('Write your first post')).toBeInTheDocument();
    expect(
      screen.getByText(/one booked post on Calendar/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/after a few published posts/i)
    ).toBeInTheDocument();
    expect(screen.getByText('get-started')).toBeInTheDocument();
  });

  it('shows booked and posted counts for a returning user', () => {
    render(
      <DashboardThisWeekHome
        stats={{
          ...emptyStats,
          connectedPlatforms: 2,
          scheduledPosts: 3,
          totalPosts: 8,
        }}
      />
    );
    expect(screen.getByText('2 ready to post')).toBeInTheDocument();
    expect(screen.getByText('3 scheduled')).toBeInTheDocument();
    expect(screen.getByText('8 posts so far')).toBeInTheDocument();
    expect(screen.queryByText('get-started')).not.toBeInTheDocument();
  });

  it('lists failed posts on Home so approvals are not a new nav item', () => {
    render(
      <DashboardThisWeekHome
        stats={{
          ...emptyStats,
          connectedPlatforms: 1,
          scheduledPosts: 1,
          totalPosts: 2,
        }}
      />
    );
    expect(screen.getByText('Needs you')).toBeInTheDocument();
    expect(screen.getByText(/The reel did not go out/)).toBeInTheDocument();
    expect(screen.getByText('Fix on Calendar')).toBeInTheDocument();
  });
});
