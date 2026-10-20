/**
 * Brand Video Studio — not-provisioned state.
 *
 * GET /api/brand-video/jobs answers 503 FEATURE_NOT_PROVISIONED while the
 * brand_video_jobs table is absent. The page used to swallow that, show
 * "No videos queued yet." and re-poll every 8s, and Generate showed the raw
 * code instead of the message.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import BrandVideoStudioPage from '@/app/dashboard/brand-video/page';

const JOBS_MESSAGE =
  'Brand video job history is not available: the brand_video_jobs table is not provisioned.';
const GENERATE_MESSAGE =
  'Brand video job queueing is not available: the brand_video_jobs table is not provisioned.';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

let fetchMock: jest.Mock;

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <BrandVideoStudioPage />
    </SWRConfig>
  );
}

const jobsCalls = () =>
  fetchMock.mock.calls.filter(c => c[0] === '/api/brand-video/jobs').length;

async function flush(ms = 0) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  fetchMock = jest.fn(async (url: string) => {
    if (url === '/api/brand-video/jobs') {
      return jsonResponse(503, {
        error: 'FEATURE_NOT_PROVISIONED',
        message: JOBS_MESSAGE,
      });
    }
    if (url === '/api/brand-video/generate') {
      return jsonResponse(503, {
        error: 'FEATURE_NOT_PROVISIONED',
        message: GENERATE_MESSAGE,
      });
    }
    return jsonResponse(404, {});
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('BrandVideoStudioPage when brand video is not provisioned', () => {
  it('shows a not-set-up state with the server message, not an empty list', async () => {
    renderPage();
    await flush();

    expect(
      screen.getByText('Brand video rendering is not set up yet')
    ).toBeInTheDocument();
    expect(screen.getByText(JOBS_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText('No videos queued yet.')).not.toBeInTheDocument();
  });

  it('stops polling the jobs endpoint after a 503', async () => {
    renderPage();
    await flush();
    const afterFirstLoad = jobsCalls();
    expect(afterFirstLoad).toBe(1);

    await flush(60_000);

    expect(jobsCalls()).toBe(afterFirstLoad);
  });

  it('shows the message, not the raw code, when Generate is refused', async () => {
    renderPage();
    await flush();

    fireEvent.change(screen.getByPlaceholderText('e.g. Synthex'), {
      target: { value: 'Synthex' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('What should this video be about?'),
      { target: { value: 'Water damage first hour' } }
    );
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));
    await flush();

    expect(screen.getByText(GENERATE_MESSAGE)).toBeInTheDocument();
    expect(
      screen.queryByText('FEATURE_NOT_PROVISIONED')
    ).not.toBeInTheDocument();
  });
});

describe('BrandVideoStudioPage when the jobs read fails', () => {
  it('reports the failure instead of an empty list', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(500, { error: 'Internal error' })
    );
    renderPage();
    await flush();

    expect(
      screen.getByText('Could not load recent jobs: Internal error')
    ).toBeInTheDocument();
    expect(screen.queryByText('No videos queued yet.')).not.toBeInTheDocument();
  });
});

describe('BrandVideoStudioPage when jobs load', () => {
  it('still shows the empty state for a real empty list', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { jobs: [] }));
    renderPage();
    await flush();

    expect(screen.getByText('No videos queued yet.')).toBeInTheDocument();
    expect(
      screen.queryByText('Brand video rendering is not set up yet')
    ).not.toBeInTheDocument();
  });
});
