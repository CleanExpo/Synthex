import { render, screen } from '@testing-library/react';
import CampaignsPage from '@/app/dashboard/campaigns/page';

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

  it('lists campaigns with their status', async () => {
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
              posts: [{ id: 'p1', status: 'scheduled', platform: 'linkedin' }],
            },
          ],
        })
      )
    ) as unknown as typeof fetch;

    render(<CampaignsPage />);

    expect(await screen.findByText('Spring launch')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });
});
