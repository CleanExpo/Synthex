import { fireEvent, render, screen } from '@testing-library/react';
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

    expect(await screen.findByText('Spring launch')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn · 1 post')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Spring launch'));

    expect(
      screen.getByDisplayValue('Post copy for the spring launch')
    ).toBeInTheDocument();
    expect(screen.getByText('LinkedIn · Scheduled')).toBeInTheDocument();
  });
});
