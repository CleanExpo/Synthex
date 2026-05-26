import {
  runBrandVoiceGate,
  extractDraftFromPriorOutputs,
} from '@/lib/agency/brand-voice-gate';

describe('brand-voice-gate', () => {
  it('fails on global anti-patterns', () => {
    const r = runBrandVoiceGate({
      content: 'We are excited to announce a game-changing product.',
    });
    expect(r.pass).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
  });

  it('passes clean professional copy', () => {
    const r = runBrandVoiceGate({
      content:
        'When flooding damages your property, document the scene before remediation begins.',
      voiceTag: 'hybrid_phill_strategic',
    });
    expect(r.pass).toBe(true);
  });

  it('extracts draft from prior outputs', () => {
    const text = extractDraftFromPriorOutputs([
      { output: { content: 'Draft body here' } },
    ]);
    expect(text).toContain('Draft body');
  });
});
