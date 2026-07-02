/**
 * Unit test for the OutcomeWorkbench preset derivation (SYN-1031 F2).
 *
 * Presets previously hardcoded two brands (RestoreAssist, CARSI) for every
 * tenant. They are now derived from the active business so the suggestions
 * match the operator's brand, with a brand-neutral fallback when no business
 * is active.
 */
import { presetOutcomesForBusiness } from '@/components/marketing-agency/OutcomeWorkbench';

describe('presetOutcomesForBusiness', () => {
  it('derives brand-specific presets from the active business name', () => {
    expect(presetOutcomesForBusiness('Acme Restoration')).toEqual([
      'Launch Acme Restoration',
      'Build Acme Restoration authority',
    ]);
  });

  it('trims surrounding whitespace from the brand name', () => {
    expect(presetOutcomesForBusiness('  CARSI  ')).toEqual([
      'Launch CARSI',
      'Build CARSI authority',
    ]);
  });

  it('falls back to brand-neutral presets when no business is active', () => {
    const fallback = [
      'Win more enquiries this quarter',
      'Build search authority',
    ];
    expect(presetOutcomesForBusiness(null)).toEqual(fallback);
    expect(presetOutcomesForBusiness(undefined)).toEqual(fallback);
    expect(presetOutcomesForBusiness('   ')).toEqual(fallback);
  });
});
