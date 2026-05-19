import {
  evaluateApprovalPolicy,
  evaluateProviderReadiness,
  type BoardInput,
} from '@/lib/unite-command-center';

const baseInput: BoardInput = {
  id: 'input-1',
  organizationId: 'org-1',
  source: 'manual',
  speaker: 'Phill',
  rawText: 'Prepare a draft campaign.',
  cleanedText: 'Prepare a draft campaign.',
  sensitivity: 'internal',
  capturedAt: '2026-05-19T00:00:00.000Z',
  evidenceRefs: ['wiki:synthex'],
};

describe('approval and provider gates', () => {
  it('blocks production or spend requests by default', () => {
    const result = evaluateApprovalPolicy({
      ...baseInput,
      cleanedText: 'Publish this campaign and approve ad spend.',
    });

    expect(result.scenarioState).toBe('blocked');
    expect(result.approvalGate).toBe('production_blocked');
    expect(result.risks).toContain('production_or_spend_requested');
  });

  it('requires evidence before review', () => {
    const result = evaluateApprovalPolicy({ ...baseInput, evidenceRefs: [] });

    expect(result.scenarioState).toBe('needs_evidence');
    expect(result.nextAction).toContain('Attach evidence');
  });

  it('keeps missing optional providers draft-only', () => {
    const readiness = evaluateProviderReadiness([
      { provider: 'pipedream', credentialPresent: false, requiredForLive: false },
    ]);

    expect(readiness[0]).toMatchObject({
      provider: 'pipedream',
      mode: 'draft',
    });
  });

  it('marks required missing providers as blocked without logging values', () => {
    const readiness = evaluateProviderReadiness([
      { provider: 'heygen', credentialPresent: false, requiredForLive: true },
      { provider: 'artlist', credentialPresent: true, requiredForLive: true },
    ]);

    expect(readiness).toEqual([
      expect.objectContaining({ provider: 'heygen', mode: 'blocked' }),
      expect.objectContaining({ provider: 'artlist', mode: 'live' }),
    ]);
    const blockedProvider = readiness.find(entry => entry.provider === 'heygen');
    expect(blockedProvider?.reason).not.toMatch(/key|token|secret/i);
  });
});
