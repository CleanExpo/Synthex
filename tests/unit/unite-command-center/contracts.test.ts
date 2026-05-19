import {
  BoardInputSchema,
  CommandPacketSchema,
} from '@/lib/unite-command-center';

const baseBoardInput = {
  id: 'input-1',
  organizationId: 'org-1',
  source: 'telegram',
  speaker: 'Phill',
  rawText: 'Create a campaign for APT meters.',
  cleanedText: 'Create a campaign for APT meters.',
  sensitivity: 'internal',
  capturedAt: '2026-05-19T00:00:00.000Z',
  evidenceRefs: ['wiki:synthex'],
};

describe('unite command center contracts', () => {
  it('accepts a valid board input contract', () => {
    expect(BoardInputSchema.parse(baseBoardInput)).toMatchObject({
      id: 'input-1',
      source: 'telegram',
      evidenceRefs: ['wiki:synthex'],
    });
  });

  it('rejects unknown input sources', () => {
    expect(() =>
      BoardInputSchema.parse({ ...baseBoardInput, source: 'sms' })
    ).toThrow();
  });

  it('accepts a draft command packet contract', () => {
    const packet = CommandPacketSchema.parse({
      id: 'packet-1',
      boardInputId: 'input-1',
      title: 'APT meters campaign',
      ontologyRefs: ['source:board-input', 'work:campaign'],
      teamRoute: ['ceo-board', 'marketing-strategy'],
      scenarioState: 'ready_for_review',
      approvalGate: 'client_review',
      risks: [],
      nextAction: 'Prepare a draft packet for review.',
      outcomeMetric: 'approved_campaign_brief',
    });

    expect(packet.scenarioState).toBe('ready_for_review');
  });
});
