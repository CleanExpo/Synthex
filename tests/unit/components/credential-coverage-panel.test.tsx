/**
 * DOM render test for CredentialCoveragePanel (SYN-1023 slice 3).
 *
 * The worktree can't run an authenticated dashboard (no DB/secrets), so this
 * stands in for the manual smoke: the panel renders per-account status badges
 * from /api/credential-coverage, shows the missing-account reason, and handles
 * loading / empty states — without ever displaying a secret value.
 */
import { render, screen } from '@testing-library/react';
import { CredentialCoveragePanel } from '@/components/integrations/CredentialCoveragePanel';
import { useApi } from '@/hooks/use-api';

jest.mock('@/hooks/use-api', () => ({ useApi: jest.fn() }));
const mockUseApi = useApi as jest.Mock;

function wire(result: Record<string, unknown>) {
  mockUseApi.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    isValidating: false,
    refetch: jest.fn(),
    mutate: jest.fn(),
    ...result,
  });
}

afterEach(() => mockUseApi.mockReset());

describe('CredentialCoveragePanel', () => {
  it('renders a status badge per account and the missing reason', () => {
    wire({
      data: {
        report: {
          rows: [
            { orgSlug: 'carsi', provider: 'facebook', slug: 's1', status: 'connected_oauth' },
            { orgSlug: 'carsi', provider: 'linkedin', slug: 's2', status: 'reference_only' },
            {
              orgSlug: 'carsi',
              provider: 'youtube',
              slug: 's3',
              status: 'missing',
              reason: 'No stored reference and no OAuth connection.',
            },
          ],
          totals: { connected_oauth: 1, reference_only: 1, missing: 1 },
        },
      },
    });
    render(<CredentialCoveragePanel />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Reference only')).toBeInTheDocument();
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(
      screen.getByText(/no stored reference and no oauth connection/i),
    ).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    wire({ isLoading: true });
    render(<CredentialCoveragePanel />);
    expect(screen.getByText(/loading credential coverage/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no mapped accounts', () => {
    wire({ data: { report: { rows: [], totals: { connected_oauth: 0, reference_only: 0, missing: 0 } } } });
    render(<CredentialCoveragePanel />);
    expect(screen.getByText(/no mapped accounts for this client/i)).toBeInTheDocument();
  });

  it('surfaces an error message', () => {
    wire({ error: new Error('boom') });
    render(<CredentialCoveragePanel />);
    expect(screen.getByText(/could not load credential coverage: boom/i)).toBeInTheDocument();
  });
});
