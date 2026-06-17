/**
 * DOM test for Tier1ReportPanel agencyLoop rendering (SYN-PM-107).
 * The panel must surface the Gate metrics (incl. sent-for-revision) with their
 * verification tags when the snapshot includes them.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { Tier1ReportPanel } from '@/components/agency/Tier1ReportPanel';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function withReport(agencyLoop?: Record<string, unknown>) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      data: {
        id: 'rep-1',
        name: 'Tier-1 Weekly',
        generatedAt: '2026-06-17T00:00:00Z',
        snapshot: {
          weekEnding: '2026-06-15',
          headline: { narrative: 'Snapshot generated.', status: 'amber' },
          ...(agencyLoop ? { agencyLoop } : {}),
        },
      },
    }),
  });
}

describe('Tier1ReportPanel agencyLoop', () => {
  it('renders the gate metrics with their values and tags', async () => {
    withReport({
      workflowsCompleted: { label: 'Workflows approved + completed', value: 8, tag: 'verified' },
      sentForRevision: { label: 'Sent back for revision', value: 2, tag: 'verified' },
      approvalRate: { label: 'Approval rate (completed ÷ reviewed)', value: 80, tag: 'verified' },
    });
    render(<Tier1ReportPanel />);

    await waitFor(() =>
      expect(screen.getByText(/how the human gate decided/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('Sent back for revision')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getAllByText('verified').length).toBeGreaterThanOrEqual(3);
  });

  it('omits the agency-loop block when the snapshot has no gate metrics', async () => {
    withReport(undefined);
    render(<Tier1ReportPanel />);
    await waitFor(() =>
      expect(screen.getByText(/snapshot generated/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/how the human gate decided/i)).not.toBeInTheDocument();
  });
});
