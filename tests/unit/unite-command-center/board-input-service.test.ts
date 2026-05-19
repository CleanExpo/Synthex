import { createBoardInputDraft } from '@/lib/unite-command-center';

describe('createBoardInputDraft', () => {
  it('creates a draft board input and command packet without persistence', () => {
    const ids = ['input-1', 'packet-1'];
    const result = createBoardInputDraft({
      organizationId: 'org-1',
      source: 'telegram',
      speaker: ' Toby ',
      rawText:
        'Toby wants a Facebook campaign and storyboard video for APT meters.',
      evidenceRefs: ['wiki:synthex'],
      now: new Date('2026-05-19T00:00:00.000Z'),
      idFactory: () => ids.shift()!,
    });

    expect(result.boardInput).toMatchObject({
      id: 'input-1',
      organizationId: 'org-1',
      source: 'telegram',
      speaker: 'Toby',
      capturedAt: '2026-05-19T00:00:00.000Z',
    });
    expect(result.commandPacket).toMatchObject({
      id: 'packet-1',
      boardInputId: 'input-1',
      scenarioState: 'ready_for_review',
      approvalGate: 'client_review',
      outcomeMetric: 'approved_command_packet',
    });
    expect(result.commandPacket.teamRoute).toEqual(
      expect.arrayContaining(['ceo-board', 'margot', 'marketing-strategy'])
    );
  });

  it('keeps live publishing requests blocked in the command packet', () => {
    const result = createBoardInputDraft({
      organizationId: 'org-1',
      source: 'manual',
      speaker: 'Phill',
      rawText: 'Publish this to Facebook and add ad spend.',
      evidenceRefs: ['wiki:synthex'],
      idFactory: () => 'fixed-id',
    });

    expect(result.commandPacket.scenarioState).toBe('blocked');
    expect(result.commandPacket.approvalGate).toBe('production_blocked');
    expect(result.commandPacket.outcomeMetric).toBe('blocked_command_packet');
    expect(result.commandPacket.risks).toContain('production_or_spend_requested');
  });

  it('rejects blank speaker values after trimming', () => {
    expect(() =>
      createBoardInputDraft({
        organizationId: 'org-1',
        source: 'manual',
        speaker: '   ',
        rawText: 'Create a draft campaign.',
        evidenceRefs: ['wiki:synthex'],
      })
    ).toThrow('Speaker is required');
  });
});
