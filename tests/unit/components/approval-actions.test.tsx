/**
 * DOM test for ApprovalActions reject→revision wiring (SYN-972).
 *
 * The reject path previously called /cancel (terminal kill). It now calls the
 * /reject endpoint (hold for revision, nothing published) with a REQUIRED
 * reason. This pins that behaviour.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalActions } from '@/components/workflows/ApprovalActions';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  global.fetch = fetchMock as unknown as typeof fetch;
});

function setup(onRejected = jest.fn()) {
  render(
    <ApprovalActions
      executionId="exec-1"
      stepId="step-1"
      onApproved={jest.fn()}
      onRejected={onRejected}
    />,
  );
  return { onRejected };
}

describe('ApprovalActions reject → revision', () => {
  it('calls the /reject endpoint (not /cancel) with the typed reason', async () => {
    const { onRejected } = setup();
    fireEvent.click(screen.getByText('Reject'));
    fireEvent.change(screen.getByPlaceholderText(/reason for revision/i), {
      target: { value: 'Soften the CTA' },
    });
    fireEvent.click(screen.getByText('Send for revision'));

    await waitFor(() => expect(onRejected).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/workflows/executions/exec-1/reject');
    expect(JSON.parse((opts as RequestInit).body as string)).toEqual({
      reason: 'Soften the CTA',
    });
  });

  it('does not call /cancel for a reject (no terminal kill)', async () => {
    setup();
    fireEvent.click(screen.getByText('Reject'));
    fireEvent.change(screen.getByPlaceholderText(/reason for revision/i), {
      target: { value: 'rework intro' },
    });
    fireEvent.click(screen.getByText('Send for revision'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).not.toMatch(/\/cancel$/);
  });

  it('disables submission until a reason is entered', () => {
    setup();
    fireEvent.click(screen.getByText('Reject'));
    expect(screen.getByText('Send for revision').closest('button')).toBeDisabled();
  });

  it('approve still calls the /approve endpoint', async () => {
    const onApproved = jest.fn();
    render(
      <ApprovalActions
        executionId="exec-9"
        stepId="step-9"
        onApproved={onApproved}
        onRejected={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(onApproved).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/workflows/executions/exec-9/approve');
  });
});
