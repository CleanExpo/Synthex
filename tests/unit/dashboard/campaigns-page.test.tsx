import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignsPage from '@/app/dashboard/campaigns/page';

jest.mock('@/hooks/useActiveBusiness', () => ({
  useActiveBusiness: () => ({ activeOrganizationId: 'org-1' }),
}));

jest.mock('@/hooks/use-brand-profile', () => ({
  useBrandProfile: () => ({ profile: { name: 'Acme' } }),
}));

jest.mock('@/components/content', () => ({
  PublishConfirmModal: () => null,
}));

describe('CampaignsPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ campaigns: [] }),
    }) as jest.Mock;
  });

  it('explains a campaign as a named set of posts', async () => {
    render(<CampaignsPage />);
    await waitFor(() =>
      expect(screen.getByText(/named set of posts/i)).toBeInTheDocument()
    );
    expect(
      screen.getByRole('button', { name: /new campaign/i })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/two times on Calendar/i)).toBeInTheDocument()
    );
  });

  it('opens a composer with two post cards', async () => {
    const user = userEvent.setup();
    render(<CampaignsPage />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /new campaign/i })
      ).toBeInTheDocument()
    );
    await user.click(
      screen.getAllByRole('button', { name: /new campaign/i })[0]
    );
    expect(screen.getByText('Post 1')).toBeInTheDocument();
    expect(screen.getByText('Post 2')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /save campaign/i })
    ).toBeInTheDocument();
  });
});
