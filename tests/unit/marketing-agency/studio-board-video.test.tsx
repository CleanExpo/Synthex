/**
 * SYN-1404: the studio board is CCW's review portal. A reviewer must be able
 * to watch the video on the card, and a refused Approve must say why instead
 * of looking like nothing happened.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import useSWR from 'swr';
import ClientStudioPage from '@/app/dashboard/marketing-agency/[client]/studio/page';

jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }));

const mutate = jest.fn();
const board = {
  clientSlug: 'ccw',
  displayName: 'CCW',
  total: 2,
  canApprove: true,
  approveRefusal: null,
  board: {
    awaiting_approval: [
      {
        id: 'd1',
        topic: 'Monday 09/11/2026, 07:00: Cyclone season is open',
        script: 'Hook\n\nMessage',
        status: 'awaiting_approval',
        videoUrl: 'https://example.test/signed/ccw-w1-d1-am.mp4',
      },
      {
        id: 'd2',
        topic: 'No video yet',
        script: 'Text only',
        status: 'awaiting_approval',
        videoUrl: null,
      },
    ],
    approved: [],
    published: [],
  },
};

type Refusal =
  | 'STUDIO_APPROVE_ROLE_REQUIRED'
  | 'STUDIO_APPROVE_NOT_ORG_MEMBER'
  | 'STUDIO_APPROVE_CHECK_UNAVAILABLE'
  | null;

const ROLE_LINE =
  'You can view this board. Approving needs an editor, admin or owner role in this organisation. An owner or admin of this organisation can change your role.';
const MEMBER_LINE =
  'You can view this board from the parent workspace. Approving needs membership of this organisation itself. An owner or admin of this organisation can add you.';
const CHECK_LINE =
  'Approval could not be checked just now. Reload the page to try again.';
const ACCESS_LINE =
  'Access could not be checked just now. Reload the page to try again.';

async function renderWith(state: {
  data?: unknown;
  error?: unknown;
  isLoading?: boolean;
}) {
  (useSWR as jest.Mock).mockReturnValue({
    data: state.data,
    error: state.error,
    isLoading: state.isLoading ?? false,
    mutate,
  });
  await act(async () => {
    render(<ClientStudioPage params={Promise.resolve({ client: 'ccw' })} />);
  });
}

function boardWith(canApprove: boolean | undefined, refusal?: unknown) {
  const { canApprove: _drop, approveRefusal: _drop2, ...rest } = board;
  void _drop;
  void _drop2;
  return {
    ...rest,
    ...(canApprove === undefined ? {} : { canApprove }),
    ...(refusal === undefined ? {} : { approveRefusal: refusal as Refusal }),
  };
}

const approveButtons = () =>
  screen.queryAllByRole('button', { name: 'Approve' });
const pageText = () => document.body.textContent ?? '';

type BoardError = Error & { status?: number; code?: string };

/** Runs the fetcher the page handed to useSWR against a mocked fetch. */
async function runPageFetcher(
  response: { ok: boolean; status: number; body: unknown } | 'network-failure'
): Promise<{ result?: unknown; error?: BoardError }> {
  global.fetch = (response === 'network-failure'
    ? jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    : jest.fn().mockResolvedValue({
        ok: response.ok,
        status: response.status,
        json: async () => response.body,
      })) as unknown as typeof fetch;
  await renderBoard();
  const fetcher = (useSWR as jest.Mock).mock.calls[0][1] as unknown;
  expect(typeof fetcher).toBe('function');
  try {
    const result = await (fetcher as (url: string) => Promise<unknown>)(
      '/api/marketing-agency/studio/ccw'
    );
    return { result };
  } catch (e) {
    return { error: e as BoardError };
  }
}

async function renderBoard() {
  (useSWR as jest.Mock).mockReturnValue({
    data: board,
    error: undefined,
    isLoading: false,
    mutate,
  });
  await act(async () => {
    render(<ClientStudioPage params={Promise.resolve({ client: 'ccw' })} />);
  });
}

describe('studio board as a review portal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('plays the draft video on its card, and shows no player for a draft without one', async () => {
    await renderBoard();
    const players = document.querySelectorAll('video');
    expect(players).toHaveLength(1);
    expect(players[0].getAttribute('src')).toBe(
      'https://example.test/signed/ccw-w1-d1-am.mp4'
    );
    expect(players[0].hasAttribute('controls')).toBe(true);
    expect(
      screen.getByLabelText(
        'Video: Monday 09/11/2026, 07:00: Cyclone season is open'
      )
    ).toBeTruthy();
  });

  it('shows the reason when Approve is refused', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'Approval requires membership of this organisation',
      }),
    }) as unknown as typeof fetch;
    await renderBoard();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);
    });

    expect(screen.getByRole('alert').textContent).toBe(
      'Approval requires membership of this organisation'
    );
    expect(mutate).toHaveBeenCalled();
  });

  it('says the approval is unconfirmed when the request itself fails', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new TypeError('Failed to fetch')
      ) as unknown as typeof fetch;
    await renderBoard();
    mutate.mockClear();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);
    });

    expect(screen.getByRole('alert').textContent).toMatch(
      /could not confirm that approval/
    );
    expect(mutate).toHaveBeenCalled();
  });

  it('says why a video cannot be shown instead of an empty player', async () => {
    (useSWR as jest.Mock).mockReturnValue({
      data: {
        ...board,
        board: {
          ...board.board,
          awaiting_approval: [
            {
              id: 'd3',
              topic: 'Link failed',
              script: 'x',
              status: 'awaiting_approval',
              videoUrl: null,
              videoError:
                'The video link could not be created just now. Reload the page to try again.',
            },
          ],
        },
      },
      error: undefined,
      isLoading: false,
      mutate,
    });
    await act(async () => {
      render(<ClientStudioPage params={Promise.resolve({ client: 'ccw' })} />);
    });
    expect(document.querySelectorAll('video')).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toMatch(
      /could not be created/
    );
  });

  it('keeps the first signed link while the page is open, so a playing video is not reloaded', async () => {
    const withUrl = (url: string) => ({
      data: {
        ...board,
        board: {
          ...board.board,
          awaiting_approval: [
            { ...board.board.awaiting_approval[0], videoUrl: url },
          ],
        },
      },
      error: undefined,
      isLoading: false,
      mutate,
    });
    (useSWR as jest.Mock).mockReturnValue(
      withUrl('https://example.test/first')
    );
    let view: ReturnType<typeof render> | undefined;
    await act(async () => {
      view = render(
        <ClientStudioPage params={Promise.resolve({ client: 'ccw' })} />
      );
    });
    (useSWR as jest.Mock).mockReturnValue(
      withUrl('https://example.test/second')
    );
    await act(async () => {
      view!.rerender(
        <ClientStudioPage params={Promise.resolve({ client: 'ccw' })} />
      );
    });
    expect(document.querySelector('video')?.getAttribute('src')).toBe(
      'https://example.test/first'
    );
  });

  it('takes the latest signed link when the kept one stops playing', async () => {
    const withUrl = (url: string) => ({
      data: {
        ...board,
        board: {
          ...board.board,
          awaiting_approval: [
            { ...board.board.awaiting_approval[0], videoUrl: url },
          ],
        },
      },
      error: undefined,
      isLoading: false,
      mutate,
    });
    (useSWR as jest.Mock).mockReturnValue(withUrl('https://example.test/old'));
    let view: ReturnType<typeof render> | undefined;
    await act(async () => {
      view = render(
        <ClientStudioPage params={Promise.resolve({ client: 'ccw' })} />
      );
    });
    (useSWR as jest.Mock).mockReturnValue(withUrl('https://example.test/new'));
    await act(async () => {
      view!.rerender(
        <ClientStudioPage params={Promise.resolve({ client: 'ccw' })} />
      );
    });
    await act(async () => {
      fireEvent.error(document.querySelector('video')!);
    });
    expect(document.querySelector('video')?.getAttribute('src')).toBe(
      'https://example.test/new'
    );
  });

  it('asks for a fresh link once when the only link has expired, and plays the new one', async () => {
    const withUrl = (url: string) => ({
      data: {
        ...board,
        board: {
          ...board.board,
          awaiting_approval: [
            { ...board.board.awaiting_approval[0], videoUrl: url },
          ],
        },
      },
      error: undefined,
      isLoading: false,
      mutate,
    });
    (useSWR as jest.Mock).mockReturnValue(
      withUrl('https://example.test/expired')
    );
    let view: ReturnType<typeof render> | undefined;
    await act(async () => {
      view = render(
        <ClientStudioPage params={Promise.resolve({ client: 'ccw' })} />
      );
    });
    const video = () => document.querySelector('video')!;
    await act(async () => {
      fireEvent.error(video());
    });
    await act(async () => {
      fireEvent.error(video());
    });
    // One re-read per dead link, never a loop.
    expect(mutate).toHaveBeenCalledTimes(1);

    (useSWR as jest.Mock).mockReturnValue(
      withUrl('https://example.test/fresh')
    );
    await act(async () => {
      view!.rerender(
        <ClientStudioPage params={Promise.resolve({ client: 'ccw' })} />
      );
    });
    expect(video().getAttribute('src')).toBe('https://example.test/fresh');
  });

  it('shows no error after an accepted Approve', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ approved: true }),
    }) as unknown as typeof fetch;
    await renderBoard();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows Approve when canApprove is true', async () => {
    await renderWith({ data: boardWith(true, null) });
    expect(approveButtons()).toHaveLength(2);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the server sentence in the alert when approve is refused', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: ROLE_LINE,
        code: 'STUDIO_APPROVE_ROLE_REQUIRED',
      }),
    }) as unknown as typeof fetch;
    await renderWith({ data: boardWith(true, null) });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);
    });

    expect(screen.getByRole('alert').textContent).toBe(ROLE_LINE);
  });

  it('hides Approve when canApprove is false', async () => {
    await renderWith({
      data: boardWith(false, 'STUDIO_APPROVE_ROLE_REQUIRED'),
    });
    expect(approveButtons()).toHaveLength(0);
  });

  it('hides Approve when canApprove is missing', async () => {
    await renderWith({ data: boardWith(undefined) });
    expect(approveButtons()).toHaveLength(0);
  });

  it('hides Approve, your and the refusal line while the first load is in flight', async () => {
    await renderWith({ data: undefined, error: undefined, isLoading: true });
    expect(approveButtons()).toHaveLength(0);
    expect(pageText()).not.toMatch(/\byour\b/);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says your sign-off in the heading only when canApprove is true', async () => {
    await renderWith({ data: boardWith(true, null) });
    expect(pageText()).toMatch(/awaiting your sign-off/);
    cleanup();
    await renderWith({
      data: boardWith(false, 'STUDIO_APPROVE_ROLE_REQUIRED'),
    });
    expect(pageText()).toMatch(/awaiting sign-off/);
    expect(pageText()).not.toMatch(/\byour sign-off/);
  });

  it('hides Approve, your and the refusal line when the fetch has failed with earlier data held', async () => {
    await renderWith({
      data: boardWith(true, null),
      error: Object.assign(new Error('Server error'), { status: 500 }),
    });
    expect(approveButtons()).toHaveLength(0);
    expect(pageText()).not.toMatch(/\byour\b/);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the role line for STUDIO_APPROVE_ROLE_REQUIRED', async () => {
    await renderWith({
      data: boardWith(false, 'STUDIO_APPROVE_ROLE_REQUIRED'),
    });
    expect(screen.queryByRole('status')?.textContent).toBe(ROLE_LINE);
  });

  it('shows the membership line for STUDIO_APPROVE_NOT_ORG_MEMBER', async () => {
    await renderWith({
      data: boardWith(false, 'STUDIO_APPROVE_NOT_ORG_MEMBER'),
    });
    expect(screen.queryByRole('status')?.textContent).toBe(MEMBER_LINE);
  });

  it('shows the unavailable line for STUDIO_APPROVE_CHECK_UNAVAILABLE', async () => {
    await renderWith({
      data: boardWith(false, 'STUDIO_APPROVE_CHECK_UNAVAILABLE'),
    });
    expect(screen.queryByRole('status')?.textContent).toBe(CHECK_LINE);
  });

  it('shows no refusal line for an unrecognised approveRefusal code', async () => {
    await renderWith({ data: boardWith(false, 'SOMETHING_NEW') });
    expect(approveButtons()).toHaveLength(0);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the server sentence when the board read answers 503 STUDIO_ACCESS_CHECK_UNAVAILABLE', async () => {
    const { error } = await runPageFetcher({
      ok: false,
      status: 503,
      body: { error: ACCESS_LINE, code: 'STUDIO_ACCESS_CHECK_UNAVAILABLE' },
    });
    expect(error).toBeInstanceOf(Error);
    cleanup();
    await renderWith({ data: undefined, error });
    expect(pageText()).toContain(ACCESS_LINE);
    expect(pageText()).not.toContain('Failed to load the studio board.');
  });

  it('the board fetcher keeps the status, code and sentence of a failed read', async () => {
    const { error } = await runPageFetcher({
      ok: false,
      status: 403,
      body: { error: ROLE_LINE, code: 'STUDIO_APPROVE_ROLE_REQUIRED' },
    });
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe(ROLE_LINE);
    expect(error?.status).toBe(403);
    expect(error?.code).toBe('STUDIO_APPROVE_ROLE_REQUIRED');
  });

  it('retries a failed board read only for 5xx and network errors', async () => {
    await renderBoard();
    const options = (useSWR as jest.Mock).mock.calls[0][2] as
      | {
          shouldRetryOnError?: unknown;
          errorRetryCount?: number;
        }
      | undefined;
    expect(options?.errorRetryCount).toBe(3);
    expect(typeof options?.shouldRetryOnError).toBe('function');
    const retry = options?.shouldRetryOnError as (e: unknown) => boolean;
    const withStatus = (status: number) =>
      Object.assign(new Error('x'), { status });
    expect(retry(withStatus(500))).toBe(true);
    expect(retry(withStatus(503))).toBe(true);
    expect(retry(new TypeError('Failed to fetch'))).toBe(true);
    expect(retry(withStatus(401))).toBe(false);
    expect(retry(withStatus(403))).toBe(false);
    expect(retry(withStatus(404))).toBe(false);
  });
});
