import {
  runBrandVoiceGate,
  extractDraftFromPriorOutputs,
  resolveBrandSlugFromOrgSlug,
} from '@/lib/agency/brand-voice-gate';

describe('brand-voice-gate', () => {
  it('fails on R1 forbidden words via full enforce engine', async () => {
    const r = await runBrandVoiceGate(
      {
        brand: 'ra',
        content:
          'The platform helps teams leverage existing reports. Quick note.',
      },
      { trackingEnabled: false }
    );
    expect(r.pass).toBe(false);
    expect(r.violations.some(v => v.startsWith('R1:'))).toBe(true);
  });

  it('passes clean professional copy', async () => {
    const r = await runBrandVoiceGate(
      {
        brand: 'dr',
        content:
          'When flooding damages property, document the scene before remediation begins.',
      },
      { trackingEnabled: false }
    );
    expect(r.pass).toBe(true);
    expect(r.score).toBe(100);
  });

  it('fails on empty content before calling enforce', async () => {
    const r = await runBrandVoiceGate(
      { brand: 'dr', content: '   ' },
      { trackingEnabled: false }
    );
    expect(r.pass).toBe(false);
    expect(r.violations).toEqual(['empty_content']);
  });

  it('extracts draft from prior outputs', () => {
    const text = extractDraftFromPriorOutputs([
      { output: { content: 'Draft body here' } },
    ]);
    expect(text).toContain('Draft body');
  });

  describe('resolveBrandSlugFromOrgSlug', () => {
    it('maps portfolio org slugs to brand slugs', () => {
      expect(resolveBrandSlugFromOrgSlug('disaster-recovery')).toBe('dr');
      expect(resolveBrandSlugFromOrgSlug('restoreassist')).toBe('ra');
      expect(resolveBrandSlugFromOrgSlug('nrpg')).toBe('nrpg');
    });

    it('accepts brand slugs directly', () => {
      expect(resolveBrandSlugFromOrgSlug('dr')).toBe('dr');
    });

    it('returns undefined for unknown orgs', () => {
      expect(resolveBrandSlugFromOrgSlug('unknown-client')).toBeUndefined();
    });
  });
});
