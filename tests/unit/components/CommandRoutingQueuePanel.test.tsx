import { render, screen, within } from '@testing-library/react';
import { CommandRoutingQueuePanel } from '@/components/command-centre';
import type {
  BoardInput,
  CommandPacket,
} from '@/lib/unite-command-center';

const boardInput: BoardInput = {
  id: 'input-1',
  organizationId: 'org-1',
  source: 'telegram',
  speaker: 'Toby',
  rawText: 'Create a Facebook campaign for APT meters.',
  cleanedText: 'Create a Facebook campaign for APT meters.',
  sensitivity: 'internal',
  capturedAt: '2026-05-22T00:00:00.000Z',
  evidenceRefs: ['wiki:synthex', 'shopify:apt-meter'],
};

const commandPacket: CommandPacket = {
  id: 'packet-1',
  boardInputId: 'input-1',
  title: 'Create a Facebook campaign for APT meters',
  ontologyRefs: ['source:board-input', 'work:campaign', 'work:gen-media'],
  teamRoute: ['ceo-board', 'margot', 'marketing-strategy'],
  scenarioState: 'ready_for_review',
  approvalGate: 'client_review',
  risks: [],
  nextAction: 'Prepare a draft packet for review.',
  outcomeMetric: 'approved_command_packet',
};

describe('CommandRoutingQueuePanel', () => {
  it('renders an empty routing queue without execution controls', () => {
    render(<CommandRoutingQueuePanel draft={null} />);

    expect(
      screen.getByText('Board, Margot and @team queue')
    ).toBeInTheDocument();
    expect(screen.getByText('No draft route')).toBeInTheDocument();
    expect(screen.getByText('Team route appears after a draft packet is created.')).toBeInTheDocument();
    expect(screen.getByText('No provider execution')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('renders board input, Margot pass, evidence, approval, and @team route from a draft', () => {
    render(
      <CommandRoutingQueuePanel
        draft={{
          mode: 'draft',
          persisted: false,
          executionBlocked: true,
          boardInput,
          commandPacket,
        }}
      />
    );

    expect(screen.getByText('Draft queued')).toBeInTheDocument();
    expect(screen.getByText('telegram')).toBeInTheDocument();
    expect(screen.getByText('internal')).toBeInTheDocument();
    expect(screen.getByText('2 refs')).toBeInTheDocument();
    expect(screen.getAllByText('client review').length).toBeGreaterThan(0);
    expect(screen.getByText('3 routes queued')).toBeInTheDocument();

    const dispatch = screen.getByText('@team dispatch').closest('[class*="rounded-sm"]');
    expect(dispatch).not.toBeNull();
    expect(within(dispatch!).getByText('CEO Board')).toBeInTheDocument();
    expect(within(dispatch!).getByText('Margot')).toBeInTheDocument();
    expect(within(dispatch!).getByText('Marketing Strategy')).toBeInTheDocument();
    expect(screen.getByText('ready for review')).toBeInTheDocument();
  });

  it('surfaces blocked production and missing evidence risks', () => {
    render(
      <CommandRoutingQueuePanel
        draft={{
          mode: 'draft',
          persisted: false,
          executionBlocked: true,
          boardInput: {
            ...boardInput,
            evidenceRefs: [],
            sensitivity: 'restricted',
          },
          commandPacket: {
            ...commandPacket,
            approvalGate: 'production_blocked',
            risks: [
              'secret_or_credential',
              'missing_evidence',
              'production_or_spend_requested',
            ],
            nextAction: 'Collect explicit human approval before any live action.',
          },
        }}
      />
    );

    expect(screen.getAllByText('production blocked').length).toBeGreaterThan(0);
    expect(screen.getByText('secret or credential')).toBeInTheDocument();
    expect(screen.getByText('missing evidence')).toBeInTheDocument();
    expect(screen.getByText('production or spend requested')).toBeInTheDocument();
    expect(screen.getByText('0 refs')).toBeInTheDocument();
  });
});
