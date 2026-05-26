import { buildTier1Snapshot } from '@/lib/agency/tier1-snapshot';

describe('tier1-snapshot', () => {
  it('builds portfolio template with verification tags', () => {
    const s = buildTier1Snapshot({ claimsProcessed: 12 });
    expect(s.templateVersion).toBe('T1-2026.05');
    expect(s.headline.claimsProcessed.tag).toBe('verified');
    expect(s.headline.claimsProcessed.value).toBe(12);
    expect(s.verificationStatus.length).toBeGreaterThan(0);
  });

  it('defaults claims to hypothesised when null', () => {
    const s = buildTier1Snapshot();
    expect(s.headline.claimsProcessed.tag).toBe('hypothesised');
  });
});
