import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CampaignGenerator } from '@/components/campaigns/CampaignGenerator';

type FetchMock = jest.Mock<Promise<Partial<Response>>, [string, RequestInit?]>;

function jsonResponse(
  body: unknown,
  ok = true,
  status = 200
): Partial<Response> {
  return { ok, status, json: async () => body };
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('CampaignGenerator', () => {
  it('walks the steps and POSTs the real campaign schema', async () => {
    const onCreated = jest.fn();
    const fetchMock: FetchMock = jest.fn((url, init) => {
      if (url === '/api/campaigns' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            success: true,
            campaign: {
              id: 'camp-1',
              name: 'Spring launch',
              platform: 'linkedin',
              content: 'Big news',
              status: 'draft',
            },
          })
        );
      }
      throw new Error(`unexpected fetch ${url} ${init?.method ?? 'GET'}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CampaignGenerator onCreated={onCreated} />);

    // Step 1: basics
    fireEvent.change(screen.getByLabelText('Campaign name'), {
      target: { value: 'Spring launch' },
    });
    fireEvent.change(screen.getByLabelText('Platform'), {
      target: { value: 'linkedin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2: content
    fireEvent.change(screen.getByLabelText('Content'), {
      target: { value: 'Big news' },
    });
    fireEvent.change(screen.getByLabelText('Hashtags'), {
      target: { value: '#launch, spring' },
    });
    fireEvent.click(screen.getByRole('button', { name: /review/i }));

    // Step 3: generate
    fireEvent.click(screen.getByRole('button', { name: /generate campaign/i }));

    await screen.findByText(/created as a draft/i);

    const call = fetchMock.mock.calls.find(
      ([u, init]) => u === '/api/campaigns' && init?.method === 'POST'
    );
    const sent = JSON.parse(call![1]!.body as string);
    expect(sent.name).toBe('Spring launch');
    expect(sent.platform).toBe('linkedin');
    expect(sent.content).toBe('Big news');
    // Hashtags are parsed (leading '#' stripped) into settings.hashtags.
    expect(sent.settings.hashtags).toEqual(['launch', 'spring']);
    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'camp-1' })
      )
    );
  });

  it('shows the generating progress indicator while the POST is in flight', async () => {
    let resolveFetch: (v: Partial<Response>) => void = () => {};
    const pending = new Promise<Partial<Response>>(res => {
      resolveFetch = res;
    });
    const fetchMock: FetchMock = jest.fn(() => pending);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CampaignGenerator />);
    fireEvent.change(screen.getByLabelText('Campaign name'), {
      target: { value: 'X' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate campaign/i }));

    expect(
      await screen.findByText(/generating your campaign/i)
    ).toBeInTheDocument();

    resolveFetch(
      jsonResponse({
        campaign: {
          id: 'c',
          name: 'X',
          platform: 'multi',
          content: null,
          status: 'draft',
        },
      })
    );
    await screen.findByText(/created as a draft/i);
  });

  it('surfaces a tier/validation gate honestly on non-2xx', async () => {
    const fetchMock: FetchMock = jest.fn(() =>
      Promise.resolve(
        jsonResponse(
          { error: 'Campaign limit reached for your plan' },
          false,
          402
        )
      )
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CampaignGenerator />);
    fireEvent.change(screen.getByLabelText('Campaign name'), {
      target: { value: 'Y' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate campaign/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Campaign limit reached for your plan'
    );
    // No fake success.
    expect(screen.queryByText(/created as a/i)).not.toBeInTheDocument();
  });
});
