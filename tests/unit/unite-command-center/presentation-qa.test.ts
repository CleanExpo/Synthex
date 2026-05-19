import {
  evaluatePresentationQa,
  type CommandPacket,
} from '@/lib/unite-command-center';

const packet: CommandPacket = {
  id: 'packet-1',
  boardInputId: 'input-1',
  title: 'APT meters campaign',
  ontologyRefs: ['source:board-input'],
  teamRoute: ['ceo-board'],
  scenarioState: 'ready_for_review',
  approvalGate: 'client_review',
  risks: [],
  nextAction: 'Prepare review packet.',
  outcomeMetric: 'approved_campaign_brief',
};

describe('presentation QA gate', () => {
  it('passes when slides, evidence, licence, and approval gate are clean', () => {
    const result = evaluatePresentationQa({
      packet,
      slideTitles: ['APT meter campaign brief', 'Audience signal map'],
      evidenceRefs: ['wiki:synthex'],
      mediaLicenseState: 'cleared',
    });

    expect(result).toEqual({ passed: true, findings: [] });
  });

  it('fails when evidence and media licence are not ready', () => {
    const result = evaluatePresentationQa({
      packet,
      slideTitles: ['APT meter campaign brief'],
      evidenceRefs: [],
      mediaLicenseState: 'pending',
    });

    expect(result.passed).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining(['missing_evidence', 'media_license_pending'])
    );
  });

  it('treats blank slide and evidence values as missing', () => {
    const result = evaluatePresentationQa({
      packet,
      slideTitles: ['   '],
      evidenceRefs: ['   '],
      mediaLicenseState: 'not_required',
    });

    expect(result.passed).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining(['missing_slides', 'missing_evidence'])
    );
  });

  it('fails when a production block reaches presentation export', () => {
    const result = evaluatePresentationQa({
      packet: { ...packet, approvalGate: 'production_blocked' },
      slideTitles: ['APT meter campaign brief'],
      evidenceRefs: ['wiki:synthex'],
      mediaLicenseState: 'not_required',
    });

    expect(result.passed).toBe(false);
    expect(result.findings).toContain('production_gate_blocked');
  });
});
