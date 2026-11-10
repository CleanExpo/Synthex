/**
 * SYN-1404: the studio board is CCW's review portal. A reviewer must be able
 * to watch the video on the card, and a refused Approve must say why instead
 * of looking like nothing happened.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import useSWR from 'swr';
import ClientStudioPage from '@/app/dashboard/marketing-agency/[client]/studio/page';

jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }));

const mutate = jest.fn();
const board = {
  clientSlug: 'ccw',
  displayName: 'CCW',
  total: 2,
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
});
