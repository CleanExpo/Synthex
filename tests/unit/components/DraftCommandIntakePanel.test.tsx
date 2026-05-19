import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DraftCommandIntakePanel } from '@/components/command-centre';
import { fetchWithCSRF } from '@/lib/csrf';

jest.mock('@/lib/csrf', () => ({
  fetchWithCSRF: jest.fn(),
}));

const mockFetchWithCSRF = fetchWithCSRF as jest.MockedFunction<
  typeof fetchWithCSRF
>;

describe('DraftCommandIntakePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the draft-only intake form without public execution controls', () => {
    render(<DraftCommandIntakePanel />);

    expect(screen.getByText('Draft Command Intake')).toBeInTheDocument();
    expect(screen.getByText('Draft only')).toBeInTheDocument();
    expect(screen.getByText('Telegram command intake')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp command intake')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create draft packet/i })
    ).toBeDisabled();
    expect(screen.queryByText(/^Publish$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Approve$/i)).not.toBeInTheDocument();
  });

  it('posts valid input to the draft intake API and renders gate badges', async () => {
    mockFetchWithCSRF.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: 'draft',
        persisted: false,
        executionBlocked: true,
        boardInput: {
          id: 'input-1',
          organizationId: 'org-1',
          source: 'telegram',
          speaker: 'Toby',
          rawText: 'Create a campaign.',
          cleanedText: 'Create a campaign.',
          sensitivity: 'internal',
          capturedAt: '2026-05-19T00:00:00.000Z',
          evidenceRefs: ['wiki:synthex'],
        },
        commandPacket: {
          id: 'packet-1',
          boardInputId: 'input-1',
          title: 'Create a campaign',
          ontologyRefs: ['source:board-input', 'work:campaign'],
          teamRoute: ['ceo-board', 'margot', 'marketing-strategy'],
          scenarioState: 'ready_for_review',
          approvalGate: 'client_review',
          risks: [],
          nextAction: 'Prepare a draft packet for review.',
          outcomeMetric: 'approved_command_packet',
        },
      }),
    } as Response);

    render(<DraftCommandIntakePanel />);

    fireEvent.change(screen.getByLabelText(/source/i), {
      target: { value: 'telegram' },
    });
    fireEvent.change(screen.getByLabelText(/speaker/i), {
      target: { value: 'Toby' },
    });
    fireEvent.change(screen.getByLabelText(/raw input/i), {
      target: { value: 'Create a campaign.' },
    });
    fireEvent.change(screen.getByLabelText(/evidence refs/i), {
      target: { value: 'wiki:synthex' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create draft packet/i }));

    await waitFor(() => {
      expect(mockFetchWithCSRF).toHaveBeenCalledWith(
        '/api/command-centre/intake',
        expect.objectContaining({ method: 'POST' })
      );
    });

    expect(await screen.findByText('Create a campaign')).toBeInTheDocument();
    expect(screen.getByText('client review')).toBeInTheDocument();
    expect(screen.getByText('marketing strategy')).toBeInTheDocument();
  });

  it('surfaces validation errors from the API', async () => {
    mockFetchWithCSRF.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Validation failed' }),
    } as Response);

    render(<DraftCommandIntakePanel />);

    fireEvent.change(screen.getByLabelText(/raw input/i), {
      target: { value: 'Draft this.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create draft packet/i }));

    expect(await screen.findByText('Validation failed')).toBeInTheDocument();
  });
});
