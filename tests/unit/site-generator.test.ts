import {
  generateSite,
  type BusinessProfile,
  type SiteBrand,
  type SiteCopy,
} from '@/lib/site-generator';

const brand: SiteBrand = {
  slug: 'acme',
  displayName: 'Acme',
  legalName: 'Acme Pty Ltd',
  tagline: 'Local, fast, done right',
  logoPrimary: 'https://acme.com.au/logo.svg',
  forbiddenWords: ['cheap', 'synergy'],
};

const profile: BusinessProfile = {
  name: 'Acme Plumbing',
  legalName: 'Acme Plumbing Pty Ltd',
  url: 'https://acmeplumbing.com.au',
  telephone: '+61730000000',
  address: {
    streetAddress: '10 Trade St',
    addressLocality: 'Brisbane',
    addressRegion: 'QLD',
    postalCode: '4000',
    addressCountry: 'AU',
  },
  geo: { lat: -27.47, lng: 153.02 },
  services: [
    { slug: 'blocked-drains', label: 'blocked drain clearing' },
    { slug: 'hot-water', label: 'hot water repairs' },
  ],
  rating: { value: 4.8, count: 213 },
};

describe('generateSite — deterministic core', () => {
  it('produces a valid, on-brand site section from a profile', () => {
    const r = generateSite({ brand, profile });

    expect(r.ok).toBe(true);
    expect(r.validations.filter(v => v.severity === 'block')).toHaveLength(0);
    expect(r.slug).toBe('blocked-drains');
    expect(r.canonicalUrl).toBe('https://acmeplumbing.com.au/blocked-drains/');
    // headline mentions the hero service noun (schema-vs-content match holds)
    expect(r.copy.headline.toLowerCase()).toContain('blocked');
    expect(r.html).toContain('<h1>');
    expect(r.html).toContain('Brisbane');
  });

  it('emits a LocalBusiness + Service + FAQPage graph with the business facts', () => {
    const r = generateSite({ brand, profile });
    const graph = r.jsonLd['@graph'] as Array<Record<string, unknown>>;
    const types = graph.map(n => n['@type']);
    expect(types).toEqual(
      expect.arrayContaining(['LocalBusiness', 'Service', 'FAQPage'])
    );

    const lb = graph.find(n => n['@type'] === 'LocalBusiness')!;
    expect(lb.name).toBe('Acme Plumbing');
    expect(lb.telephone).toBe('+61730000000');
    expect((lb.aggregateRating as Record<string, unknown>).ratingValue).toBe(
      4.8
    );

    const svc = graph.find(n => n['@type'] === 'Service')!;
    expect(svc.serviceType).toBe('blocked drain clearing');
  });

  it('selects the hero service by serviceSlug', () => {
    const r = generateSite({ brand, profile, serviceSlug: 'hot-water' });
    expect(r.slug).toBe('hot-water');
    expect(r.copy.headline.toLowerCase()).toContain('hot water');
  });

  it('honours a baseUrl override for the canonical URL', () => {
    const r = generateSite(
      { brand, profile },
      { baseUrl: 'https://staging.acme.dev' }
    );
    expect(r.canonicalUrl).toBe('https://staging.acme.dev/blocked-drains/');
  });

  it('throws when the profile has no services', () => {
    expect(() =>
      generateSite({ brand, profile: { ...profile, services: [] } })
    ).toThrow(/at least one service/);
  });
});

describe('generateSite — validation gates block bad copy', () => {
  const heroNoun = 'blocked';
  function override(partial: Partial<SiteCopy>): SiteCopy {
    return {
      headline: `${heroNoun} drain clearing in Brisbane`,
      intro: 'Acme Plumbing provides blocked drain clearing across Brisbane.',
      bodyParagraphs: ['On-site assessment first, then a written quote.'],
      faqs: [],
      ...partial,
    };
  }

  it('blocks copy that frames AI as the actor (Aid Rule)', () => {
    const r = generateSite(
      { brand, profile },
      {
        copyOverride: override({
          intro: 'AI repairs your blocked drains overnight.',
        }),
      }
    );
    expect(r.ok).toBe(false);
    expect(
      r.validations.some(v => v.rule === 'aid-rule' && v.severity === 'block')
    ).toBe(true);
  });

  it('blocks unverified superlatives (ACL §18) and downgrades them to warn when verified', () => {
    const copyOverride = override({
      intro: 'The best blocked drain team in Brisbane.',
    });

    const blocked = generateSite({ brand, profile }, { copyOverride });
    expect(blocked.ok).toBe(false);
    expect(
      blocked.validations.some(
        v => v.rule === 'category-claim' && v.severity === 'block'
      )
    ).toBe(true);

    const verified = generateSite(
      { brand, profile },
      { copyOverride, verificationGateState: 'verified' }
    );
    expect(verified.ok).toBe(true);
    expect(
      verified.validations.some(
        v => v.rule === 'category-claim' && v.severity === 'warn'
      )
    ).toBe(true);
  });

  it('blocks copy that does not mention the hero service noun (schema-vs-content match)', () => {
    const r = generateSite(
      { brand, profile },
      {
        copyOverride: override({
          headline: 'Great service in Brisbane',
          intro: 'Acme Plumbing helps with all sorts of jobs across Brisbane.',
          bodyParagraphs: ['We turn up on time.'],
        }),
      }
    );
    expect(r.ok).toBe(false);
    expect(r.validations.some(v => v.rule === 'schema-content-match')).toBe(
      true
    );
  });

  it('blocks copy containing a brand-forbidden word', () => {
    const r = generateSite(
      { brand, profile },
      {
        copyOverride: override({
          intro: 'Cheap blocked drain clearing across Brisbane.',
        }),
      }
    );
    expect(r.ok).toBe(false);
    expect(
      r.validations.some(v => v.rule === 'brand-voice-forbidden-word')
    ).toBe(true);
  });
});
