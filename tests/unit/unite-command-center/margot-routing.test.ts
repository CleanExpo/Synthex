import {
  linkCommandOntology,
  routeBoardInputToTeam,
  runMargotConversationPass,
  type BoardInput,
} from '@/lib/unite-command-center';

function boardInput(overrides: Partial<BoardInput> = {}): BoardInput {
  const pass = runMargotConversationPass({
    rawText:
      'Toby wants a Facebook campaign and storyboard video for APT meters.',
  });

  return {
    id: 'input-1',
    organizationId: 'org-1',
    source: 'telegram',
    speaker: 'Toby',
    rawText: pass.cleanedText,
    cleanedText: pass.cleanedText,
    sensitivity: pass.sensitivity,
    capturedAt: '2026-05-19T00:00:00.000Z',
    evidenceRefs: ['wiki:synthex', 'shopify:apt-meter'],
    ...overrides,
  };
}

describe('margot conversation pass and routing', () => {
  it('normalises whitespace and classifies media intent', () => {
    const result = runMargotConversationPass({
      rawText: '  Build   a   HeyGen video storyboard   ',
    });

    expect(result.cleanedText).toBe('Build a HeyGen video storyboard');
    expect(result.intent).toBe('media');
    expect(result.sensitivity).toBe('public');
  });

  it('flags credential-like input as restricted', () => {
    const result = runMargotConversationPass({
      rawText: 'My API key is in this note.',
    });

    expect(result.sensitivity).toBe('restricted');
    expect(result.risks).toContain('secret_or_credential');
  });

  it('links ontology refs from client, product, campaign, and media signals', () => {
    expect(linkCommandOntology(boardInput())).toEqual(
      expect.arrayContaining([
        'source:board-input',
        'actor:client',
        'entity:product',
        'work:campaign',
        'work:gen-media',
      ])
    );
  });

  it('routes mixed campaign media work to the right team lanes', () => {
    expect(routeBoardInputToTeam(boardInput())).toEqual(
      expect.arrayContaining([
        'ceo-board',
        'margot',
        'marketing-strategy',
        'gen-media',
      ])
    );
  });
});
