import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AssetPreview,
  type CampaignAsset,
} from '@/components/campaigns/AssetPreview';

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

const ASSET: CampaignAsset = {
  id: 'asset-1',
  platform: 'instagram',
  content: 'Original copy',
  campaignId: 'camp-1',
  topic: 'spring launch',
};

describe('AssetPreview', () => {
  it('renders assets with Publish + Regenerate actions', () => {
    render(<AssetPreview assets={[ASSET]} />);
    expect(screen.getByText('Original copy')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /publish instagram asset/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /regenerate instagram asset/i })
    ).toBeInTheDocument();
  });

  it('publishes via /api/social/post and marks the asset published on success', async () => {
    const fetchMock: FetchMock = jest.fn((url, init) => {
      if (url === '/api/social/post' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ success: true }));
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AssetPreview assets={[ASSET]} />);
    fireEvent.click(
      screen.getByRole('button', { name: /publish instagram asset/i })
    );

    expect(await screen.findByText(/published/i)).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([u]) => u === '/api/social/post');
    const sent = JSON.parse(call![1]!.body as string);
    expect(sent.content).toBe('Original copy');
    expect(sent.platforms).toEqual(['instagram']);
    expect(sent.campaignId).toBe('camp-1');
  });

  it('surfaces an OAuth-gated publish failure honestly (no fake success)', async () => {
    const fetchMock: FetchMock = jest.fn(() =>
      Promise.resolve(
        jsonResponse(
          { error: 'No connected instagram account. Connect it first.' },
          false,
          400
        )
      )
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AssetPreview assets={[ASSET]} />);
    fireEvent.click(
      screen.getByRole('button', { name: /publish instagram asset/i })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No connected instagram account'
    );
    expect(screen.queryByText(/^Published$/)).not.toBeInTheDocument();
  });

  it('regenerates copy via /api/content/generate and replaces the content', async () => {
    const fetchMock: FetchMock = jest.fn((url, init) => {
      if (url === '/api/content/generate' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({ success: true, content: 'Fresh new copy' })
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AssetPreview assets={[ASSET]} />);
    fireEvent.click(
      screen.getByRole('button', { name: /regenerate instagram asset/i })
    );

    expect(await screen.findByText('Fresh new copy')).toBeInTheDocument();
    // instagram is a valid content/generate platform, so it is sent as-is.
    const call = fetchMock.mock.calls.find(
      ([u]) => u === '/api/content/generate'
    );
    const sent = JSON.parse(call![1]!.body as string);
    expect(sent.platform).toBe('instagram');
    expect(sent.topic).toBe('spring launch');
  });

  it('maps a non-generatable platform (multi) to a valid one for regeneration', async () => {
    const fetchMock: FetchMock = jest.fn(() =>
      Promise.resolve(jsonResponse({ content: 'ok' }))
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <AssetPreview assets={[{ ...ASSET, id: 'a2', platform: 'multi' }]} />
    );
    fireEvent.click(
      screen.getByRole('button', { name: /regenerate multi asset/i })
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/content/generate',
        expect.anything()
      )
    );
    const call = fetchMock.mock.calls.find(
      ([u]) => u === '/api/content/generate'
    );
    expect(JSON.parse(call![1]!.body as string).platform).toBe('twitter');
  });
});
