/**
 * GenerativeVideoPanel — the staff screen for the fal generative video engine.
 *
 * POST /api/video/generate (mode:'generative') had no web caller; this panel is
 * it. The tests pin what matters for an honest screen:
 *  - the payload matches the route's Zod schema (integers, no nulls);
 *  - every refusal the route can return renders as that refusal, never success;
 *  - submitted jobs are polled to a terminal state, capped, and polling stops
 *    when the panel unmounts (no requests from a page the user has left).
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  GenerativeVideoPanel,
  POLL_INTERVAL_MS,
  MAX_POLLS,
} from '@/components/video/generative-video-panel';

const CARDS = {
  methodCards: [
    {
      id: 'product-reveal',
      name: 'Product Reveal',
      description: 'A dramatic studio reveal.',
      requiresImage: false,
    },
    {
      id: 'logo-motion',
      name: 'Logo Motion',
      description: 'Animates a supplied logo.',
      requiresImage: true,
    },
  ],
  models: [
    { tier: 'draft', maxDurationSeconds: 15 },
    { tier: 'premium', maxDurationSeconds: 8 },
  ],
  quota: {
    spentUsd: 12.5,
    monthlyBudgetUsd: 100,
    spentTodayUsd: 2,
    dailyBudgetUsd: 10,
    warning: false,
  },
};

type Reply = { status: number; body: unknown };

function reply(status: number, body: unknown): Reply {
  return { status, body };
}

/**
 * Route-aware fetch mock: cards always answers CARDS; generate answers the
 * given reply; each GET /api/video/<id> pops the next queued status reply.
 */
function mockFetch(generate: Reply, polls: Reply[] = []) {
  const queue = [...polls];
  const fn = jest.fn((url: string, init?: RequestInit) => {
    let r: Reply;
    if (url === '/api/video/cards') r = reply(200, CARDS);
    else if (url === '/api/video/generate' && init?.method === 'POST')
      r = generate;
    else if (url.startsWith('/api/video/'))
      r = queue.length > 1 ? queue.shift()! : (queue[0] ?? reply(500, {}));
    else r = reply(404, {});
    return Promise.resolve({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: () => Promise.resolve(r.body),
    } as Response);
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const JOB = {
  id: 'vid_1',
  providerJobId: 'fal_1',
  batchGroupId: 'b1',
  model: 'fal-draft',
  estimatedCostUsd: 0.35,
  status: 'generating',
};

function pollCalls(fn: jest.Mock) {
  return fn.mock.calls.filter(([u]) => u === '/api/video/vid_1').length;
}

async function fillAndSubmit() {
  await screen.findByRole('option', { name: 'Product Reveal' });
  fireEvent.change(screen.getByLabelText(/prompt/i), {
    target: { value: 'a cordless moisture meter on a workbench' },
  });
  fireEvent.click(screen.getByRole('button', { name: /generate video/i }));
}

afterEach(() => {
  jest.useRealTimers();
});

describe('form and payload', () => {
  it('sends the generative payload with integer fields and no unset optionals', async () => {
    const fn = mockFetch(reply(200, { success: true, data: { jobs: [] } }));
    render(<GenerativeVideoPanel />);
    await screen.findByRole('option', { name: 'Product Reveal' });
    fireEvent.change(screen.getByLabelText(/variants/i), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText(/duration/i), {
      target: { value: '6' },
    });
    await fillAndSubmit();

    await waitFor(() =>
      expect(fn.mock.calls.some(([u]) => u === '/api/video/generate')).toBe(
        true
      )
    );
    const [, init] = fn.mock.calls.find(([u]) => u === '/api/video/generate')!;
    const body = JSON.parse(String(init!.body));
    expect(body).toEqual({
      mode: 'generative',
      methodCardId: 'product-reveal',
      prompt: 'a cordless moisture meter on a workbench',
      modelTier: 'draft',
      aspectRatio: '9:16',
      durationSeconds: 6,
      variants: 2,
    });
    expect(typeof body.variants).toBe('number');
    expect('imageUrl' in body).toBe(false);
  });

  it('shows the quota from /api/video/cards without inventing a price', async () => {
    mockFetch(reply(200, { success: true, data: { jobs: [] } }));
    render(<GenerativeVideoPanel />);
    expect(
      await screen.findByText(/US\$12\.50 of US\$100\.00 this month/)
    ).toBeInTheDocument();
  });

  it('asks for an image URL only when the card requires one', async () => {
    mockFetch(reply(200, { success: true, data: { jobs: [] } }));
    render(<GenerativeVideoPanel />);
    await screen.findByRole('option', { name: 'Product Reveal' });
    expect(screen.queryByLabelText(/image url/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/method card/i), {
      target: { value: 'logo-motion' },
    });
    expect(screen.getByLabelText(/image url/i)).toBeRequired();
  });

  it('shows a failed state, not an empty form, when the cards read fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch;
    render(<GenerativeVideoPanel />);
    expect(
      await screen.findByText(/could not load the method cards \(HTTP 500\)/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /generate video/i })
    ).not.toBeInTheDocument();
  });
});

describe('route refusals render honestly', () => {
  const cases: Array<[string, Reply, RegExp]> = [
    [
      '403 feature off',
      reply(403, {
        success: false,
        error: 'Video studio is not enabled (VIDEO_STUDIO_ENABLED)',
      }),
      /video studio is not switched on/i,
    ],
    [
      '403 security policy',
      reply(403, { error: 'CSRF token invalid' }),
      /CSRF token invalid/,
    ],
    [
      '402 quota',
      reply(402, {
        success: false,
        error: 'Monthly video budget reached',
        cap: 'monthly',
      }),
      /video budget reached.*Monthly video budget reached/i,
    ],
    [
      '402 entitlement',
      reply(402, {
        success: false,
        error:
          'Video generation requires a Professional subscription or higher',
        upgradeRequired: true,
      }),
      /plan does not include video generation/i,
    ],
    [
      '422 blocked',
      reply(422, {
        success: false,
        error: 'No owned reference images for "restoration"',
        blocked: true,
      }),
      /blocked.*No owned reference images for "restoration"/i,
    ],
    [
      '400 zod validation',
      reply(400, {
        success: false,
        error: 'Invalid request',
        details: [{ path: ['prompt'], message: 'Too short' }],
      }),
      /prompt: Too short/,
    ],
    [
      '400 service message',
      reply(400, {
        success: false,
        error: 'Requested duration 10s exceeds premium tier maximum of 8s',
      }),
      /exceeds premium tier maximum of 8s/,
    ],
    [
      '500 submit failed',
      reply(500, { success: false, error: 'Video generation submit failed' }),
      /submit failed.*nothing was queued/i,
    ],
  ];

  it.each(cases)('%s', async (_name, r, expected) => {
    mockFetch(r);
    render(<GenerativeVideoPanel />);
    await fillAndSubmit();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(expected);
    expect(screen.queryByText(/rendering/i)).not.toBeInTheDocument();
  });

  it('treats a 200 without jobs as a failure, not a success', async () => {
    mockFetch(reply(200, { success: true, data: {} }));
    render(<GenerativeVideoPanel />);
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no jobs were returned/i
    );
  });
});

describe('polling submitted jobs', () => {
  async function submitWithFakeTimers(polls: Reply[]) {
    jest.useFakeTimers();
    const fn = mockFetch(
      reply(200, { success: true, data: { jobs: [JOB] } }),
      polls
    );
    const view = render(<GenerativeVideoPanel />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await fillAndSubmit();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    return { fn, view };
  }

  it('polls to rendered and shows the player, then stops', async () => {
    const { fn } = await submitWithFakeTimers([
      reply(200, {
        success: true,
        data: { id: 'vid_1', status: 'generating' },
      }),
      reply(200, {
        success: true,
        data: {
          id: 'vid_1',
          status: 'rendered',
          videoUrl: 'https://storage.example/generated-videos/vid_1.mp4',
        },
      }),
    ]);
    expect(screen.getByText(/estimated US\$0\.35/i)).toBeInTheDocument();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });
    const video = screen.getByLabelText(/generated video vid_1/i);
    expect(video.getAttribute('src')).toBe(
      'https://storage.example/generated-videos/vid_1.mp4'
    );
    const after = pollCalls(fn);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
    });
    expect(pollCalls(fn)).toBe(after);
  });

  it('polls to failed and shows the failure reason', async () => {
    await submitWithFakeTimers([
      reply(200, {
        success: true,
        data: {
          id: 'vid_1',
          status: 'failed',
          errorMessage: 'Provider rejected the prompt',
        },
      }),
    ]);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(
      screen.getByText(/Provider rejected the prompt/)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/generated video/i)).not.toBeInTheDocument();
  });

  it('stops after the cap and says it is still rendering', async () => {
    const { fn } = await submitWithFakeTimers([
      reply(200, {
        success: true,
        data: { id: 'vid_1', status: 'generating' },
      }),
    ]);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * (MAX_POLLS + 5));
    });
    expect(pollCalls(fn)).toBe(MAX_POLLS);
    expect(
      screen.getByText(/still rendering — check back/i)
    ).toBeInTheDocument();
  });

  it('stops polling when the panel unmounts', async () => {
    const { fn, view } = await submitWithFakeTimers([
      reply(200, {
        success: true,
        data: { id: 'vid_1', status: 'generating' },
      }),
    ]);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    const before = pollCalls(fn);
    expect(before).toBeGreaterThan(0);
    view.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10);
    });
    expect(pollCalls(fn)).toBe(before);
  });

  it('announces job status in a polite live region', async () => {
    await submitWithFakeTimers([
      reply(200, {
        success: true,
        data: { id: 'vid_1', status: 'generating' },
      }),
    ]);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent(/rendering/i);
  });
});
