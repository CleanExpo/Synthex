/**
 * DOM test for WorkflowAuditTimeline (SYN-972 Audit leg UI). Renders the
 * decision trail from the audit endpoint, including the revision reason.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { WorkflowAuditTimeline } from '@/components/workflows/WorkflowAuditTimeline';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function resolveTrail(trail: unknown) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ trail }) });
}

describe('WorkflowAuditTimeline', () => {
  it('renders each decision with its outcome label and reason', async () => {
    resolveTrail([
      { stepIndex: 0, stepName: 'Generate content', stepType: 'ai', outcome: 'auto_approved' },
      { stepIndex: 1, stepName: 'Human review', stepType: 'approval', outcome: 'approved', actor: 'ceo-1' },
      {
        stepIndex: 2,
        stepName: 'Human review',
        stepType: 'approval',
        outcome: 'rejected',
        actor: 'ceo-1',
        detail: 'Soften the CTA',
      },
    ]);
    render(<WorkflowAuditTimeline executionId="exec-1" />);

    await waitFor(() =>
      expect(screen.getByText('Auto-approved')).toBeInTheDocument(),
    );
    expect(screen.getByText('Approved')).toBeInTheDocument();
    // 'rejected' surfaces with the revision-framed label + the reason.
    expect(screen.getByText('Sent for revision')).toBeInTheDocument();
    expect(screen.getByText('Soften the CTA')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workflows/executions/exec-1/audit',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('shows an empty state when there are no decisions', async () => {
    resolveTrail([]);
    render(<WorkflowAuditTimeline executionId="exec-1" />);
    await waitFor(() =>
      expect(screen.getByText(/no decisions recorded/i)).toBeInTheDocument(),
    );
  });

  it('shows an error when the audit endpoint fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<WorkflowAuditTimeline executionId="exec-1" />);
    await waitFor(() =>
      expect(screen.getByText(/audit unavailable/i)).toBeInTheDocument(),
    );
  });
});
