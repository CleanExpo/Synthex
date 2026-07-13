import { FORBIDDEN_PRONOUNS } from '@unite-group/brand-config';

import {
  INDUSTRY_STARTERS,
  applyStarter,
  generateSite,
  type BusinessProfile,
  type SiteBrand,
} from '@/lib/site-generator';

/**
 * Brand-voice regression: brands that ban FORBIDDEN_PRONOUNS
 * ('we', 'our', 'i', 'us', 'my') must still generate — any first-person copy
 * baked into the deterministic template or an industry-starter FAQ hard-blocks
 * generation for such brands. The neutral test brand used elsewhere never
 * exercises this. This suite locks scaffold copy to a pronoun-free voice.
 */
const pronounBanningBrand: SiteBrand = {
  slug: 'estate-voice',
  displayName: 'Estate Voice Co',
  forbiddenWords: [...FORBIDDEN_PRONOUNS],
};

// Thin-GBP shape: no FAQs, so scaffold copy (the risk surface) fills the gap.
const sparse: BusinessProfile = {
  name: 'Estate Voice Co',
  url: 'https://estatevoice.com.au',
  address: {
    addressLocality: 'Brisbane',
    addressRegion: 'QLD',
    addressCountry: 'AU',
  },
  services: [{ slug: 'water-damage', label: 'water damage restoration' }],
};

describe('scaffold copy honours pronoun-banning brand voice', () => {
  it('template default FAQs pass with no starter applied', () => {
    const result = generateSite({
      brand: pronounBanningBrand,
      profile: sparse,
    });
    expect(result.validations.filter(v => v.severity === 'block')).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each(INDUSTRY_STARTERS.map(s => [s.key, s] as const))(
    '%s starter FAQs pass',
    (_key, starter) => {
      const filled = applyStarter(sparse, starter);
      const result = generateSite({
        brand: pronounBanningBrand,
        profile: filled,
      });
      expect(result.validations.filter(v => v.severity === 'block')).toEqual(
        []
      );
      expect(result.ok).toBe(true);
    }
  );
});
