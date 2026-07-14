import {
  generateSite,
  type BusinessProfile,
  type SiteBrand,
} from '@/lib/site-generator';
import { buildDeterministicCopy } from '@/lib/site-generator/template';

// UNI-2368: a GBP primary category is a business-type noun. Most read as a
// service after "provides" ("provides water damage restoration service"), but
// an organisation-type noun does not — RestoreAssist's "Software company"
// listing produced "provides software company across …". These assert the
// entity-framed copy for organisation-type categories.

const brand: SiteBrand = {
  slug: 'restoreassist',
  displayName: 'RestoreAssist',
  forbiddenWords: [],
};

const softwareProfile: BusinessProfile = {
  name: 'RestoreAssist',
  url: 'https://restoreassist.app',
  address: {
    addressLocality: 'Australia and New Zealand',
    addressCountry: 'AU',
  },
  services: [{ slug: 'software-company', label: 'software company' }],
};

describe('deterministic copy — organisation-type category nouns', () => {
  it('frames the business AS the entity ("is a"), never "provides <entity>"', () => {
    const copy = buildDeterministicCopy(
      softwareProfile,
      softwareProfile.services[0]
    );

    expect(copy.intro).toContain('is a software company');
    expect(copy.intro).not.toContain('provides software company');
    // no "Every software company job …" either
    expect(copy.bodyParagraphs.join(' ')).not.toContain('software company job');
    // FAQ reads as an entity, not "provide software company"
    expect(JSON.stringify(copy.faqs)).not.toContain('provide software company');
  });

  it('still validates end-to-end (schema-vs-content match holds on the hero noun)', () => {
    const r = generateSite({ brand, profile: softwareProfile });
    expect(r.ok).toBe(true);
    expect(r.validations.filter(v => v.severity === 'block')).toHaveLength(0);
    expect(r.copy.headline).toContain('Australia and New Zealand');
    expect(r.html.toLowerCase()).toContain('software');
  });

  it('leaves genuine service categories on the "provides" phrasing', () => {
    const serviceProfile: BusinessProfile = {
      ...softwareProfile,
      services: [
        { slug: 'water-damage', label: 'water damage restoration service' },
      ],
    };
    const copy = buildDeterministicCopy(
      serviceProfile,
      serviceProfile.services[0]
    );
    expect(copy.intro).toContain('provides water damage restoration service');
  });
});
