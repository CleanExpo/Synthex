/**
 * DOM render test for AgentRunDetail (SYN-1031).
 *
 * Automated stand-in for the manual browser smoke that the worktree cannot run
 * (no DATABASE_URL / JWT_SECRET / seeded run here): the outcome-first flow links
 * to this page while the run is still `queued`/`running`, so the page must
 *   - show a "preparing — updates automatically" banner and KEEP polling while
 *     the run is non-terminal, and
 *   - drop the banner and STOP polling once the run is terminal.
 *
 * Strategy (repo idiom — RTL + jsdom via jest.worktree.cjs): mock `useApi` so we
 * control the run payload and capture the `pollingInterval` it is asked for on
 * each render; mock `ClaimActions` (it owns its own fetch) to a stub.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { AgentRunDetail } from '@/components/marketing-agency/agent/AgentRunDetail';
import { useApi } from '@/hooks/use-api';

jest.mock('@/hooks/use-api', () => ({ useApi: jest.fn() }));
jest.mock('@/components/marketing-agency/agent/ClaimActions', () => ({
  ClaimActions: () => null,
}));

const mockUseApi = useApi as jest.Mock;

const BANNER = /Synthex is preparing this work/i;

function makeRun(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    status,
    startedAt: '2026-06-17T00:00:00Z',
    completedAt: status === 'completed' ? '2026-06-17T00:01:00Z' : null,
    opportunitiesConsidered: 0,
    claimsProposed: 0,
    evidenceGapsFlagged: 0,
    summary: null,
    errorMessage: null,
    artifacts: {},
    qaReportId: null,
    agent: { id: 'agent-1', name: 'Launch RestoreAssist', goal: 'Drive work' },
    qaReport: null,
    ...extra,
  };
}

/** Wire the mocked useApi to return `run`, capture every pollingInterval, and
 *  simulate one successful fetch (drives the onSuccess → stop/continue logic). */
function wireUseApi(run: Record<string, unknown>): number[] {
  const intervals: Array<number | undefined> = [];
  mockUseApi.mockImplementation(
    (_url: string, opts: { pollingInterval?: number; onSuccess?: (d: unknown) => void }) => {
      intervals.push(opts?.pollingInterval);
      if (opts?.onSuccess) {
        Promise.resolve().then(() => opts.onSuccess?.({ run }));
      }
      return {
        data: { run },
        isLoading: false,
        error: null,
        isValidating: false,
        refetch: jest.fn(),
        mutate: jest.fn(),
      };
    },
  );
  return intervals as number[];
}

afterEach(() => {
  mockUseApi.mockReset();
});

describe('AgentRunDetail polling + preparing banner', () => {
  it('shows the banner and keeps polling while the run is queued', async () => {
    const intervals = wireUseApi(makeRun('queued'));
    render(<AgentRunDetail runId="run-1" />);

    expect(screen.getByText(BANNER)).toBeInTheDocument();
    // Still preparing → polling stays enabled (a positive interval).
    await waitFor(() => {
      expect(intervals[intervals.length - 1]).toBeGreaterThan(0);
    });
  });

  it('hides the banner and stops polling once the run is completed', async () => {
    const intervals = wireUseApi(
      makeRun('completed', {
        claimsProposed: 1,
        artifacts: {
          claims: [
            { opportunityId: 'o1', claimId: 'c1', statement: 'A claim', warnings: [] },
          ],
        },
      }),
    );
    render(<AgentRunDetail runId="run-1" />);

    expect(screen.queryByText(BANNER)).not.toBeInTheDocument();
    expect(screen.getByText('A claim')).toBeInTheDocument();
    // Terminal status → onSuccess flips preparing off → polling disabled.
    await waitFor(() => {
      expect(intervals[intervals.length - 1]).toBeUndefined();
    });
  });
});
