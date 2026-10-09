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
  });

  it('opens a brief, not empty post boxes', async () => {
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
    expect(screen.getByText(/job of this run/i)).toBeInTheDocument();
    expect(screen.getByText(/who it is for/i)).toBeInTheDocument();
    expect(screen.queryByText('Post 1')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create campaign/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/after-school rush/i)).toBeInTheDocument();
  });

  it('puts the new campaign on the list and shows formatted captions', async () => {
    const user = userEvent.setup();
    const created = {
      id: 'camp-1',
      name: 'After-school rush',
      description: 'Get parents in after school pickup',
      platform: 'instagram',
      status: 'draft',
      content: JSON.stringify({
        cards: [
          {
            text: 'Pickup stop. Babycino is on us.\n#AfterSchool',
            platform: 'instagram',
          },
        ],
      }),
    };
    global.fetch = jest.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/ai/generate-content')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              content: 'Pickup stop. Babycino is on us.',
              variations: [],
            },
          }),
        };
      }
      if (url.includes('/api/campaigns') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ campaign: created }) };
      }
      return { ok: true, json: async () => ({ campaigns: [] }) };
    }) as jest.Mock;

    render(<CampaignsPage />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /new campaign/i })
      ).toBeInTheDocument()
    );
    await user.click(
      screen.getAllByRole('button', { name: /new campaign/i })[0]
    );
    await user.click(screen.getByRole('button', { name: /create campaign/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 2, name: 'After-school rush' })
      ).toBeInTheDocument()
    );
    expect(screen.getAllByText(/Pickup stop/i).length).toBeGreaterThan(0);
    expect(screen.queryByDisplayValue(/Pickup stop/i)).not.toBeInTheDocument();
  });
});
