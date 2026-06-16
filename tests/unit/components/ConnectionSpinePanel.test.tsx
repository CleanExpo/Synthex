/**
 * SYN-1030 — connection-health spine panel: empty/ready, error, and action states.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { ConnectionSpinePanel } from '@/components/command-centre';
import { fetchWithCSRF } from '@/lib/csrf';
import type { ConnectionSpineHealth } from '@/lib/connection-spine/health';

jest.mock('@/lib/csrf', () => ({ fetchWithCSRF: jest.fn() }));
const mockFetch = fetchWithCSRF as jest.MockedFunction<typeof fetchWithCSRF>;

function okResponse(body: ConnectionSpineHealth) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

const ALL_READY: ConnectionSpineHealth = {
  overall: 'ready',
  blockerCount: 0,
  systems: [
    { system: 'linear', label: 'Linear intake', status: 'ready', detail: 'ok' },
    { system: 'obsidian', label: 'Obsidian / 2nd brain', status: 'ready', detail: 'ok' },
    { system: 'hermes', label: 'Unite-Group CRM / Hermes', status: 'ready', detail: 'ok' },
    { system: 'social', label: 'Social credentials', status: 'ready', detail: 'ok' },
  ],
};

describe('ConnectionSpinePanel (SYN-1030)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the empty/ready state when no system needs action', async () => {
    mockFetch.mockResolvedValue(okResponse(ALL_READY));
    render(<ConnectionSpinePanel />);
    await waitFor(() => expect(screen.getByText(/all systems ready/i)).toBeInTheDocument());
    expect(screen.getByText('Linear intake')).toBeInTheDocument();
  });

  it('renders an error state when the request fails', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    render(<ConnectionSpinePanel />);
    await waitFor(() =>
      expect(screen.getByText(/couldn't load connection health/i)).toBeInTheDocument()
    );
  });

  it('renders an error state on a non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response);
    render(<ConnectionSpinePanel />);
    await waitFor(() =>
      expect(screen.getByText(/couldn't load connection health/i)).toBeInTheDocument()
    );
  });

  it('surfaces blockers as actions when a system needs attention', async () => {
    mockFetch.mockResolvedValue(
      okResponse({
        overall: 'action_required',
        blockerCount: 1,
        systems: [
          {
            system: 'obsidian',
            label: 'Obsidian / 2nd brain',
            status: 'action_required',
            detail: 'not writing back',
            action: 'Connect the Obsidian / 2nd-brain vault to enable writeback.',
          },
        ],
      })
    );
    render(<ConnectionSpinePanel />);
    await waitFor(() => expect(screen.getByText(/1 need/i)).toBeInTheDocument());
    expect(screen.getByText(/connect the obsidian/i)).toBeInTheDocument();
  });
});
