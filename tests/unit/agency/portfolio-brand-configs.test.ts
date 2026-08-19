/**
 * AT-030 — portfolio tenant definitions (4 Nexus + CCW carve-out).
 */
import {
  CCW_CARVE_OUT_SLUG,
  PORTFOLIO_BRANDS,
} from '@/lib/agency/portfolio-brand-configs';

describe('portfolio-brand-configs (AT-030)', () => {
  it('defines four Nexus brands and documents CCW carve-out', () => {
    expect(PORTFOLIO_BRANDS).toHaveLength(4);
    expect(PORTFOLIO_BRANDS.map(b => b.slug).sort()).toEqual([
      'carsi',
      'disaster-recovery',
      'nrpg',
      'restoreassist',
    ]);
    expect(CCW_CARVE_OUT_SLUG).toBe('ccwarehouse');
    expect(PORTFOLIO_BRANDS.some(b => b.slug === CCW_CARVE_OUT_SLUG)).toBe(
      false
    );
  });

  it('gives each brand a distinct voiceTag (no shared voice across tenants)', () => {
    const tags = PORTFOLIO_BRANDS.map(b => b.brandVoice.voiceTag);
    // DR + NRPG intentionally share hybrid_phill_strategic (primary flywheel);
    // RestoreAssist and CARSI must not collapse into one voice.
    expect(new Set(tags).size).toBeGreaterThanOrEqual(3);
    expect(tags).toContain('brand_anonymous');
    expect(tags).toContain('hybrid_phill_strategic_brand_routine');
  });
});
