/**
 * MediaLibraryBrowser — the states the founder will actually meet.
 *
 * The library backend (folders, tags, favourites, search, stats) existed with no
 * UI reading it, so uploaded files had nowhere to appear. These tests cover the
 * four states that matter: loading, loaded-with-files, genuinely empty, and
 * failed. The empty and failed states are the ones worth pinning — a fetch
 * failure that renders as "nothing here yet" would tell the founder his files
 * were gone when they were not.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { MediaLibraryBrowser } from '@/components/media/MediaLibraryBrowser';

/**
 * SWR caches by URL key across renders, so without a fresh provider per test the
 * second test reads the first test's data — which silently turned an assertion
 * about one file into a pass against three, and let a cached success hide the
 * error state. Retries are off so a failure asserts on the first response.
 */
function renderBrowser() {
  return render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        shouldRetryOnError: false,
        dedupingInterval: 0,
      }}
    >
      <MediaLibraryBrowser />
    </SWRConfig>
  );
}

function asset(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'a1',
    userId: 'u1',
    type: 'image',
    provider: 'stability',
    status: 'completed',
    url: 'https://cdn/one.jpg',
    metadata: {},
    tags: [],
    isFavorite: false,
    isArchived: false,
    usageCount: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

function mockLibrary(body: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MediaLibraryBrowser — shows what is there', () => {
  it('renders a card per asset and reports the total', async () => {
    mockLibrary({
      assets: [
        asset({ id: 'a1', prompt: 'Carpet before' }),
        asset({ id: 'a2', type: 'audio', url: undefined, prompt: 'Voiceover' }),
        asset({ id: 'a3', type: 'video', url: undefined, prompt: 'Promo cut' }),
      ],
      total: 3,
      limit: 48,
      offset: 0,
      hasMore: false,
    });

    renderBrowser();

    await waitFor(() =>
      expect(screen.getByTestId('media-count')).toHaveTextContent('3 files')
    );
    expect(screen.getByText('Carpet before')).toBeInTheDocument();
    expect(screen.getByText('Voiceover')).toBeInTheDocument();
    expect(screen.getByText('Promo cut')).toBeInTheDocument();
  });

  it('says file, not files, for a single asset', async () => {
    mockLibrary({
      assets: [asset()],
      total: 1,
      limit: 48,
      offset: 0,
      hasMore: false,
    });

    renderBrowser();

    await waitFor(() =>
      expect(screen.getByTestId('media-count')).toHaveTextContent('1 file')
    );
  });

  it('requests the library route with archived assets hidden', async () => {
    mockLibrary({ assets: [], total: 0, limit: 48, offset: 0, hasMore: false });

    renderBrowser();

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/api/media/library');
    expect(url).toContain('isArchived=false');
  });
});

describe('MediaLibraryBrowser — empty is not the same as broken', () => {
  it('shows an empty state when the library really is empty', async () => {
    mockLibrary({ assets: [], total: 0, limit: 48, offset: 0, hasMore: false });

    renderBrowser();

    await waitFor(() =>
      expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
    );
    expect(screen.getByTestId('media-count')).toHaveTextContent('No media yet');
  });

  it('shows a failure state, never an empty state, when the request fails', async () => {
    mockLibrary({ error: 'Internal server error' }, false);

    renderBrowser();

    await waitFor(() =>
      expect(
        screen.getByText('Your media could not be loaded.')
      ).toBeInTheDocument()
    );
    // The dangerous confusion: a failed fetch must not read as "you have nothing".
    expect(screen.queryByText('Nothing here yet.')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' })
    ).toBeInTheDocument();
  });
});

describe('MediaLibraryBrowser — controls', () => {
  it('offers a filter per media kind, including audio', async () => {
    mockLibrary({ assets: [], total: 0, limit: 48, offset: 0, hasMore: false });

    renderBrowser();

    for (const label of ['All', 'Images', 'Video', 'Audio']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the active kind filter as pressed for assistive tech', async () => {
    mockLibrary({ assets: [], total: 0, limit: 48, offset: 0, hasMore: false });

    renderBrowser();

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Audio' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });
});
