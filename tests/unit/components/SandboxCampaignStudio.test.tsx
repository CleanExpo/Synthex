import { render, screen, within } from '@testing-library/react';
import { SandboxCampaignStudio } from '@/components/command-centre';
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
  sensitivity: 'client',
  capturedAt: '2026-05-19T00:00:00.000Z',
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

describe('SandboxCampaignStudio', () => {
  it('renders the sandbox workflow without execution controls', () => {
    render(<SandboxCampaignStudio draft={null} />);

    expect(screen.getByText('Sandbox Campaign Studio')).toBeInTheDocument();
    expect(screen.getByText('Idea intake')).toBeInTheDocument();
    expect(screen.getByText('No public publish')).toBeInTheDocument();
    expect(screen.getByText('No ad spend')).toBeInTheDocument();
    expect(screen.getByText('draft packet missing')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /publish/i })
    ).not.toBeInTheDocument();
  });

  it('marks early workflow stages complete after a draft packet exists', () => {
    render(
      <SandboxCampaignStudio
        draft={{
          mode: 'draft',
          persisted: false,
          executionBlocked: true,
          boardInput,
          commandPacket,
        }}
      />
    );

    expect(
      screen.getByText('Captured as a command packet.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ontology and team route generated.')
    ).toBeInTheDocument();
    expect(screen.getByText('Review deck can be drafted.')).toBeInTheDocument();
    expect(
      screen.getByText('Consent and licence gates remain pending.')
    ).toBeInTheDocument();
    const researchGrounding = screen
      .getByText('Research Grounding')
      .closest('[class*="rounded-sm"]');
    expect(researchGrounding).not.toBeNull();
    expect(within(researchGrounding!).getByText('3')).toBeInTheDocument();
    expect(
      within(researchGrounding!).getByText('ontology refs')
    ).toBeInTheDocument();

    const productionCard = screen
      .getByText('Production')
      .closest('[class*="rounded-sm"]');
    expect(productionCard).not.toBeNull();
    expect(within(productionCard!).getByText('blocked')).toBeInTheDocument();
    expect(screen.getByText('local tests not green')).toBeInTheDocument();
  });
});
