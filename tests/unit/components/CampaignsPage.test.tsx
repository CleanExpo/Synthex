import { fireEvent, render, screen } from '@testing-library/react';
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

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Partial<Response>;
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('CampaignsPage', () => {
  it('renders the empty state when no campaigns exist', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(jsonResponse({ campaigns: [] }))
    ) as unknown as typeof fetch;

    render(<CampaignsPage />);

    expect(await screen.findByText(/no campaigns yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /^campaigns$/i })
    ).toBeInTheDocument();
  });

  // A campaign is a named set of post cards (65a95b665), so the row summarises
  // its cards instead of carrying a raw campaign status badge, and each card
  // speaks the customer post language (13bb65049) rather than a database value.
  it('lists campaigns as a named set of post cards, with post status in customer language', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        jsonResponse({
          campaigns: [
            {
              id: 'c1',
              name: 'Spring launch',
              platform: 'linkedin',
              content: 'Hello',
              status: 'active',
              posts: [
                {
                  id: 'p1',
                  content: 'Post copy for the spring launch',
                  status: 'scheduled',
                  platform: 'linkedin',
                },
              ],
            },
          ],
        })
      )
    ) as unknown as typeof fetch;

    render(<CampaignsPage />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Spring launch' })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/LinkedIn/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('Spring launch')[0]);

    expect(
      screen.getAllByText('Post copy for the spring launch').length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/LinkedIn · Scheduled/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^schedule$/i })).toHaveLength(
      1
    );
  });

  it('asks before deleting one or more selected campaigns', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        jsonResponse({
          campaigns: [
            {
              id: 'c1',
              name: 'Spring launch',
              platform: 'linkedin',
              content: 'Hello',
              status: 'draft',
            },
            {
              id: 'c2',
              name: 'Winter offer',
              platform: 'instagram',
              content: 'Hi',
              status: 'draft',
            },
          ],
        })
      )
    ) as unknown as typeof fetch;

    render(<CampaignsPage />);
    expect(
      await screen.findByLabelText('Select Spring launch')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select Spring launch'));
    fireEvent.click(screen.getByLabelText('Select Winter offer'));
    fireEvent.click(
      screen.getByRole('button', { name: /delete 2 selected campaigns/i })
    );
    expect(
      screen.getByRole('heading', { name: /delete 2 campaigns/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/spring launch/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: /keep them/i })
    ).toBeInTheDocument();
  });
});
