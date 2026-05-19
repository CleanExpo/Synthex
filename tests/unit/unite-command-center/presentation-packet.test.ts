import {
  createGenMediaBrief,
  createPresentationPacket,
  type CommandPacket,
} from '@/lib/unite-command-center';

const packet: CommandPacket = {
  id: 'packet-1',
  boardInputId: 'input-1',
  title:
    'Create a full Facebook campaign and technical explainer video for APT meters',
  ontologyRefs: ['source:board-input', 'work:campaign', 'work:gen-media'],
  teamRoute: ['ceo-board', 'marketing-strategy', 'gen-media'],
  scenarioState: 'ready_for_review',
  approvalGate: 'client_review',
  risks: [],
  nextAction: 'Prepare a draft packet for review.',
  outcomeMetric: 'approved_command_packet',
};

describe('presentation and Gen Media packets', () => {
  it('creates a draft presentation packet with evidence on every slide', () => {
    const result = createPresentationPacket({
      commandPacket: packet,
      evidenceRefs: ['wiki:synthex', 'shopify:apt-meter'],
    });

    expect(result.state).toBe('draft');
    expect(result.slides).toHaveLength(3);
    expect(result.slides.every(slide => slide.title.length <= 64)).toBe(true);
    expect(result.slides.every(slide => slide.evidenceRefs.length > 0)).toBe(
      true
    );
    expect(result.slides[0].evidenceRefs).not.toBe(result.slides[1].evidenceRefs);
  });

  it('blocks presentation packets without evidence', () => {
    const result = createPresentationPacket({
      commandPacket: packet,
      evidenceRefs: [],
    });

    expect(result.state).toBe('blocked');
    expect(result.qaFindings).toContain('missing_evidence');
  });

  it('creates Remotion draft briefs only when evidence, consent, and licence pass', () => {
    const result = createGenMediaBrief({
      commandPacket: packet,
      assetGate: {
        evidenceRefs: ['wiki:synthex'],
        consentState: 'cleared',
        licenseState: 'cleared',
      },
    });

    expect(result.state).toBe('draft');
    expect(result.productionMode).toBe('remotion_draft');
    expect(result.visualStyle).toContain('first-principles');
  });

  it('blocks Gen Media briefs when production, consent, or licence gates fail', () => {
    const result = createGenMediaBrief({
      commandPacket: { ...packet, approvalGate: 'production_blocked' },
      assetGate: {
        evidenceRefs: [],
        consentState: 'pending',
        licenseState: 'pending',
      },
    });

    expect(result.state).toBe('blocked');
    expect(result.productionMode).toBe('blocked');
    expect(result.qaFindings).toEqual(
      expect.arrayContaining([
        'missing_evidence',
        'consent_pending',
        'license_pending',
        'production_gate_blocked',
      ])
    );
  });
});
