import {
  INDUSTRY_STARTERS,
  applyStarter,
  generateSite,
  getStarter,
  inferStarter,
  type BusinessProfile,
  type SiteBrand,
} from '@/lib/site-generator';

const brand: SiteBrand = {
  slug: 'acme',
  displayName: 'Acme',
  forbiddenWords: ['cheap', 'synergy'],
};

// A sparse profile — the shape a thin GBP listing yields: one broad service,
// no FAQs.
const sparse: BusinessProfile = {
  name: 'Acme Plumbing',
  url: 'https://acmeplumbing.com.au',
  address: {
    addressLocality: 'Brisbane',
    addressRegion: 'QLD',
    addressCountry: 'AU',
  },
  services: [],
};

describe('industry starters — lookup + inference', () => {
  it('resolves a starter by key', () => {
    expect(getStarter('plumbing')?.label).toBe('Plumbing');
    expect(getStarter('nope')).toBeUndefined();
  });

  it('infers a starter from a GBP category display name (case-insensitive)', () => {
    expect(inferStarter('Plumber')?.key).toBe('plumbing');
    expect(inferStarter('Water damage restoration service')?.key).toBe(
      'restoration'
    );
    expect(inferStarter('Bakery')).toBeUndefined();
  });
});

describe('applyStarter — non-destructive gap fill', () => {
  it('fills empty services and FAQs from the starter', () => {
    const starter = getStarter('plumbing')!;
    const filled = applyStarter(sparse, starter);

    expect(filled.services).toBe(starter.services);
    expect(filled.faqs).toBe(starter.faqs);
    // Input is not mutated.
    expect(sparse.services).toHaveLength(0);
    expect(sparse.faqs).toBeUndefined();
  });

  it('keeps the business’s own services and FAQs when present (real data wins)', () => {
    const own: BusinessProfile = {
      ...sparse,
      services: [{ slug: 'gas-fitting', label: 'gas fitting' }],
      faqs: [{ question: 'Q', answer: 'A' }],
    };
    const filled = applyStarter(own, getStarter('plumbing')!);

    expect(filled.services).toEqual(own.services);
    expect(filled.faqs).toEqual(own.faqs);
  });
});

describe('starter → generateSite produces a valid, on-brand site', () => {
  it.each(INDUSTRY_STARTERS.map(s => s.key))(
    'the "%s" starter passes every validator',
    key => {
      const starter = getStarter(key)!;
      const profile = applyStarter(sparse, starter);
      const r = generateSite({ brand, profile });

      expect(r.validations.filter(v => v.severity === 'block')).toHaveLength(0);
      expect(r.ok).toBe(true);
      // Hero is the starter's first service; copy mentions its noun.
      expect(r.slug).toBe(starter.services[0].slug);
      expect(r.copy.faqs.length).toBeGreaterThanOrEqual(2);
    }
  );
});
