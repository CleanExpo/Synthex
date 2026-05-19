import {
  buildResearchCouncilPacket,
  ResearchCouncilPacketSchema,
  routeBoardInputToTeam,
  type BoardInput,
} from '@/lib/unite-command-center';

const boardInput: BoardInput = {
  id: 'input-karpathy-1',
  organizationId: 'org-1',
  source: 'obsidian',
  speaker: 'Phill',
  rawText:
    'Use Karpathy council research from Obsidian and Hermes to improve the Synthex Command Center ROI metric.',
  cleanedText:
    'Use Karpathy council research from Obsidian and Hermes to improve the Synthex Command Center ROI metric.',
  sensitivity: 'internal',
  capturedAt: '2026-05-19T00:00:00.000Z',
  evidenceRefs: ['wiki:synthex-karpathy-research-council-2026-05-19'],
};

describe('buildResearchCouncilPacket', () => {
  it('creates a source-backed council packet that remains human reviewed', () => {
    const packet = buildResearchCouncilPacket({
      boardInput,
      idFactory: () => 'research-packet-1',
    });

    expect(ResearchCouncilPacketSchema.parse(packet)).toMatchObject({
      id: 'research-packet-1',
      boardInputId: 'input-karpathy-1',
      councilRoute: expect.arrayContaining([
        'market-researcher',
        'technical-architect',
        'contrarian-reviewer',
        'chair',
      ]),
      approvalGate: 'human_review',
    });
    expect(packet.findings.every(finding => finding.evidenceRefs.length > 0)).toBe(
      true
    );
  });

  it('blocks production when no evidence is attached', () => {
    const packet = buildResearchCouncilPacket({
      boardInput: { ...boardInput, evidenceRefs: [] },
      idFactory: () => 'research-packet-2',
    });

    expect(packet.approvalGate).toBe('production_blocked');
    expect(packet.synthesis.openQuestions).toEqual(
      expect.arrayContaining([
        'No source, wiki, repo, or provider evidence is attached.',
      ])
    );
  });

  it('routes Obsidian, Hermes, Palantir, and council requests to research council', () => {
    expect(routeBoardInputToTeam(boardInput)).toEqual(
      expect.arrayContaining(['research-council', 'senior-engineering-team'])
    );
  });
});
