import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrandScanner } from '@/components/campaigns/BrandScanner';

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

describe('BrandScanner', () => {
  it('starts idle: no status or DNA card until a scan runs', () => {
    render(<BrandScanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // The DNA result card (with its "First post" row) is not shown yet.
    expect(screen.queryByText('First post')).not.toBeInTheDocument();
    // Scan button is disabled with an empty URL.
    expect(screen.getByRole('button', { name: /scan site/i })).toBeDisabled();
  });

  it('scans a URL and renders the DNA card from the preview', async () => {
    const onScanned = jest.fn();
    const fetchMock: FetchMock = jest.fn((url, init) => {
      if (url === '/api/brand-dna/extract' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            preview: {
              businessName: 'Acme Restoration',
              industry: 'disaster recovery',
              firstPost: 'Water damage? We respond in 60 minutes.',
            },
            status: 'extracting',
          })
        );
      }
      throw new Error(`unexpected fetch ${url} ${init?.method ?? 'GET'}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<BrandScanner onScanned={onScanned} />);
    fireEvent.change(screen.getByLabelText('Website URL'), {
      target: { value: 'https://acme.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: /scan site/i }));

    expect(await screen.findByText('Acme Restoration')).toBeInTheDocument();
    expect(screen.getByText('disaster recovery')).toBeInTheDocument();
    expect(screen.getByText(/Water damage\? We respond/)).toBeInTheDocument();

    // The extract endpoint received the URL in the POST body.
    const call = fetchMock.mock.calls.find(
      ([u, init]) => u === '/api/brand-dna/extract' && init?.method === 'POST'
    );
    expect(JSON.parse(call![1]!.body as string).url).toBe(
      'https://acme.example'
    );
    await waitFor(() =>
      expect(onScanned).toHaveBeenCalledWith(
        expect.objectContaining({ businessName: 'Acme Restoration' })
      )
    );
  });

  it('surfaces the server error verbatim on a non-2xx (e.g. no active org)', async () => {
    const fetchMock: FetchMock = jest.fn(() =>
      Promise.resolve(
        jsonResponse({ error: 'No active organisation' }, false, 403)
      )
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<BrandScanner />);
    fireEvent.change(screen.getByLabelText('Website URL'), {
      target: { value: 'https://acme.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: /scan site/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No active organisation'
    );
    // No fabricated DNA card on failure.
    expect(screen.queryByText('First post')).not.toBeInTheDocument();
  });
});
