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

  it('tags brand canaries verified when brandMetrics are supplied', () => {
    const s = buildTier1Snapshot({
      brandMetrics: {
        dr: { d3Events: 4, qualificationRate: 40 },
        nrpg: { n2Applications: 10, n3Acceptance: 30 },
        carsi: { snapshotCompletion: 55, firmActivations: 2 },
        ccw: { hubToCart: null },
      },
    });
    expect(s.brands.dr.d3Events).toEqual(
      expect.objectContaining({ value: 4, tag: 'verified' })
    );
    expect(s.brands.nrpg.n2Applications.value).toBe(10);
    expect(s.brands.carsi.firmActivations.value).toBe(2);
    expect(s.brands.ccw.hubToCart.tag).toBe('hypothesised');
    expect(s.brands.ccw.hubToCart.value).toBeNull();
  });

  it('leaves brand canaries hypothesised when brandMetrics are omitted', () => {
    const s = buildTier1Snapshot();
    expect(s.brands.dr.d3Events.value).toBeNull();
    expect(s.brands.dr.d3Events.tag).toBe('hypothesised');
  });
});
